// ─── AI Provider Types & Registry ───
// The AI layer is fully swappable. Add new providers by implementing the AIProvider interface.

import type { AIProvider, AIProviderConfig, ClassificationResult, Orbit } from "@/types";

// ─── Gravitational Scoring Engine ───
// Each orbit has "gravity" — a multi-factor pull that determines
// how strongly an entry is attracted to that orbit.

interface GravityScore { keyword: number; count: number; length: number; recency: number; name: number; semantic: number }

/**
 * Calculate how strongly an entry is pulled toward each orbit.
 * Blends AI semantic understanding (50%) with mechanical signals (50%).
 * 
 * @param content - The entry text
 * @param orbits - All existing orbits
 * @param aiRelevance - AI's semantic relevance scores by orbit ID (0-1). This is the "meaning" layer.
 */
export async function calculateOrbitGravity(
  content: string,
  orbits: Orbit[],
  aiRelevance?: Record<string, number>
): Promise<{ orbit: Orbit; score: number; factors: GravityScore }[]> {
  const { OrbitEntryCache } = await import("@/lib/cache");
  const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
  const wordSet = new Set(words);
  const entryLen = words.length;
  const results: { orbit: Orbit; score: number; factors: GravityScore }[] = [];

  for (const orbit of orbits) {
    // Use cache — avoids N DB calls per classification
    let orbitEntries = OrbitEntryCache.get(orbit.id);
    if (!orbitEntries) {
      try { const { getEntriesByOrbit } = await import("@/lib/db"); orbitEntries = await getEntriesByOrbit(orbit.id); OrbitEntryCache.set(orbit.id, orbitEntries); } catch { orbitEntries = []; }
    }
    orbitEntries = orbitEntries.slice(0, 20);

    // ─── Mechanical factors ───
    let kw = 0;
    if (orbitEntries.length > 0) {
      const ow = new Set(orbitEntries.flatMap(e => e.content.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)).filter(w => w.length > 2));
      const inter = [...wordSet].filter(w => ow.has(w)).length;
      kw = Math.min(1, (inter / Math.max(1, Math.sqrt(ow.size))) * 3);
    }

    const count = Math.min(1, orbit.entryCount / 20);

    let len = 0;
    if (orbitEntries.length > 0) {
      const avg = orbitEntries.reduce((s, e) => s + e.wordCount, 0) / orbitEntries.length;
      len = 1 - Math.min(1, Math.abs(entryLen - avg) / Math.max(entryLen, avg));
    }

    const days = (Date.now() - orbit.lastActiveAt) / 86400000;
    const recency = Math.max(0, 1 - days / 30);

    const nw = orbit.name.toLowerCase().split(/\s+/);
    const nm = Math.min(1, (nw.filter(w => wordSet.has(w)).length / Math.max(1, nw.length)) * 2);

    // ─── AI semantic factor (MEANING) ───
    const semantic = aiRelevance?.[orbit.id] ?? 0;

    // Blend: 50% meaning, 50% mechanical (redistributed)
    const score = semantic * 0.50 + kw * 0.20 + count * 0.10 + len * 0.05 + recency * 0.10 + nm * 0.05;
    results.push({ orbit, score, factors: { keyword: kw, count, length: len, recency, name: nm, semantic } });
  }
  return results.sort((a, b) => b.score - a.score);
}

