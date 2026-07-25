// ─── Reminder Detection Engine ───
// Gravity notices when something needs attention.
// Rule-based NLP for dates, deadlines, commitments, and intentions.
// Designed to work without an LLM, but can be enhanced by one.

import type { ReminderType } from "@/types";

// ─── Date Detection ───

interface DetectedDate {
  date: Date;
  original: string; // The matched string
  confidence: number;
}

// Month name → index (0-based)
const MONTHS: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

// Day-of-week relative parsing
const DAYS_OF_WEEK: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

/** Parse explicit dates like "August 15", "Jan 3rd, 2025", "on 12/25/2025" */
function detectExplicitDates(text: string): DetectedDate[] {
  const results: DetectedDate[] = [];
  const now = new Date();

  // Pattern: "Month Day" or "Month Day, Year" e.g. "August 15", "on August 15, 2026"
  const monthDayYear = /(\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember|t)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/gi;
  let match;
  while ((match = monthDayYear.exec(text)) !== null) {
    const monthName = match[1].toLowerCase();
    const day = parseInt(match[2], 10);
    const year = match[3] ? parseInt(match[3], 10) : now.getFullYear();
    const monthIdx = MONTHS[monthName];
    if (monthIdx !== undefined && day >= 1 && day <= 31) {
      const date = new Date(year, monthIdx, day);
      // If the date would already have passed this year, assume next year
      if (!match[3] && date < now) {
        date.setFullYear(year + 1);
      }
      results.push({
        date,
        original: match[0].trim(),
        confidence: 0.9,
      });
    }
  }

  // Pattern: "Month Year" e.g. "in December", "by January 2027"
  const monthYear = /(\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember|t)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b)\s+(\d{4})/gi;
  while ((match = monthYear.exec(text)) !== null) {
    const monthName = match[1].toLowerCase();
    const year = parseInt(match[2], 10);
    const monthIdx = MONTHS[monthName];
    if (monthIdx !== undefined) {
      results.push({
        date: new Date(year, monthIdx, 1),
        original: match[0].trim(),
        confidence: 0.75,
      });
    }
  }

  // Pattern: "YYYY-MM-DD" or "DD/MM/YYYY"
  const isoDate = /(\d{4})-(\d{1,2})-(\d{1,2})/g;
  while ((match = isoDate.exec(text)) !== null) {
    const [y, m, d] = [parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10)];
    if (m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      results.push({
        date: new Date(y, m, d),
        original: match[0],
        confidence: 0.95,
      });
    }
  }

  return results;
}

