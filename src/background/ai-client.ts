/**
 * AI client — calls Claude or OpenAI API to generate CSS/content changes
 * from natural language prompts. Runs in the background service worker
 * to avoid page CSP restrictions.
 */

interface AIRequest {
  prompt: string;
  elementHTML: string;
  computedStyles: Record<string, string>;
  selector: string;
}

interface AIResponse {
  styleChanges: Array<{ property: string; value: string }>;
  textContent?: string;
  explanation: string;
}

interface AISettings {
  provider: "claude" | "openai";
  apiKey: string;
  model: string;
}

const SYSTEM_PROMPT = `You are a CSS and web design expert. The user will describe a visual change they want to make to an HTML element. You will be given the element's HTML and its current computed CSS styles.

Return a JSON object with the changes to apply:

{
  "styleChanges": [
    { "property": "css-property-name", "value": "new-value" }
  ],
  "textContent": "new text content (only if the user wants to change text, otherwise omit this field)",
  "explanation": "Brief description of what was changed and why"
}

Rules:
- Only return valid CSS property/value pairs
- Use standard CSS property names (kebab-case)
- Values should be complete CSS values (include units like px, rem, etc.)
- Keep the explanation concise (one sentence)
- If the request is unclear, make a reasonable interpretation and explain your choice
- Do not include properties that don't need to change
- Return ONLY the JSON object, no markdown fences or other text`;

async function getSettings(): Promise<AISettings | null> {
  try {
    const result = await chrome.storage.sync.get(["aiProvider", "apiKey", "model"]);
    if (!result.apiKey) return null;
    return {
      provider: result.aiProvider || "claude",
      apiKey: result.apiKey,
      model: result.model || "claude-sonnet-4-20250514",
    };
  } catch {
    return null;
  }
}

export async function processAIRequest(request: AIRequest): Promise<AIResponse> {
  const settings = await getSettings();
  if (!settings) {
    throw new Error("AI not configured. Set your API key in Page Designer settings.");
  }

  // Trim computed styles to only non-default values
  const relevantStyles = Object.entries(request.computedStyles)
    .filter(([_, v]) => v && v !== "none" && v !== "normal" && v !== "auto" && v !== "0px" && v !== "rgba(0, 0, 0, 0)")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const userMessage = `Element: ${request.selector}

HTML (truncated):
${request.elementHTML.slice(0, 1500)}

Current styles:
${relevantStyles}

User request: ${request.prompt}`;

  if (settings.provider === "claude") {
    return callClaude(settings, userMessage);
  } else {
    return callOpenAI(settings, userMessage);
  }
}

async function callClaude(settings: AISettings, userMessage: string): Promise<AIResponse> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Empty response from Claude");

  return parseAIResponse(text);
}

async function callOpenAI(settings: AISettings, userMessage: string): Promise<AIResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI");

  return parseAIResponse(text);
}

function parseAIResponse(text: string): AIResponse {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      styleChanges: Array.isArray(parsed.styleChanges) ? parsed.styleChanges : [],
      textContent: parsed.textContent || undefined,
      explanation: parsed.explanation || "Changes applied",
    };
  } catch {
    throw new Error(`Failed to parse AI response: ${cleaned.slice(0, 200)}`);
  }
}
