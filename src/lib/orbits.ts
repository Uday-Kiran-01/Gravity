// ─── Orbits Management ───
// Utility functions for working with the Orbit ecosystem.

import type { Orbit, Entry } from "@/types";
import { getAllOrbits, getEntriesByOrbit } from "./db";

/** Get orbits with their entries (heavy — used only for detail views) */
export async function getActiveOrbits(): Promise<
  (Orbit & { entries: Entry[] })[]
> {
  const orbits = await getAllOrbits();
  const result = await Promise.all(
    orbits.map(async (orbit) => {
      const entries = await getEntriesByOrbit(orbit.id);
      return { ...orbit, entries };
    })
  );
  return result;
}

/** Get orbit metadata only — no entries loaded. Fast, for listing pages. */
export async function getOrbitSummaries(): Promise<Orbit[]> {
  return getAllOrbits();
}

/** Build a tree structure from flat orbits (for future hierarchy visualization) */
export interface OrbitTreeNode {
  orbit: Orbit;
  children: OrbitTreeNode[];
}

export function buildOrbitTree(orbits: Orbit[]): OrbitTreeNode[] {
  const map = new Map<string, OrbitTreeNode>();
  const roots: OrbitTreeNode[] = [];

  // Create nodes
  for (const orbit of orbits) {
    map.set(orbit.id, { orbit, children: [] });
  }

  // Build tree
  for (const orbit of orbits) {
    const node = map.get(orbit.id)!;
    if (orbit.parentOrbitId && map.has(orbit.parentOrbitId)) {
      map.get(orbit.parentOrbitId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by last active
  for (const [, node] of map) {
    node.children.sort(
      (a, b) => b.orbit.lastActiveAt - a.orbit.lastActiveAt
    );
  }

  return roots.sort((a, b) => b.orbit.lastActiveAt - a.orbit.lastActiveAt);
}

/** Auto-generate description for an orbit based on its entries */
export function generateOrbitDescription(entries: Entry[]): string {
  if (entries.length === 0) return "No entries yet.";
  const wordCounts = entries.map((e) => e.wordCount);
  const total = wordCounts.reduce((a, b) => a + b, 0);
  const avg = Math.round(total / entries.length);
  return `${entries.length} entries · ~${avg} words avg · ${total} total words`;
}