// We need db functions but must avoid circular imports — import inline
async function classifyAndRoute(
  entryId: string,
  content: string,
  provider: AIProvider,
  existingOrbits: Orbit[],
  onNewPattern?: (name: string, confidence: number) => Promise<boolean>
): Promise<ClassificationResult> {
  const { updateEntryStatus, createOrbit } = await import("@/lib/db");
  
  let result: ClassificationResult;
  try {
    result = await provider.classify(content, existingOrbits, []);
  } catch {
    return { type: "unclassified", confidence: 0 };
  }

  if (result.type === "existing_pattern" && result.orbitId) {
    // Confidence threshold: if AI isn't sure, treat as new pattern
    if (result.confidence < 0.75 && result.orbitName) {
      if (onNewPattern) {
        const approved = await onNewPattern(result.orbitName + " (uncertain)", result.confidence);
        if (!approved) { await updateEntryStatus(entryId, "unclassified", null); return { type: "unclassified", confidence: 0 }; }
      }
    }
    await updateEntryStatus(entryId, "classified", result.orbitId);
  } else if (result.type === "new_pattern" && result.orbitName) {
    if (onNewPattern) {
      const approved = await onNewPattern(result.orbitName, result.confidence);
      if (approved) {
        const orbit = await createOrbit(result.orbitName, false);
        await updateEntryStatus(entryId, "classified", orbit.id);
        return { ...result, type: "existing_pattern", orbitId: orbit.id, orbitName: orbit.name };
      }
    } else {
      const orbit = await createOrbit(result.orbitName, false);
      await updateEntryStatus(entryId, "classified", orbit.id);
      return { ...result, type: "existing_pattern", orbitId: orbit.id, orbitName: orbit.name };
    }
    await updateEntryStatus(entryId, "unclassified", null);
  } else {
    await updateEntryStatus(entryId, "unclassified", null);
  }

  return result;
}

/** Classify a single entry from the Nest — usable from any component */
export async function classifyNestEntry(entryId: string, content: string): Promise<ClassificationResult> {
  const config = loadAIConfig();
  const provider = createAIProvider(config);
  const { getAllOrbits } = await import("@/lib/db");
  const orbits = await getAllOrbits();
  return classifyAndRoute(entryId, content, provider, orbits);
}

// ─── Settings ───

const noOpProvider: AIProvider = {
  async classify(): Promise<ClassificationResult> {
    return { type: "unclassified", confidence: 0 };
  },
};

// ─── LLM Provider (DeepSeek, OpenAI, or any OpenAI-compatible API) ───

