// ─── Gravity Engine ───
// The core intelligence layer. Watches for typing pauses, classifies entries,
// and manages the lifecycle of thoughts.

import type { Entry, ClassificationResult, Reminder } from "@/types";
import type { AIProvider } from "@/types";
import {
  updateEntryStatus,
  createOrbit,
  getAllOrbits,
  getEntriesByOrbit,
  addReminder,
  hasActiveReminderForEntry,
} from "./db";
import { detectReminders } from "./reminders/detector";
import { findDormantIdeas, buildResurfaceReminder, checkDuplicates } from "./reminders/resurface";
import { calculateOrbitGravity, detectSubOrbits, keywordCluster } from "./ai/classifier";
import { OrbitEntryCache, contentHash } from "./cache";

type EngineState = "idle" | "typing" | "waiting" | "processing" | "done";
export type { EngineState };

interface EngineCallbacks {
  onClassified: (result: ClassificationResult) => void;
  onNewPattern: (spaceName: string, confidence: number) => Promise<boolean>;
  onReminderDetected?: (reminder: Reminder) => void;
  onStateChange?: (state: EngineState) => void;
  onError?: (message: string) => void;
  onDuplicateDetected?: (existingContent: string, orbitName: string | null, similarity: number, existingEntryId: string, existingOrbitId: string | null) => Promise<boolean>;
}

export interface OrgSuggestion {
  orbitId: string;
  orbitName: string;
  groups: { name: string; entryIds: string[]; entryPreviews: string[] }[];
}

export class GravityEngine {
  private aiProvider: AIProvider;
  private callbacks: EngineCallbacks;
  private state: EngineState = "idle";
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivity = Date.now();
  private readonly IDLE_THRESHOLD_MS = 60 * 1000; // 1 minute
  private currentEntry: Entry | null = null;

  constructor(aiProvider: AIProvider, callbacks: EngineCallbacks) {
    this.aiProvider = aiProvider;
    this.callbacks = callbacks;
  }

  getState(): EngineState {
    return this.state;
  }

  /** Call this when the user starts typing or edits content */
  onUserActivity(entry: Entry): void {
    this.currentEntry = entry;
    this.lastActivity = Date.now();
    this.setState("typing");
    this.resetIdleTimer();
  }

  /** Called when the Landfill detects user has been idle for 5 minutes */
  onUserIdle(): void {
    this.setState("waiting");
    this.clearIdleTimer();
    this.processCurrentEntry();
  }

  /** Force-process the current entry immediately */
  async forceProcess(entry: Entry): Promise<void> {
    this.currentEntry = entry;
    this.clearIdleTimer();
    await this.processCurrentEntry();
  }

  /** Update the AI provider (e.g., when user configures an API key) */
  setAIProvider(provider: AIProvider): void {
    this.aiProvider = provider;
  }

  /** Clean up timers */
  destroy(): void {
    this.clearIdleTimer();
  }

  /** Manually trigger orbit organization - called when user clicks Re-organize */
  async organizeOrbit(orbitId: string): Promise<void> {
    try {
      const entries = await getEntriesByOrbit(orbitId);
      if (entries.length < 6) return;

      const allOrbits = await getAllOrbits();
      const hasChildren = allOrbits.some(o => o.parentOrbitId === orbitId);
      if (hasChildren) return;

      const orbit = allOrbits.find(o => o.id === orbitId);
      if (!orbit) return;

      let groups = await detectSubOrbits(orbit.name, entries.map(e => ({ id: e.id, content: e.content })));
      if (!groups || groups.length === 0) {
        groups = keywordCluster(entries.map(e => ({ id: e.id, content: e.content })));
      }
      if (!groups || groups.length < 2) return;

      for (const group of groups.filter(g => g.entryIds.length >= 2)) {
        const subOrbit = await createOrbit(group.name, true, orbitId);
        const { updateOrbit } = await import("./db");
        await updateOrbit(subOrbit.id, { color: group.color });
        for (const entryId of group.entryIds) {
          await updateEntryStatus(entryId, "classified", subOrbit.id);
        }
      }
      console.log(`[Gravity] Organized "${orbit.name}" → ${groups.length} sub-orbits`);
    } catch (e) {
      console.error("[Gravity] Organization failed:", e);
    }
  }

  // ─── Private ───

