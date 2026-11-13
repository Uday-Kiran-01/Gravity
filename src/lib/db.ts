// ─── Database Layer (Supabase) ───

import { getSupabase } from "./supabase";
import type { Entry, Orbit, WritingSession, Reminder } from "@/types";

function uid(): string {
  if (typeof window === "undefined") return "anonymous";
  // Always use consistent user ID — single user for now
  const id = "gravity-user";
  localStorage.setItem("gravity_user_id", id);
  return id;
}

function db() { return getSupabase() as any; }

export async function createEntry(content: string): Promise<Entry> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("entries").insert({
    user_id: uid(), content, word_count: content.trim().split(/\s+/).filter(Boolean).length,
    status: "draft", created_at: now, updated_at: now,
  }).select().single();
  if (error) throw error;
  return mapEntry(data);
}

export async function updateEntryContent(id: string, content: string): Promise<void> {
  await db().from("entries").update({
    content, updated_at: new Date().toISOString(),
    word_count: content.trim().split(/\s+/).filter(Boolean).length,
  }).eq("id", id);
}

export async function updateEntryStatus(id: string, status: Entry["status"], orbitId?: string | null): Promise<void> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (orbitId !== undefined) updates.orbit_id = orbitId;
  await db().from("entries").update(updates).eq("id", id);
  if (orbitId) {
    const { data: orbit } = await db().from("orbits").select("entry_count").eq("id", orbitId).single();
    if (orbit) {
      await db().from("orbits").update({ last_active_at: new Date().toISOString(), entry_count: orbit.entry_count + 1 }).eq("id", orbitId);
    }
  }
}

export async function getDraftEntry(): Promise<Entry | undefined> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data } = await db().from("entries").select().eq("user_id", uid()).eq("status", "draft").gte("updated_at", thirtyMinAgo).order("created_at", { ascending: false }).limit(1).single();
  return data ? mapEntry(data) : undefined;
}

export async function getEntriesByOrbit(orbitId: string): Promise<Entry[]> {
  const { data } = await db().from("entries").select().eq("orbit_id", orbitId).eq("user_id", uid()).order("created_at", { ascending: false });
  return (data || []).map(mapEntry);
}

export async function getUnclassifiedEntries(): Promise<Entry[]> {
  const { data } = await db().from("entries").select().eq("user_id", uid()).eq("status", "unclassified").order("created_at", { ascending: false });
  return (data || []).map(mapEntry);
}

export async function createOrbit(name: string, isUserCreated = false, parentOrbitId: string | null = null): Promise<Orbit> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("orbits").insert({
    user_id: uid(), name, description: "", color: getRandomOrbitColor(),
    created_at: now, last_active_at: now, entry_count: 0, parent_orbit_id: parentOrbitId, is_user_created: isUserCreated,
  }).select().single();
  if (error) throw error;
  return mapOrbit(data);
}

export async function getAllOrbits(): Promise<Orbit[]> {
  const { data } = await db().from("orbits").select().eq("user_id", uid()).order("last_active_at", { ascending: false });
  return (data || []).map(mapOrbit);
}

export async function getOrbitById(id: string): Promise<Orbit | undefined> {
  const { data } = await db().from("orbits").select().eq("user_id", uid()).eq("id", id).single();
  return data ? mapOrbit(data) : undefined;
}

export async function getOrbitByName(name: string): Promise<Orbit | undefined> {
  const { data } = await db().from("orbits").select().eq("user_id", uid()).eq("name", name).single();
  return data ? mapOrbit(data) : undefined;
}

export async function getOldEntries(before: number): Promise<Entry[]> {
  const { data } = await db().from("entries").select().eq("user_id", uid()).lt("created_at", new Date(before).toISOString()).order("created_at", { ascending: false });
  return (data || []).map(mapEntry);
}

export async function logWritingSession(date: string, entryCount: number, totalWords: number): Promise<void> {
  const { data: existing } = await db().from("sessions").select("id, entry_count, total_words").eq("user_id", uid()).eq("date", date).single();
  if (existing) {
    await db().from("sessions").update({ entry_count: existing.entry_count + entryCount, total_words: existing.total_words + totalWords }).eq("id", existing.id);
  } else {
    await db().from("sessions").insert({ user_id: uid(), date, entry_count: entryCount, total_words: totalWords });
  }
}

export async function getAllSessions(): Promise<WritingSession[]> {
  const { data } = await db().from("sessions").select("date, entry_count, total_words").eq("user_id", uid()).order("date", { ascending: false });
  return (data || []).map((s: Record<string, unknown>) => ({ date: s.date as string, entryCount: s.entry_count as number, totalWords: s.total_words as number }));
}