function createLLMProvider(config: AIProviderConfig): AIProvider {
  const apiKey = config.apiKey || "";
  const model = config.model || "deepseek-v4-flash";
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
              { role: "system", content: "You are Gravity. You MUST respond with ONLY a single JSON object. No markdown, no explanation, no reasoning. Just JSON." },
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
        const choice = data.choices?.[0]?.message;
        const raw = choice?.content || choice?.reasoning_content || "";
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
  // Fallback: use env variable for DeepSeek key
  const envKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
  if (envKey) return { provider: "deepseek", apiKey: envKey };
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

/** Quick keyword pre-filter: narrow to top 5 candidate orbits before AI call */
function filterCandidateOrbits(text: string, orbits: Orbit[]): Orbit[] {
  if (orbits.length <= 5) return orbits;
  const words = new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2));
  const scored = orbits.map(o => {
    const nameWords = o.name.toLowerCase().split(/\s+/);
    const hits = nameWords.filter(w => words.has(w)).length;
    return { orbit: o, score: hits / Math.max(1, nameWords.length) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(s => s.orbit);
}

/**
 * Builds a classification prompt from user text and known spaces.
 * The prompt is designed to be provider-agnostic.
 */
export function buildClassificationPrompt(
  text: string,
  existingOrbits: Orbit[]
): string {
  // Narrow to top candidates for faster, more accurate classification
  const candidates = filterCandidateOrbits(text, existingOrbits);

  if (candidates.length === 0) {
    return `You are Gravity, an AI that organizes thoughts into precise semantic orbits.

A user has written their first entry. Suggest a SPECIFIC, descriptive orbit name (2-3 words max).

USER TEXT:
"""
${text.slice(0, 2000)}
"""

Respond with ONLY a JSON object:
{
  "type": "new_pattern",
  "name": "Specific Orbit Name",
  "confidence": 0.0-1.0
}`;
  }

  const orbitList = candidates
    .map((s) => `- "${s.name}"`)
    .join("\n");

  return `You are Gravity, an AI that organizes thoughts into precise, specific orbits.

CRITICAL RULES — READ CAREFULLY:
1. Only match to an existing orbit if the text discusses the EXACT SAME specific concept.
2. "Black holes / spacetime physics" is NOT the same as "Space exploration".
3. "Transformer architectures" is NOT the same as "Machine learning".
4. "Pasta recipes" is NOT the same as "Italian cooking".
5. If the text introduces a DIFFERENT angle, sub-topic, or perspective from existing orbits, suggest a NEW orbit.
6. Prefer creating too many specific orbits over lumping different ideas together.
7. A vague orbit is worse than a new specific one.
8. ONE SHARED WORD does NOT make a match. "Python libraries for medical data" is NOT healthcare AI — it's developer tooling.
9. Identify the PRIMARY subject of the text, not tangential mentions. If the primary subject is new, use new_pattern.

CONFIDENCE GUIDE:
- 0.9-1.0: Exact same primary subject and angle
- 0.7-0.8: Related but different primary subject → use new_pattern
- Below 0.7: Different topic → new_pattern

EXISTING ORBITS:
${orbitList}

USER TEXT:
"""
${text.slice(0, 2000)}
"""

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "type": "existing_pattern" | "new_pattern",
  "orbitName": "exact match from list" (for existing) | "Specific Name (2-3 words)" (for new),
  "confidence": 0.0-1.0,
  "orbitRelevance": { ${candidates.map(o => `"${o.name}": 0.0-1.0`).join(", ")} }
}

For orbitRelevance: rate EVERY orbit above by SEMANTIC meaning match to the text (0.0 = completely unrelated, 1.0 = perfect conceptual match). This is about meaning, not keyword overlap.`;
}

/**
 * Robust JSON extraction from messy AI responses.
 * Handles: markdown code blocks, trailing commas, unquoted keys, leading/trailing text.
 */
function extractJSON(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;

  // 1. Try direct parse (clean JSON)
  try { return JSON.parse(raw.trim()); } catch {}

  // 2. Strip markdown code blocks
  const cleaned = raw.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1").trim();

  // 3. Try to find JSON object in the text
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
    // Fix common issues: trailing commas, single quotes
    const fixed = objMatch[0]
      .replace(/,\s*}/g, "}")           // trailing comma before }
      .replace(/,\s*]/g, "]")           // trailing comma before ]
      .replace(/'/g, '"')               // single quotes → double quotes
      .replace(/(\w+):/g, '"$1":');     // unquoted keys → quoted
    try { return JSON.parse(fixed); } catch {}
  }

  // 4. Try array format
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { const arr = JSON.parse(arrMatch[0]); return { scores: arr }; } catch {}
  }

  return null;
}

/**
 * Parse the LLM response into a ClassificationResult.
 * Handles messy LLM outputs gracefully.
 */
export function parseClassificationResponse(
  raw: string,
  existingOrbits: Orbit[]
): ClassificationResult {
  const parsed = extractJSON(raw);
  if (!parsed) return { type: "unclassified", confidence: 0 };

  try {
    // Extract AI semantic relevance scores for all orbits (meaning-based, not keyword)
    const orbitRelevance: Record<string, number> = {};
    if (parsed.orbitRelevance && typeof parsed.orbitRelevance === "object") {
      for (const orbit of existingOrbits) {
        const score = (parsed.orbitRelevance as Record<string, number>)[orbit.name];
        if (typeof score === "number" && score >= 0 && score <= 1) {
          orbitRelevance[orbit.id] = score;
        }
      }
    }

    if (parsed.type === "existing_pattern" && parsed.orbitName) {
      const orbit = existingOrbits.find(
        (s) => s.name.toLowerCase() === String(parsed.orbitName).toLowerCase()
      );
      if (orbit) {
        return {
          type: "existing_pattern",
          orbitId: orbit.id,
          orbitName: orbit.name,
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
          orbitRelevance: Object.keys(orbitRelevance).length > 0 ? orbitRelevance : undefined,
        };
      }
    }

    if (parsed.type === "new_pattern" && parsed.name) {
      return {
        type: "new_pattern",
        orbitName: String(parsed.name),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        orbitRelevance: Object.keys(orbitRelevance).length > 0 ? orbitRelevance : undefined,
      };
    }

    return { type: "unclassified", confidence: 0 };
  } catch {
    return { type: "unclassified", confidence: 0 };
  }
}

