// ─── Gravity Engine ───
// The core intelligence layer. Watches for typing pauses, classifies entries,
// and manages the lifecycle of thoughts.

import type { Entry, ClassificationResult, Reminder } from "@/types";
import type { AIProvider } from "@/types";
import {
  updateEntryStatus,
  createOrbit,
  getAllOrbits,
  addReminder,
  hasActiveReminderForEntry,
} from "./db";
import { detectReminders } from "./reminders/detector";
import { findDormantIdeas, buildResurfaceReminder } from "./reminders/resurface";

type EngineState = "idle" | "typing" | "waiting" | "processing" | "done";

interface EngineCallbacks {
  /** Called when classification is complete and entry has been routed */
  onClassified: (result: ClassificationResult) => void;
  /** Called when a new pattern is found but needs user confirmation */
  onNewPattern: (spaceName: string, confidence: number) => Promise<boolean>;
  /** Called when a new reminder is detected */
  onReminderDetected?: (reminder: Reminder) => void;
  /** Called when the engine state changes */
  onStateChange?: (state: EngineState) => void;
}

export class GravityEngine {
  private aiProvider: AIProvider;
  private callbacks: EngineCallbacks;
  private state: EngineState = "idle";
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivity = Date.now();
  private readonly IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
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

  /** Call this when the user stops typing */
  onUserIdle(): void {
    this.setState("waiting");
    this.resetIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.processCurrentEntry();
    }, this.IDLE_THRESHOLD_MS);
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
        result = { type: "unclassified", confidence: 0 };
      }

      // Handle the classification result
      if (result.type === "existing_pattern" && result.orbitId) {
        // Route to existing orbit
        await updateEntryStatus(entry.id, "classified", result.orbitId);
        this.callbacks.onClassified(result);
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
      // 1. Rule-based reminder detection (dates, deadlines, commitments, intentions)
      const detected = detectReminders(entry.content);

      for (const d of detected) {
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
