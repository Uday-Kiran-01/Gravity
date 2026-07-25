// ─── Dormant Idea Resurfacing Engine ───
// Gravity remembers old ideas and knows when to bring them back.
// Uses keyword overlap + basic semantic similarity for matching.

import type { Entry, Reminder } from "@/types";
import { getOldEntries } from "@/lib/db";

// ─── Text Preprocessing ───

/** Common English stop words to filter out */
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "out", "off", "up",
  "down", "about", "than", "then", "now", "just", "also", "very", "too",
  "so", "if", "but", "or", "and", "not", "no", "yes", "it", "its",
  "this", "that", "these", "those", "i", "me", "my", "we", "our", "you",
  "your", "he", "she", "they", "them", "what", "which", "who", "whom",
  "when", "where", "why", "how", "all", "each", "every", "both", "few",
  "more", "most", "other", "some", "such", "only", "own", "same",
]);

/** Extract meaningful keywords from text */
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Count frequency
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Return unique keywords sorted by frequency
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);
}

/** Calculate keyword overlap (dice coefficient): more lenient than Jaccard */
function diceSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  if (setA.size + setB.size === 0) return 0;
  return (2 * intersection.size) / (setA.size + setB.size);
}

// ─── Resurfacing Logic ───

interface ResurfaceMatch {
  oldEntry: Entry;
  similarity: number;
  matchedKeywords: string[];
  age: number; // in days
}

/**
 * Find old entries that are semantically related to a new entry.
 * Requirements for resurfacing:
 * - Old entry is at least 7 days old (not "dormant" otherwise)
 * - Old entry is not in the same space (different topic area)
 * - Similarity exceeds threshold
 * - Old entry is not already the subject of an active reminder
 */
export async function findDormantIdeas(
  newEntry: Entry,
  threshold = 0.15
): Promise<ResurfaceMatch[]> {
  const newKeywords = extractKeywords(newEntry.content);

  if (newKeywords.length < 3) return []; // Too little content for matching

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Get all old entries (at least 7 days old, not the same entry)
  const oldEntries = await getOldEntries(sevenDaysAgo);

  if (oldEntries.length === 0) return [];

  const matches: ResurfaceMatch[] = [];

  for (const oldEntry of oldEntries) {
    // Skip entries from the same orbit (likely same topic, not interesting to resurface)
    if (oldEntry.orbitId && oldEntry.orbitId === newEntry.orbitId) continue;

    const oldKeywords = extractKeywords(oldEntry.content);

    if (oldKeywords.length < 3) continue;

    const similarity = diceSimilarity(newKeywords, oldKeywords);

    if (similarity >= threshold) {
      const matchedKeywords = Array.from(
        new Set(
          [...newKeywords].filter((k) =>
            oldKeywords.some((ok) => ok.includes(k) || k.includes(ok))
          )
        )
      ).slice(0, 5);

      matches.push({
        oldEntry,
        similarity,
        matchedKeywords,
        age: Math.round((now - oldEntry.createdAt) / (24 * 60 * 60 * 1000)),
      });
    }
  }

  // Sort by similarity (highest first), then by age (older first)
  matches.sort((a, b) => {
    const simDiff = b.similarity - a.similarity;
    if (Math.abs(simDiff) > 0.05) return simDiff;
    return b.age - a.age;
  });

  // Return top 3 matches
  return matches.slice(0, 3);
}

/**
 * Build a resurface reminder from a dormant idea match.
 */
export function buildResurfaceReminder(
  match: ResurfaceMatch,
  _newEntryId: string
): Omit<Reminder, "id" | "createdAt" | "shownAt" | "dismissedAt"> {
  const excerpt =
    match.oldEntry.content.length > 120
      ? match.oldEntry.content.slice(0, 117) + "..."
      : match.oldEntry.content;

  const ageText =
    match.age < 30
      ? `${match.age} days ago`
      : match.age < 365
        ? `${Math.round(match.age / 30)} months ago`
        : `${Math.round(match.age / 365)} years ago`;

  return {
    entryId: match.oldEntry.id,
    type: "resurface",
    title: `You had a similar idea ${ageText}`,
    description: excerpt,
    targetDate: null,
    detectedDate: null,
    orbitId: match.oldEntry.orbitId,
    status: "pending",
  };
}
