// ─── AI Provider Types & Registry ───
// The AI layer is fully swappable. Add new providers by implementing the AIProvider interface.

import type { AIProvider, AIProviderConfig, ClassificationResult, Orbit } from "@/types";

// ─── No-Op Provider (default: no AI, all entries stay unclassified) ───

const noOpProvider: AIProvider = {
  async classify(): Promise<ClassificationResult> {
    return { type: "unclassified", confidence: 0 };
  },
};

// ─── LLM Provider (DeepSeek, OpenAI, or any OpenAI-compatible API) ───

function createLLMProvider(config: AIProviderConfig): AIProvider {
  const apiKey = config.apiKey || "";
  const model = config.model || "deepseek-chat";
  const baseUrl = config.baseUrl || "https://api.deepseek.com/v1";

  return {
    async classify(
      text: string,
      existingOrbits: Orbit[]
    ): Promise<ClassificationResult> {
      if (!apiKey) return { type: "unclassified", confidence: 0 };

      const prompt = buildClassificationPrompt(text, existingOrbits);

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "You are Gravity, an AI that classifies thoughts into semantic orbits. Respond with ONLY valid JSON, no markdown, no explanation." },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 200,
          }),
        });

        if (!response.ok) {
          console.error("LLM API error:", response.status, await response.text());
          return { type: "unclassified", confidence: 0 };
        }

        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content || "";
        return parseClassificationResponse(raw, existingOrbits);
      } catch (error) {
        console.error("LLM call failed:", error);
        return { type: "unclassified", confidence: 0 };
      }
    },
  };
}

// ─── Settings ───

const SETTINGS_KEY = "gravity_ai_config";

export function loadAIConfig(): AIProviderConfig {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { provider: "none" };
}

export function saveAIConfig(config: AIProviderConfig): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
}

// ─── Provider Factory ───

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case "openai":
    case "openrouter":
    case "ollama":
    case "deepseek":
      return createLLMProvider(config);
    case "none":
    default:
      return noOpProvider;
  }
}

// ─── Classification Engine ───

/**
 * Builds a classification prompt from user text and known spaces.
 * The prompt is designed to be provider-agnostic.
 */
export function buildClassificationPrompt(
  text: string,
  existingOrbits: Orbit[]
): string {
  if (existingOrbits.length === 0) {
    return `You are Gravity, an AI that organizes thoughts into semantic orbits.

A user has written their first entry. Based on the content, suggest a name for a new Orbit.

USER TEXT:
"""
${text.slice(0, 2000)}
"""

Respond with ONLY a JSON object:
{
  "type": "new_pattern",
  "name": "Suggested Orbit Name",
  "confidence": 0.0-1.0
}`;
  }

  const orbitList = existingOrbits
    .map((s) => `- "${s.name}"`)
    .join("\n");

  return `You are Gravity, an AI that organizes thoughts into semantic orbits.

EXISTING ORBITS:
${orbitList}

USER TEXT:
"""
${text.slice(0, 2000)}
"""

Determine if this text belongs to an existing Orbit or represents a new pattern.

Respond with ONLY a JSON object:
- If it matches an existing orbit: {"type": "existing_pattern", "orbitName": "exact orbit name from the list", "confidence": 0.0-1.0}
- If it's a new pattern: {"type": "new_pattern", "name": "Suggested Orbit Name", "confidence": 0.0-1.0}`;
}

/**
 * Parse the LLM response into a ClassificationResult.
 * Handles messy LLM outputs gracefully.
 */
export function parseClassificationResponse(
  raw: string,
  existingOrbits: Orbit[]
): ClassificationResult {
  try {
    // Try to extract JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { type: "unclassified", confidence: 0 };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.type === "existing_pattern" && parsed.orbitName) {
      const orbit = existingOrbits.find(
        (s) => s.name.toLowerCase() === parsed.orbitName.toLowerCase()
      );
      if (orbit) {
        return {
          type: "existing_pattern",
          orbitId: orbit.id,
          orbitName: orbit.name,
          confidence: parsed.confidence ?? 0.5,
        };
      }
    }

    if (parsed.type === "new_pattern" && parsed.name) {
      return {
        type: "new_pattern",
        orbitName: parsed.name,
        confidence: parsed.confidence ?? 0.5,
      };
    }

    return { type: "unclassified", confidence: 0 };
  } catch {
    return { type: "unclassified", confidence: 0 };
  }
}