/** Parse relative dates like "next Friday", "tomorrow", "in 2 weeks" */
function detectRelativeDates(text: string): DetectedDate[] {
  const results: DetectedDate[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // "tomorrow"
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    results.push({ date: d, original: "tomorrow", confidence: 0.95 });
  }

  // "day after tomorrow"
  if (/\bday after tomorrow\b/i.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    results.push({ date: d, original: "day after tomorrow", confidence: 0.95 });
  }

  // "next [day of week]" e.g. "next Friday"
  const nextDow = /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/gi;
  let match;
  while ((match = nextDow.exec(text)) !== null) {
    const targetDow = DAYS_OF_WEEK[match[1].toLowerCase()];
    if (targetDow !== undefined) {
      const currentDow = today.getDay();
      let daysUntil = targetDow - currentDow;
      if (daysUntil <= 0) daysUntil += 7;
      const d = new Date(today);
      d.setDate(d.getDate() + daysUntil + 7); // "next" means the week after
      results.push({ date: d, original: match[0], confidence: 0.85 });
    }
  }

  // "this [day of week]" e.g. "this Friday", "on Friday"
  const thisDow = /\b(?:this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/gi;
  while ((match = thisDow.exec(text)) !== null) {
    const targetDow = DAYS_OF_WEEK[match[1].toLowerCase()];
    if (targetDow !== undefined) {
      const currentDow = today.getDay();
      let daysUntil = targetDow - currentDow;
      if (daysUntil < 0) daysUntil += 7; // already passed this week → next week
      if (daysUntil === 0) daysUntil = 7; // today → next week (ambiguous; default to next)
      const d = new Date(today);
      d.setDate(d.getDate() + daysUntil);
      results.push({ date: d, original: match[1], confidence: 0.7 });
    }
  }

  // "in X days/weeks/months"
  const inDuration = /\bin\s+(\d+)\s+(day|days|week|weeks|month|months)\b/gi;
  while ((match = inDuration.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const d = new Date(today);
    if (unit.startsWith("day")) d.setDate(d.getDate() + num);
    else if (unit.startsWith("week")) d.setDate(d.getDate() + num * 7);
    else if (unit.startsWith("month")) d.setMonth(d.getMonth() + num);
    results.push({ date: d, original: match[0], confidence: 0.8 });
  }

  return results;
}

/** Collect all detected dates from text */
function detectAllDates(text: string): DetectedDate[] {
  const explicit = detectExplicitDates(text);
  const relative = detectRelativeDates(text);
  // Merge, deduplicate by date, prefer higher confidence
  const map = new Map<string, DetectedDate>();
  for (const d of [...explicit, ...relative]) {
    const key = d.date.toISOString().split("T")[0];
    if (!map.has(key) || d.confidence > map.get(key)!.confidence) {
      map.set(key, d);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

// ─── Commitment & Promise Detection ───

const COMMITMENT_PATTERNS = [
  { regex: /\bI\s+(?:should|need to|must|have to|gotta|ought to)\s+(.+?)(?:\.|$|,)/gi, type: "commitment" as ReminderType },
  { regex: /\b(?:don't|do not)\s+forget\s+to\s+(.+?)(?:\.|$|,)/gi, type: "commitment" as ReminderType },
  { regex: /\b(?:need to|have to|must)\s+(.+?)(?:\.|$|,)/gi, type: "deadline" as ReminderType },
  { regex: /\b(?:deadline|due)\s+(?:is\s+)?(?:on\s+)?(.+?)(?:\.|$|,)/gi, type: "deadline" as ReminderType },
  { regex: /\b(?:submit|finish|complete|send|deliver)\s+(?:by\s+)?(.+?)(?:\.|$|,)/gi, type: "deadline" as ReminderType },
  { regex: /\bI\s+(?:have|got)\s+(?:a|an)\s+(.+?)\s+(?:on|at)\s+(.+?)(?:\.|$|,)/gi, type: "date" as ReminderType },
  { regex: /\b(?:exam|test|interview|meeting|appointment|call)\s+(?:is\s+)?(?:on\s+)?(.+?)(?:\.|$|,)/gi, type: "date" as ReminderType },
];

const INTENTION_PATTERNS = [
  // "when I learn X, I want to Y"
  { regex: /\bwhen\s+I\s+(?:learn|finish|complete|get|master|understand)\s+(.+?),\s*(?:I\s+)?(?:want to|I'll|I will|I can|I'd like to)\s+(.+?)(?:\.|$|,)/gi },
  // "I want to X someday/eventually/in the future"
  { regex: /\bI\s+(?:want to|plan to|hope to|aim to|intend to)\s+(.+?)(?:\s+(?:someday|eventually|in the future|one day|later|sometime))(?:\.|$|,)/gi },
];

// ─── Main Detection Function ───

interface DetectedReminder {
  type: ReminderType;
  title: string;
  description: string;
  targetDate: number | null;
  detectedDate: string | null;
  confidence: number;
}

/** Extract an excerpt around a match position */
function excerpt(text: string, position: number, length = 150): string {
  const start = Math.max(0, position - 20);
  const end = Math.min(text.length, position + length);
  let ex = text.slice(start, end).trim();
  if (start > 0) ex = "..." + ex;
  if (end < text.length) ex = ex + "...";
  return ex;
}

/** Generate a short title from the text and detected type */
function generateTitle(text: string, detected: string, _type: ReminderType): string {
  // Clean up the detected string
  const clean = detected
    .replace(/^(?:I\s+(?:should|need to|must|have to|gotta|want to|plan to|hope to))\s+/i, "")
    .replace(/\b(?:by|on|before|after)\b/gi, "")
    .trim();

  // Capitalize first letter
  const title = clean.charAt(0).toUpperCase() + clean.slice(1);
  
  // Truncate
  if (title.length > 60) return title.slice(0, 57) + "...";
  return title;
}

/**
 * Main reminder detection: analyze text for dates, deadlines, commitments, and intentions.
 * Returns all detected reminders.
 */
export function detectReminders(text: string): DetectedReminder[] {
  const reminders: DetectedReminder[] = [];
  const dates = detectAllDates(text);

  // 1. Check commitment/deadline patterns
  for (const pattern of COMMITMENT_PATTERNS) {
    let match;
    pattern.regex.lastIndex = 0; // Reset regex state
    while ((match = pattern.regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const captured = match[1] || fullMatch;
      const title = generateTitle(text, captured, pattern.type);
      
      // Try to associate a date with this reminder
      let targetDate: number | null = null;
      let detectedDate: string | null = null;
      
      if (dates.length > 0 && pattern.type !== "commitment") {
        // Use the closest future date
        const now = Date.now();
        const futureDates = dates.filter((d) => d.date.getTime() > now);
        if (futureDates.length > 0) {
          targetDate = futureDates[0].date.getTime();
          detectedDate = futureDates[0].original;
        }
      }

      reminders.push({
        type: pattern.type,
        title,
        description: excerpt(text, match.index),
        targetDate,
        detectedDate,
        confidence: 0.7,
      });
    }
  }

  // 2. Check intention patterns (future goals conditioned on learning)
  for (const pattern of INTENTION_PATTERNS) {
    let match;
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(text)) !== null) {
      const condition = match[1]?.trim() || "";
      const goal = match[2]?.trim() || match[1]?.trim() || "";
      
      reminders.push({
        type: "intention",
        title: goal.charAt(0).toUpperCase() + goal.slice(1),
        description: `When ${condition}, ${goal}`,
        targetDate: null, // No specific date for intentions
        detectedDate: null,
        confidence: 0.6,
      });
    }
  }

  // 3. For dates found without an associated commitment pattern,
  //    create a date-type reminder if text suggests an event
  if (dates.length > 0) {
    const hasEventWords = /\b(exam|test|interview|meeting|appointment|trip|flight|concert|birthday|anniversary|conference|deadline|event)\b/i.test(text);
    const hasCommitmentPattern = COMMITMENT_PATTERNS.some((p) => {
      p.regex.lastIndex = 0;
      return p.regex.test(text);
    });

    if (hasEventWords && !hasCommitmentPattern) {
      const firstDate = dates[0];
      reminders.push({
        type: "date",
        title: text.slice(0, 60).trim() + (text.length > 60 ? "..." : ""),
        description: excerpt(text, 0, 200),
        targetDate: firstDate.date.getTime(),
        detectedDate: firstDate.original,
        confidence: 0.65,
      });
    }
  }

  // Deduplicate: keep highest confidence per unique title
  const seen = new Map<string, DetectedReminder>();
  for (const r of reminders) {
    const key = r.title.toLowerCase();
    if (!seen.has(key) || r.confidence > seen.get(key)!.confidence) {
      seen.set(key, r);
    }
  }

  return Array.from(seen.values());
}

/**
 * Quick check: does this text likely contain something worth reminding about?
 * Used as a pre-filter to avoid unnecessary processing.
 */
export function hasReminderPotential(text: string): boolean {
  // Check for dates
  if (/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep|oct|nov|dec|tomorrow|next\s+\w+day|in\s+\d+\s+(?:day|week|month))\b/i.test(text)) {
    return true;
  }

  // Check for commitment language
  if (/\b(?:I\s+(?:should|need to|must|have to)|don't forget|deadline|due|submit|finish by|remind)\b/i.test(text)) {
    return true;
  }

  // Check for event words
  if (/\b(?:exam|test|interview|meeting|appointment|exam|call)\b/i.test(text)) {
    return true;
  }

  // Check for intention patterns
  if (/\bwhen\s+I\s+(?:learn|finish|get)\b/i.test(text)) {
    return true;
  }

  return false;
}
