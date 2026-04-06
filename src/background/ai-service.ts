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
      model: "claude-sonnet-4-20250514",  // Latest Claude Sonnet
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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
  // Remove ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/, "");
  // Find the first [ and last ] to extract the JSON array
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }
  return JSON.parse(cleaned);
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
    "You are a design critic analyzing a webpage screenshot. Identify design issues and suggest specific CSS fixes. Focus on: spacing inconsistencies, color contrast issues, typography problems, alignment errors. Return JSON array of suggestions.";

  const userContent = [
    {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64Data },
    },
    {
      type: "text",
      text: `Analyze this webpage at ${pageUrl} for design issues. Return a JSON array where each object has: selector (CSS selector of the element), category (spacing|color|typography|alignment|contrast|general), severity (info|warning|error), message (brief description), suggestedChanges (optional array of {property, value} CSS fixes).`,
    },
  ];

  const responseText = await callProvider(provider, apiKey, system, userContent, 2000);
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
    "You are a CSS expert. Given an element's current styles and a natural language instruction, return the CSS property changes needed. Return only a JSON array of {property, value} objects.";

  const userContent = [
    {
      type: "text",
      text: `Element: ${selector}\nCurrent styles: ${JSON.stringify(computedStyles)}\nInstruction: ${instruction}\n\nReturn a JSON array of CSS changes to apply.`,
    },
  ];

  const responseText = await callProvider(provider, apiKey, system, userContent, 1000);
  return extractJSON(responseText) as Array<{ property: string; value: string }>;
}
