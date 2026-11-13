"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, AlarmClock, Lightbulb, Handshake, Compass, History, Check, X } from "lucide-react";
import type { Reminder } from "@/types";
import { getPendingReminders, getDueReminders, markReminderShown, dismissReminder, completeReminder } from "@/lib/db";

interface ReminderPanelProps { refreshTrigger?: number; onNavigate?: (entryId: string, orbitId: string | null) => void; }

const TYPE_CONFIG: Record<Reminder["type"], { icon: typeof Calendar; label: string; color: string }> = {
  date: { icon: Calendar, label: "Upcoming", color: "text-blue-400" },
  deadline: { icon: AlarmClock, label: "Deadline", color: "text-red-400" },
  commitment: { icon: Handshake, label: "Commitment", color: "text-amber-400" },
  intention: { icon: Compass, label: "Intention", color: "text-purple-400" },
  resurface: { icon: History, label: "Memory", color: "text-emerald-400" },
};

export default function ReminderPanel({ refreshTrigger, onNavigate }: ReminderPanelProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const pending = await getPendingReminders();
    const due = await getDueReminders();
    const map = new Map<string, Reminder>();
    for (const r of [...due, ...pending]) map.set(r.id, r);
    const filtered = Array.from(map.values()).filter((r) => !dismissed.has(r.id));
    filtered.sort((a, b) => { if (a.targetDate && b.targetDate) return a.targetDate - b.targetDate; if (a.targetDate) return -1; if (b.targetDate) return 1; return b.createdAt - a.createdAt; });
    setReminders(filtered.slice(0, 5));
    setLoading(false);
  }, [dismissed]);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleDismiss = async (r: Reminder) => { setDismissed((p) => new Set(p).add(r.id)); await dismissReminder(r.id); setTimeout(() => setReminders((p) => p.filter((x) => x.id !== r.id)), 300); };
  const handleComplete = async (r: Reminder) => { setDismissed((p) => new Set(p).add(r.id)); await completeReminder(r.id); setTimeout(() => setReminders((p) => p.filter((x) => x.id !== r.id)), 300); };
  const handleClick = async (r: Reminder) => { await markReminderShown(r.id); onNavigate?.(r.entryId, r.orbitId); };

  const fmtTarget = (ts: number | null): string => {
    if (!ts) return "";
    const days = Math.ceil((ts - Date.now()) / 86400000);
    if (days < 0) return Math.abs(days) === 0 ? "Today" : Math.abs(days) === 1 ? "Yesterday" : `${Math.abs(days)}d overdue`;
    if (days === 0) return "Today"; if (days === 1) return "Tomorrow"; if (days <= 7) return `${days}d`;
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (!loading && reminders.length === 0) return null;

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-4">
      {loading && reminders.length === 0 && (
        <div className="text-center">
          <div className="inline-block px-4 py-2 rounded-full bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-800/50 text-xs text-zinc-400 dark:text-zinc-500 animate-pulse">Checking for reminders...</div>
        </div>
      )}
      <div className="space-y-2">
        {reminders.map((reminder) => {
          const cfg = TYPE_CONFIG[reminder.type]; const Icon = cfg.icon;
          return (
            <div key={reminder.id} className="group bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700/60 rounded-xl p-3 shadow-lg transition-all duration-200">
              <button onClick={() => handleClick(reminder)} className="w-full text-left">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5"><Icon className={`w-3 h-3 ${cfg.color}`} /><span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{cfg.label}</span></div>
                  {reminder.targetDate && <span className={`text-[10px] ${reminder.targetDate < Date.now() ? "text-red-400" : "text-zinc-400 dark:text-zinc-500"}`}>{fmtTarget(reminder.targetDate)}</span>}
                </div>
                <div className="flex items-start gap-2"><Lightbulb className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 mt-0.5 flex-shrink-0" /><p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-2">{reminder.title}</p></div>
                {reminder.type === "resurface" && reminder.description && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 ml-5.5 line-clamp-1 italic">&ldquo;{reminder.description}&rdquo;</p>}
              </button>
              <div className="flex items-center justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); handleDismiss(reminder); }} className="p-1 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" title="Dismiss"><X className="w-3 h-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); handleComplete(reminder); }} className="p-1 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" title="Mark done"><Check className="w-3 h-3" /></button>
              </div>
            </div>
          );
        })}
      </div>
      {reminders.length > 0 && <p className="text-center mt-2 text-[10px] text-zinc-400 dark:text-zinc-600 select-none">Gravity noticed {reminders.length} thing{reminders.length !== 1 ? "s" : ""} that may need attention</p>}
    </div>
  );
}