  private setState(state: EngineState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private async processCurrentEntry(): Promise<void> {
    if (!this.currentEntry) return;
    if (this.currentEntry.content.trim().length === 0) return;

    this.setState("processing");

    try {
      const entry = this.currentEntry;
      const existingOrbits = await getAllOrbits();

      // Mark as processing
      await updateEntryStatus(entry.id, "processing");

      // ─── Duplicate Detection (with content hash pre-filter) ───
      const hash = contentHash(entry.content);
      const dup = hash ? await checkDuplicates(entry.content, entry.id) : null;
      if (dup && this.callbacks.onDuplicateDetected) {
        const orbitName = dup.entry.orbitId
          ? existingOrbits.find(o => o.id === dup.entry.orbitId)?.name || null
          : null;
        const proceed = await this.callbacks.onDuplicateDetected(
          dup.entry.content.slice(0, 120), orbitName, dup.similarity, dup.entry.id, dup.entry.orbitId
        );
        if (!proceed) {
          // User chose not to add duplicate — just mark as draft and stop
          await updateEntryStatus(entry.id, "draft", null);
          this.setState("done");
          this.currentEntry = null;
          return;
        }
      }

      let result: ClassificationResult;

      // Try the AI provider first
      try {
        result = await this.aiProvider.classify(
          entry.content,
          existingOrbits,
          []
        );
      } catch {
        // AI failed, fall back to unclassified
        this.callbacks.onError?.("AI classification failed. Entry saved to Nest.");
        result = { type: "unclassified", confidence: 0 };
      }

      // ─── Low-confidence fallback: if AI has no clue, save to Nest ───
      if (result.confidence < 0.5) {
        await updateEntryStatus(entry.id, "unclassified", null);
        this.callbacks.onClassified({ type: "unclassified", confidence: result.confidence });
        this.setState("done"); this.currentEntry = null;
        return;
      }

      // Handle the classification result — verify with gravitational scoring
      if (result.type === "existing_pattern" && result.orbitId) {
        // Warm orbit entry cache to avoid N DB calls
        await OrbitEntryCache.warm(existingOrbits);
        // Run gravitational scoring — blends AI semantic meaning (50%) with mechanical factors
        const gravityScores = await calculateOrbitGravity(entry.content, existingOrbits, result.orbitRelevance);
        const topScore = gravityScores[0];
        const aiPickScore = gravityScores.find(g => g.orbit.id === result.orbitId);
        
        // If another orbit has significantly higher gravity, override AI
        if (topScore && aiPickScore && topScore.orbit.id !== result.orbitId && topScore.score > aiPickScore.score * 1.3) {
          // Stronger gravity elsewhere — use that orbit instead
          await updateEntryStatus(entry.id, "classified", topScore.orbit.id);
          this.callbacks.onClassified({
            type: "existing_pattern", orbitId: topScore.orbit.id, orbitName: topScore.orbit.name, confidence: topScore.score,
          });
          this.setState("done"); this.currentEntry = null;
          await this.detectAndCreateReminders({ ...entry, orbitId: topScore.orbit.id });
          return;
        }

        // Confidence threshold: if AI isn't confident, treat as new pattern
        if (result.confidence < 0.75 && result.orbitName) {
          const approved = await this.callbacks.onNewPattern(
            result.orbitName + " (uncertain match)",
            result.confidence
          );
          if (approved) {
            await updateEntryStatus(entry.id, "classified", result.orbitId);
            this.callbacks.onClassified(result);
          } else {
            await updateEntryStatus(entry.id, "unclassified", null);
            this.callbacks.onClassified({ type: "unclassified", confidence: 0 });
          }
        } else {
          // Route to existing orbit
          await updateEntryStatus(entry.id, "classified", result.orbitId);
          this.callbacks.onClassified(result);
        }
      } else if (result.type === "new_pattern" && result.orbitName) {
        // Ask user for confirmation
        const approved = await this.callbacks.onNewPattern(
          result.orbitName,
          result.confidence
        );

        if (approved) {
          // Create the new orbit and route the entry there
          const orbit = await createOrbit(result.orbitName, false);
          await updateEntryStatus(entry.id, "classified", orbit.id);
          this.callbacks.onClassified({
            ...result,
            type: "existing_pattern",
            orbitId: orbit.id,
            orbitName: orbit.name,
          });
        } else {
          // User declined, mark as unclassified
          await updateEntryStatus(entry.id, "unclassified", null);
          this.callbacks.onClassified({
            type: "unclassified",
            confidence: 0,
          });
        }
      } else {
        // Unclassified, keep in the Nest
        await updateEntryStatus(entry.id, "unclassified", null);
        this.callbacks.onClassified({
          type: "unclassified",
          confidence: 0,
        });
      }

      // ─── Reminder Detection (runs after classification) ───
      await this.detectAndCreateReminders(entry);
    } catch (error) {
      console.error("Gravity engine processing error:", error);
      this.callbacks.onError?.("Something went wrong. Your entry is safe.");
      if (this.currentEntry) {
        await updateEntryStatus(this.currentEntry.id, "unclassified", null);
      }
    }

    this.setState("done");
    this.currentEntry = null;
  }

  /** Run reminder detection on a classified entry */
  private async detectAndCreateReminders(entry: Entry): Promise<void> {
    try {
      // Skip reminder detection for very short / low-quality entries
      if (entry.wordCount < 5) return;

      // 1. Rule-based reminder detection (dates, deadlines, commitments, intentions)
      const detected = detectReminders(entry.content);

      for (const d of detected) {
        // Skip reminders with empty or nonsensical titles
        const title = d.title?.trim() || "";
        if (title.length < 5 || title.length > 120) continue;

        const reminder = await addReminder({
          entryId: entry.id,
          type: d.type,
          title: d.title,
          description: d.description,
          targetDate: d.targetDate,
          detectedDate: d.detectedDate,
          orbitId: entry.orbitId,
        });

        this.callbacks.onReminderDetected?.(reminder);
      }

      // 2. Dormant idea resurfacing (only for entries with substance)
      if (entry.wordCount > 10) {
        const dormantMatches = await findDormantIdeas(entry);

        for (const match of dormantMatches) {
          // Don't create duplicate resurface reminders for the same old entry
          const alreadyReminded = await hasActiveReminderForEntry(match.oldEntry.id);
          if (alreadyReminded) continue;

          const resurfaceReminder = buildResurfaceReminder(match, entry.id);
          const reminder = await addReminder(resurfaceReminder);

          this.callbacks.onReminderDetected?.(reminder);
        }
      }
    } catch (error) {
      // Reminder detection should never break the main flow
      console.error("Reminder detection error:", error);
    }
  }
}

/**
 * Standalone classification function (doesn't require the full engine).
 * Useful for testing or manual classification.
 */
export async function classifyEntry(
  entry: Entry,
  aiProvider: AIProvider
): Promise<ClassificationResult> {
  const orbits = await getAllOrbits();

  try {
    return await aiProvider.classify(entry.content, orbits, []);
  } catch {
    return { type: "unclassified", confidence: 0 };
  }
}
