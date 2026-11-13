// ─── Core Types for Gravity ───

/** A single writing entry (the fundamental unit of Gravity) */
export interface Entry {
  id: string;
  content: string;
  createdAt: number; // Unix timestamp ms
  updatedAt: number;
  editedAt: number | null;
  wordCount: number;
  status: EntryStatus;
  orbitId: string | null;
  tags: string[];
  trashedAt: number | null;
}

export type EntryStatus = "draft" | "processing" | "classified" | "unclassified" | "trashed";

/** An Orbit: a discovered cluster of thinking */
export interface Orbit {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
  lastActiveAt: number;
  entryCount: number;
  parentOrbitId: string | null; // null = top-level orbit
  isUserCreated: boolean; // false = discovered by AI
}

/** Result from the AI classification engine */
export interface ClassificationResult {
  type: "existing_pattern" | "new_pattern" | "unclassified";
  orbitId?: string;
  orbitName?: string;
  confidence: number;
  reasoning?: string;
  /** AI's semantic relevance score (0-1) for each orbit by ID — meaning, not keywords */
  orbitRelevance?: Record<string, number>;
}

/** Abstraction for any AI provider */
export interface AIProvider {
  /** Classify a text entry against known orbits */
  classify(
    text: string,
    existingOrbits: Orbit[],
    recentEntries: Entry[]
  ): Promise<ClassificationResult>;

  /** Generate embeddings (for future semantic search) */
  embed?(text: string): Promise<number[]>;
}

/** Configuration for a user's AI provider */
export interface AIProviderConfig {
  provider: "openai" | "openrouter" | "ollama" | "deepseek" | "none";
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/** A writing session: one continuous period of typing */
export interface WritingSession {
  date: string; // YYYY-MM-DD
  entryCount: number;
  totalWords: number;
}

// ─── Reminder System Types ───

export type ReminderType =
  | "date"        // Explicit date mention (e.g., "exam on August 15")
  | "deadline"    // Deadline detected ("submit by Friday")
  | "commitment"  // Promise/commitment ("I should call Rahul")
  | "intention"   // Future intention ("when I learn React, I want to...")
  | "resurface";  // Dormant idea resurfacing

export type ReminderStatus = "pending" | "shown" | "dismissed" | "completed";

/** A reminder: Gravity detects something that needs attention */
export interface Reminder {
  id: string;
  entryId: string;           // The entry that triggered this reminder
  type: ReminderType;
  title: string;             // Short title (e.g., "AWS Certification Exam")
  description: string;       // The relevant excerpt from the entry
  targetDate: number | null; // When to surface (Unix timestamp ms), null = no specific date
  detectedDate: string | null; // Original date string ("August 15", "next Friday")
  orbitId: string | null;    // Associated orbit
  status: ReminderStatus;
  createdAt: number;
  shownAt: number | null;
  dismissedAt: number | null;
}

/** Result from the reminder detection pipeline */
export interface ReminderDetectionResult {
  reminders: Omit<Reminder, "id" | "status" | "createdAt" | "shownAt" | "dismissedAt">[];
}

