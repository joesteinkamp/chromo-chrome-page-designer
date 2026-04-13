/**
 * AI service — calls Anthropic, OpenAI, or Google Gemini APIs
 * for design critique and natural language edits.
 * Uses fetch() directly (no SDK) since this runs in a service worker.
 */

import type { AISuggestion } from "../shared/messages";

type Provider = "anthropic" | "openai" | "gemini";

// --- Provider-specific API callers ---

async function callAnthropic(
  apiKey: string,
  system: string,
  userContent: Array<Record<string, any>>,
  maxTokens: number
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",  // Latest Claude Sonnet
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: any) => b.type === "text");
  if (!textBlock?.text) throw new Error("No text response from Anthropic API");
  return textBlock.text;
}

async function callOpenAI(
  apiKey: string,
  system: string,
  userContent: Array<Record<string, any>>,
  maxTokens: number
): Promise<string> {
  // Convert content to OpenAI format
  const messages: any[] = [
    { role: "system", content: system },
    { role: "user", content: userContent.map((block) => {
      if (block.type === "text") return { type: "text", text: block.text };
      if (block.type === "image") {
        return {
          type: "image_url",
          image_url: {
            url: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        };
      }
      return block;
    })},
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",  // Latest GPT
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("No text response from OpenAI API");
  return text;
}

async function callGemini(
  apiKey: string,
  system: string,
  userContent: Array<Record<string, any>>,
  maxTokens: number
): Promise<string> {
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Convert content to Gemini format
  const parts: any[] = [];
  for (const block of userContent) {
    if (block.type === "text") {
      parts.push({ text: block.text });
    } else if (block.type === "image") {
      parts.push({
        inline_data: {
          mime_type: block.source.media_type,
          data: block.source.data,
        },
      });
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  // gemini-2.5-flash is a thinking model: parts may include thought tokens (thought: true)
  // before the actual response. Find the first non-thought text part.
  const responseParts: Array<{ text?: string; thought?: boolean }> =
    data.candidates?.[0]?.content?.parts ?? [];
  const textPart = responseParts.find((p) => !p.thought && p.text);
  const text = textPart?.text;
  if (!text) throw new Error("No text response from Gemini API");
  return text;
}

// --- Unified caller ---

async function callProvider(
  provider: Provider,
  apiKey: string,
  system: string,
  userContent: Array<Record<string, any>>,
  maxTokens: number
): Promise<string> {
  switch (provider) {
    case "anthropic": return callAnthropic(apiKey, system, userContent, maxTokens);
    case "openai": return callOpenAI(apiKey, system, userContent, maxTokens);
    case "gemini": return callGemini(apiKey, system, userContent, maxTokens);
  }
}

// --- JSON extraction ---

function extractJSON(text: string): any {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/, "");
  // Find the first [ and last ] to extract the JSON array
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");

  // If no JSON array found at all, the model returned plain text
  if (start === -1) {
    throw new Error(cleaned.length > 120
      ? cleaned.slice(0, 120) + "..."
      : cleaned);
  }
  if (start !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  // Fix common JSON issues from LLM responses:
  // - Newlines inside string values (unterminated strings)
  // - Smart quotes
  cleaned = cleaned
    .replace(/[\u201C\u201D]/g, '"')  // smart double quotes
    .replace(/[\u2018\u2019]/g, "'"); // smart single quotes

  try {
    return JSON.parse(cleaned);
  } catch {
    // If parsing fails, try fixing unescaped newlines inside strings
    const fixed = cleaned.replace(/"([^"]*)"/g, (_match, content) => {
      return '"' + content.replace(/\n/g, " ").replace(/\r/g, "") + '"';
    });
    try {
      return JSON.parse(fixed);
    } catch {
      // If still failing, the response was likely truncated — try to salvage partial array
      const partial = fixed.replace(/,\s*[^}\]]*$/, ""); // remove trailing incomplete item
      const closedArray = partial.endsWith("]") ? partial : partial + "]";
      try {
        return JSON.parse(closedArray);
      } catch (e) {
        throw new Error(`Failed to parse AI response: ${(e as Error).message}. Response preview: ${text.slice(0, 200)}...`);
      }
    }
  }
}

// --- Public API ---

export async function runDesignCritique(
  apiKey: string,
  pageUrl: string,
  screenshotDataUrl: string,
  provider: Provider = "anthropic"
): Promise<AISuggestion[]> {
  const match = screenshotDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid screenshot data URL");
  const [, mediaType, base64Data] = match;

  const system =
    "You are a design critic. Analyze the screenshot and return ONLY a valid JSON array, no markdown, no explanation. Keep messages short (under 100 chars). Return up to 15 issues.";

  const userContent = [
    {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64Data },
    },
    {
      type: "text",
      text: `Analyze this webpage at ${pageUrl}. Return ONLY a JSON array (no code fences, no markdown). Each object: {"selector": "CSS selector", "category": "spacing|color|typography|alignment|contrast|general", "severity": "info|warning|error", "message": "short description", "suggestedChanges": [{"property": "css-prop", "value": "css-value"}]}. Up to 15 items. Keep messages brief.`,
    },
  ];

  const responseText = await callProvider(provider, apiKey, system, userContent, 8000);
  return extractJSON(responseText) as AISuggestion[];
}

export async function runNLEdit(
  apiKey: string,
  instruction: string,
  selector: string,
  computedStyles: Record<string, string>,
  provider: Provider = "anthropic"
): Promise<Array<{ property: string; value: string }>> {
  const system =
    "You are a CSS expert. Given an element's current styles and a natural language instruction, return the CSS property changes needed. ALWAYS return ONLY a valid JSON array of {\"property\": \"css-property\", \"value\": \"css-value\"} objects. No explanations, no markdown, no text. If you cannot determine changes, return an empty array [].";

  const userContent = [
    {
      type: "text",
      text: `Element: ${selector}\nCurrent styles: ${JSON.stringify(computedStyles)}\nInstruction: ${instruction}\n\nReturn ONLY a JSON array. If unsure, return [].`,
    },
  ];

  const responseText = await callProvider(provider, apiKey, system, userContent, 1000);
  return extractJSON(responseText) as Array<{ property: string; value: string }>;
}