/**
 * Score how well each entry fits within its own orbit.
 * Returns relevance scores 0-1 for each entry:
 *   ≥ 0.8 = core (directly about the orbit theme)
 *   0.5-0.79 = peripheral (tangentially related)
 *   < 0.5 = misfit (probably belongs elsewhere)
 * 
 * Makes ONE AI call for the entire batch — efficient.
 */
export async function scoreEntriesInOrbit(
  orbitName: string,
  entries: { id: string; content: string }[],
  orbitId?: string
): Promise<{ id: string; score: number }[]> {
  if (entries.length === 0) return [];

  // Check cache first
  if (orbitId) {
    const { RelevanceCache } = await import("@/lib/cache");
    const cached = RelevanceCache.get(orbitId);
    if (cached) {
      return entries.map(e => ({ id: e.id, score: cached[e.id] ?? 0.5 }));
    }
  }

  const config = loadAIConfig();
  if (!config.apiKey) return entries.map(e => ({ id: e.id, score: 0.5 }));

  const entryList = entries.map((e, i) => `[${i}] ${e.content.slice(0, 200)}`).join("\n\n");

  const prompt = `You are evaluating how well each entry fits the orbit "${orbitName}".

Rate each entry's relevance to "${orbitName}" on a scale of 0.0 to 1.0:
- 0.8-1.0: CORE — directly about ${orbitName}, same subject, same angle
- 0.5-0.79: PERIPHERAL — tangentially related, shares some concepts but different focus
- 0.0-0.49: MISFIT — probably belongs in a different orbit, only superficial connection

ENTRIES:
${entryList}

Respond with ONLY a JSON array of scores in the same order:
[0.95, 0.6, 0.3, ...]`;

  try {
    const response = await fetch(`${config.baseUrl || "https://api.deepseek.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model || "deepseek-v4-flash",
        messages: [
          { role: "system", content: "Respond with ONLY a JSON array of numbers. No explanation." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });

    if (!response.ok) return entries.map(e => ({ id: e.id, score: 0.5 }));
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(raw);
    if (!parsed) return entries.map(e => ({ id: e.id, score: 0.5 }));

    // Handle both array [0.9, 0.5, ...] and object {scores: [...]}
    const scores: number[] = Array.isArray(parsed) ? parsed : (parsed as Record<string,unknown>).scores as number[] || [];
    if (!Array.isArray(scores) || scores.length === 0) return entries.map(e => ({ id: e.id, score: 0.5 }));

    const result = entries.map((e, i) => ({ id: e.id, score: typeof scores[i] === "number" ? scores[i] : 0.5 }));

    // Save to cache
    if (orbitId) {
      const { RelevanceCache } = await import("@/lib/cache");
      RelevanceCache.set(orbitId, Object.fromEntries(result.map(r => [r.id, r.score])));
    }
    return result;
  } catch {
    return entries.map(e => ({ id: e.id, score: 0.5 }));
  }
}

/**
 * Auto-detect sub-orbits within an orbit. When an orbit has enough entries,
 * the AI identifies natural clusters and returns sub-orbit groupings.
 * Called automatically by the engine after classification.
 * 
 * Returns null if no sub-orbits are needed, or an array of { name, color, entryIds }.
 */
export async function detectSubOrbits(
  orbitName: string,
  entries: { id: string; content: string }[]
): Promise<{ name: string; color: string; entryIds: string[] }[] | null> {
  if (entries.length < 6) return null; // Not enough entries to form clusters

  const config = loadAIConfig();
  if (!config.apiKey) return null;

  const entryList = entries.map((e, i) => `[${i}] ${e.content.slice(0, 150)}`).join("\n");

  const prompt = `Analyze these entries in the orbit "${orbitName}". Identify natural sub-groups (2-4 groups).

Rules:
- Group entries by their PRIMARY subject, not tangential mentions
- Each group should have 2+ entries that are clearly about the same specific topic
- If entries are too diverse to group, return empty groups array
- Sub-group names should be short (2-3 words), more specific than the parent orbit

ENTRIES:
${entryList}

Respond with ONLY JSON:
{
  "groups": [
    { "name": "Sub-group Name", "entryIndices": [0, 3, 5] }
  ]
}

If no clear sub-groups exist: { "groups": [] }`;

  try {
    const response = await fetch(`${config.baseUrl || "https://api.deepseek.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model || "deepseek-v4-flash",
        messages: [
          { role: "system", content: "Respond with ONLY JSON. No markdown, no explanation." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (!parsed.groups || parsed.groups.length === 0) return null;

    const colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
    return parsed.groups.map((g: { name: string; entryIndices: number[] }, i: number) => ({
      name: g.name,
      color: colors[i % colors.length],
      entryIds: (g.entryIndices || []).map((idx: number) => entries[idx]?.id).filter(Boolean),
    }));
  } catch {
    return null;
  }
}

/**
 * Keyword-based fallback clustering. Used when AI sub-orbit detection fails.
 * Groups entries by shared significant words (not stop words).
 */
export function keywordCluster(
  entries: { id: string; content: string }[]
): { name: string; color: string; entryIds: string[] }[] | null {
  if (entries.length < 4) return null;

  const STOP = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","can","shall","to","of","in","for","on","with","at","by","from","as","into","through","during","before","after","above","below","between","out","off","up","down","about","than","then","now","just","also","very","too","so","if","but","or","and","not","no","yes","it","its","this","that","these","those","i","me","my","we","our","you","your","he","she","they","them","what","which","who","whom","when","where","why","how","all","each","every","both","few","more","most","other","some","such","only","own","same"]);

  // Extract significant words per entry (2+ chars, not stop words)
  const entryWords = entries.map(e => {
    const words = e.content.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
    return { id: e.id, words: new Set(words) };
  });

  // Find words that appear in 2+ entries
  const wordFreq = new Map<string, string[]>();
  for (const ew of entryWords) {
    for (const w of ew.words) {
      if (!wordFreq.has(w)) wordFreq.set(w, []);
      wordFreq.get(w)!.push(ew.id);
    }
  }

  // Pick top 3 shared words as cluster seeds
  const seeds = Array.from(wordFreq.entries())
    .filter(([, ids]) => ids.length >= 2 && ids.length < entries.length) // shared but not universal
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4);

  if (seeds.length < 2) return null;

  // Assign entries to nearest seed
  const groups = new Map<string, { name: string; ids: Set<string> }>();
  const assigned = new Set<string>();

  for (const [word, ids] of seeds) {
    const name = word.charAt(0).toUpperCase() + word.slice(1) + " Focus";
    groups.set(word, { name, ids: new Set() });
    for (const id of ids) {
      if (!assigned.has(id)) {
        groups.get(word)!.ids.add(id);
        assigned.add(id);
      }
    }
  }

  const colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b"];
  const result = Array.from(groups.values())
    .filter(g => g.ids.size >= 2)
    .map((g, i) => ({ name: g.name, color: colors[i % 4], entryIds: Array.from(g.ids) }));

  return result.length >= 2 ? result : null;
}