export async function addReminder(r: Omit<Reminder, "id" | "createdAt" | "status" | "shownAt" | "dismissedAt">): Promise<Reminder> {
  const { data, error } = await db().from("reminders").insert({
    entry_id: r.entryId, user_id: uid(), type: r.type, title: r.title, description: r.description,
    target_date: r.targetDate ? new Date(r.targetDate).toISOString() : null,
    detected_date: r.detectedDate, orbit_id: r.orbitId, status: "pending", created_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return mapReminder(data);
}

export async function getPendingReminders(): Promise<Reminder[]> {
  const { data } = await db().from("reminders").select().eq("user_id", uid()).eq("status", "pending").order("created_at", { ascending: false });
  return (data || []).map(mapReminder);
}

export async function getDueReminders(): Promise<Reminder[]> {
  const { data } = await db().from("reminders").select().eq("user_id", uid()).eq("status", "pending").lte("target_date", new Date().toISOString()).order("target_date", { ascending: true });
  return (data || []).map(mapReminder);
}

export async function markReminderShown(id: string): Promise<void> { await db().from("reminders").update({ status: "shown", shown_at: new Date().toISOString() }).eq("id", id); }
export async function dismissReminder(id: string): Promise<void> { await db().from("reminders").update({ status: "dismissed", dismissed_at: new Date().toISOString() }).eq("id", id); }
export async function completeReminder(id: string): Promise<void> { await db().from("reminders").update({ status: "completed", dismissed_at: new Date().toISOString() }).eq("id", id); }

export async function deleteEntry(id: string): Promise<void> {
  const { data: entry } = await db().from("entries").select("orbit_id").eq("id", id).single();
  if (entry?.orbit_id) {
    const { data: orbit } = await db().from("orbits").select("entry_count").eq("id", entry.orbit_id).single();
    if (orbit) {
      await db().from("orbits").update({ entry_count: Math.max(0, orbit.entry_count - 1) }).eq("id", entry.orbit_id);
    }
  }
  await db().from("entries").delete().eq("id", id);
}

export async function deleteOrbit(id: string): Promise<void> {
  await db().from("orbits").update({ parent_orbit_id: null }).eq("parent_orbit_id", id);
  await db().from("entries").update({ orbit_id: null }).eq("orbit_id", id);
  await db().from("orbits").delete().eq("id", id);
}

export async function updateOrbit(id: string, updates: { name?: string; color?: string }): Promise<void> {
  await db().from("orbits").update(updates).eq("id", id);
}

export async function moveEntryToOrbit(entryId: string, newOrbitId: string | null): Promise<void> {
  // Get current orbit to decrement count
  const { data: entry } = await db().from("entries").select("orbit_id").eq("id", entryId).single();
  if (entry?.orbit_id) {
    const { data: oldOrbit } = await db().from("orbits").select("entry_count").eq("id", entry.orbit_id).single();
    if (oldOrbit) {
      await db().from("orbits").update({ entry_count: Math.max(0, oldOrbit.entry_count - 1) }).eq("id", entry.orbit_id);
    }
  }
  // Increment new orbit count
  if (newOrbitId) {
    const { data: newOrbit } = await db().from("orbits").select("entry_count").eq("id", newOrbitId).single();
    if (newOrbit) {
      await db().from("orbits").update({ entry_count: newOrbit.entry_count + 1, last_active_at: new Date().toISOString() }).eq("id", newOrbitId);
    }
  }
  const status = newOrbitId ? "classified" : "unclassified";
  await db().from("entries").update({ orbit_id: newOrbitId, status, updated_at: new Date().toISOString() }).eq("id", entryId);
}

export async function hasActiveReminderForEntry(entryId: string): Promise<boolean> {
  const { count } = await db().from("reminders").select("*", { count: "exact", head: true }).eq("entry_id", entryId).eq("user_id", uid()).in("status", ["pending", "shown"]);
  return (count || 0) > 0;
}

// ─── Edit Entry ───
export async function editEntryContent(id: string, content: string): Promise<void> {
  await db().from("entries").update({
    content, updated_at: new Date().toISOString(), edited_at: new Date().toISOString(),
    word_count: content.trim().split(/\s+/).filter(Boolean).length,
  }).eq("id", id);
}

// ─── Trash System ───
export async function trashEntry(id: string): Promise<void> {
  const { data: entry } = await db().from("entries").select("orbit_id").eq("id", id).single();
  if (entry?.orbit_id) {
    const { data: o } = await db().from("orbits").select("entry_count").eq("id", entry.orbit_id).single();
    if (o) await db().from("orbits").update({ entry_count: Math.max(0, o.entry_count - 1) }).eq("id", entry.orbit_id);
  }
  await db().from("entries").update({ status: "trashed", trashed_at: new Date().toISOString(), orbit_id: null }).eq("id", id);
}

export async function restoreEntry(id: string): Promise<void> {
  await db().from("entries").update({ status: "unclassified", trashed_at: null }).eq("id", id);
}

export async function getTrashedEntries(): Promise<Entry[]> {
  const { data } = await db().from("entries").select().eq("user_id", uid()).eq("status", "trashed").order("trashed_at", { ascending: false }).limit(50);
  return (data || []).map(mapEntry);
}

export async function emptyTrash(): Promise<void> {
  const { data } = await db().from("entries").select("id").eq("user_id", uid()).eq("status", "trashed");
  if (data) for (const row of data) await db().from("entries").delete().eq("id", row.id);
}

export async function permanentDeleteEntry(id: string): Promise<void> {
  await db().from("entries").delete().eq("id", id);
}

// ─── Tags ───
export async function setEntryTags(entryId: string, tags: string[]): Promise<void> {
  await db().from("entries").update({ tags: tags.map(t => t.toLowerCase().trim()) }).eq("id", entryId);
}

export async function getAllTags(): Promise<string[]> {
  const { data } = await db().from("entries").select("tags").eq("user_id", uid()).not("tags", "is", null);
  const all = new Set<string>();
  for (const row of (data || [])) for (const t of (row.tags || [])) all.add(t);
  return Array.from(all).sort();
}

export async function getEntriesByTag(tag: string): Promise<Entry[]> {
  const { data } = await db().from("entries").select().eq("user_id", uid()).contains("tags", [tag.toLowerCase()]).order("created_at", { ascending: false });
  return (data || []).map(mapEntry);
}

// ─── Merge Orbits ───
export async function mergeOrbits(sourceId: string, targetId: string): Promise<void> {
  const { data: entries } = await db().from("entries").select("id").eq("orbit_id", sourceId);
  const count = (entries || []).length;
  if (count > 0) {
    await db().from("entries").update({ orbit_id: targetId, status: "classified" }).eq("orbit_id", sourceId);
    const { data: t } = await db().from("orbits").select("entry_count").eq("id", targetId).single();
    if (t) await db().from("orbits").update({ entry_count: t.entry_count + count, last_active_at: new Date().toISOString() }).eq("id", targetId);
  }
  await db().from("orbits").update({ parent_orbit_id: targetId }).eq("parent_orbit_id", sourceId);
  await db().from("orbits").delete().eq("id", sourceId);
}

// ─── On This Day / Streaks ───
export async function getEntriesByDate(month: number, day: number): Promise<Entry[]> {
  const { data } = await db().from("entries").select().eq("user_id", uid()).neq("status", "draft").neq("status", "trashed").order("created_at", { ascending: false });
  return (data || []).filter((row: Record<string, unknown>) => {
    const d = new Date(row.created_at as string);
    return d.getMonth() === month && d.getDate() === day;
  }).map(mapEntry);
}

export async function getWritingStreak(): Promise<{ current: number; longest: number }> {
  const { data } = await db().from("sessions").select("date").eq("user_id", uid()).order("date", { ascending: false });
  const dates = new Set((data || []).map((s: Record<string, unknown>) => s.date as string));
  let current = 0; let longest = 0;
  const check = (d: Date) => dates.has(d.toISOString().split("T")[0]);
  const today = new Date(); const d = new Date(today);
  while (check(d)) { current++; d.setDate(d.getDate() - 1); }
  const allDates = Array.from(dates) as string[];
  if (allDates.length > 0) {
    const timestamps = allDates.map(s => new Date(s).getTime());
    const maxTs = Math.max(0, ...timestamps);
    if (maxTs > 0) {
      const cursor = new Date(maxTs); let streak = 0;
      while (cursor > new Date("2020-01-01")) {
        if (check(cursor)) { streak++; longest = Math.max(longest, streak); } else { streak = 0; }
        cursor.setDate(cursor.getDate() - 1);
      }
    }
  }
  return { current, longest: Math.max(longest, current) };
}

function mapEntry(row: Record<string, unknown>): Entry {
  return {
    id: row.id as string,
    content: row.content as string,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
    editedAt: row.edited_at ? new Date(row.edited_at as string).getTime() : null,
    wordCount: row.word_count as number,
    status: row.status as Entry["status"],
    orbitId: (row.orbit_id as string) || null,
    tags: (row.tags as string[]) || [],
    trashedAt: row.trashed_at ? new Date(row.trashed_at as string).getTime() : null,
  };
}

function mapOrbit(row: Record<string, unknown>): Orbit {
  return { id: row.id as string, name: row.name as string, description: (row.description as string) || "", color: (row.color as string) || "", createdAt: new Date(row.created_at as string).getTime(), lastActiveAt: new Date(row.last_active_at as string).getTime(), entryCount: (row.entry_count as number) || 0, parentOrbitId: (row.parent_orbit_id as string) || null, isUserCreated: (row.is_user_created as boolean) || false };
}

function mapReminder(row: Record<string, unknown>): Reminder {
  return { id: row.id as string, entryId: row.entry_id as string, type: row.type as Reminder["type"], title: row.title as string, description: (row.description as string) || "", targetDate: row.target_date ? new Date(row.target_date as string).getTime() : null, detectedDate: (row.detected_date as string) || null, orbitId: (row.orbit_id as string) || null, status: row.status as Reminder["status"], createdAt: new Date(row.created_at as string).getTime(), shownAt: row.shown_at ? new Date(row.shown_at as string).getTime() : null, dismissedAt: row.dismissed_at ? new Date(row.dismissed_at as string).getTime() : null };
}

const COLORS = ["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#3b82f6"];
function getRandomOrbitColor(): string { return COLORS[Math.floor(Math.random() * COLORS.length)]; }
