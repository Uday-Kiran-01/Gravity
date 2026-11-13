// ─── Gravity Cache Layer ───
// In-memory caches to eliminate redundant DB and AI calls.

import type { Entry } from "@/types";

// ─── Orbit Entry Cache ───
// Pre-fetches entries for all orbits. Used by calculateOrbitGravity
// to avoid N DB calls per classification.

interface CacheEntry<T> { data: T; ts: number; }
const TTL = 30_000; // 30 seconds

export class OrbitEntryCache {
  private static cache = new Map<string, CacheEntry<Entry[]>>();

  static get(orbitId: string): Entry[] | null {
    const c = this.cache.get(orbitId);
    if (c && Date.now() - c.ts < TTL) return c.data;
    this.cache.delete(orbitId);
    return null;
  }

  static set(orbitId: string, entries: Entry[]): void {
    this.cache.set(orbitId, { data: entries, ts: Date.now() });
  }

  /** Pre-fetch all orbit entries in parallel — call once per classification cycle */
  static async warm(orbits: { id: string }[]): Promise<void> {
    const { getEntriesByOrbit } = await import("@/lib/db");
    await Promise.all(orbits.map(async (o) => {
      if (!this.get(o.id)) {
        try { this.set(o.id, await getEntriesByOrbit(o.id)); } catch {}
      }
    }));
  }

  static clear(): void { this.cache.clear(); }
}

// ─── Relevance Score Cache ───
// Caches entry relevance scores per orbit to avoid re-calling AI on every page view.

export class RelevanceCache {
  private static cache = new Map<string, CacheEntry<Record<string, number>>>();
  private static TTL = 5 * 60_000; // 5 minutes

  static get(orbitId: string): Record<string, number> | null {
    const c = this.cache.get(orbitId);
    if (c && Date.now() - c.ts < this.TTL) return c.data;
    this.cache.delete(orbitId);
    return null;
  }

  static set(orbitId: string, scores: Record<string, number>): void {
    this.cache.set(orbitId, { data: scores, ts: Date.now() });
  }

  static invalidate(orbitId: string): void { this.cache.delete(orbitId); }
  static clear(): void { this.cache.clear(); }
}

// ─── Content Hash ───
// Fast pre-filter for duplicate detection. Avoids full DB scan.

export function contentHash(content: string): string {
  // Simple rolling hash of first 100 chars — fast, good enough for pre-filter
  let h = 0;
  const s = content.slice(0, 100).toLowerCase().replace(/\s+/g, " ");
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0; // Convert to 32bit integer
  }
  return h.toString(36);
}
