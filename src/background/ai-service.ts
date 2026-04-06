/**
 * AI service — calls Anthropic API for design critique and NL edits.
 * Uses fetch() directly (no SDK) since this runs in a service worker.
 */

import type { AISuggestion } from "../shared/messages";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

async function callAnthropic(
  apiKey: string,
  system: string,
  userContent: Array<Record<string, any>>,
  maxTokens: number
): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
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
  if (!textBlock?.text) {
    throw new Error("No text response from Anthropic API");
  }
  return textBlock.text;
}

function extractJSON(text: string): any {
  // Try to find JSON array in the response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  // Try parsing the whole text
  return JSON.parse(text);
}

export async function runDesignCritique(
  apiKey: string,
  pageUrl: string,
  screenshotDataUrl: string
): Promise<AISuggestion[]> {
  // Extract base64 data and media type from data URL
  const match = screenshotDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid screenshot data URL");
  }
  const [, mediaType, base64Data] = match;

  const system =
    "You are a design critic analyzing a webpage screenshot. Identify design issues and suggest specific CSS fixes. Focus on: spacing inconsistencies, color contrast issues, typography problems, alignment errors. Return JSON array of suggestions.";

  const userContent = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Data,
      },
    },
    {
      type: "text",
      text: `Analyze this webpage at ${pageUrl} for design issues. Return a JSON array where each object has: selector (CSS selector of the element), category (spacing|color|typography|alignment|contrast|general), severity (info|warning|error), message (brief description), suggestedChanges (optional array of {property, value} CSS fixes).`,
    },
  ];

  const responseText = await callAnthropic(apiKey, system, userContent, 2000);
  return extractJSON(responseText) as AISuggestion[];
}

export async function runNLEdit(
  apiKey: string,
  instruction: string,
  selector: string,
  computedStyles: Record<string, string>
): Promise<Array<{ property: string; value: string }>> {
  const system =
    "You are a CSS expert. Given an element's current styles and a natural language instruction, return the CSS property changes needed. Return only a JSON array of {property, value} objects.";

  const userContent = [
    {
      type: "text",
      text: `Element: ${selector}\nCurrent styles: ${JSON.stringify(computedStyles)}\nInstruction: ${instruction}\n\nReturn a JSON array of CSS changes to apply.`,
    },
  ];

  const responseText = await callAnthropic(apiKey, system, userContent, 1000);
  return extractJSON(responseText) as Array<{ property: string; value: string }>;
}
