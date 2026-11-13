"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, AlarmClock, Handshake, Compass, History, Check, X } from "lucide-react";
import type { Reminder } from "@/types";
import { getPendingReminders, dismissReminder, completeReminder } from "@/lib/db";

const TYPE_CFG: Record<Reminder["type"], { icon: typeof Calendar; label: string; color: string }> = {
  date: { icon: Calendar, label: "Date", color: "text-blue-400" },
  deadline: { icon: AlarmClock, label: "Deadline", color: "text-red-400" },
  commitment: { icon: Handshake, label: "Commitment", color: "text-amber-400" },
  intention: { icon: Compass, label: "Intention", color: "text-purple-400" },
  resurface: { icon: History, label: "Memory", color: "text-emerald-400" },
};

export default function RemindersPage() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { setReminders(await getPendingReminders()); setLoading(false); })(); }, []);

  const handleDismiss = async (id: string) => { await dismissReminder(id); setReminders(prev => prev.filter(r => r.id !== id)); };
  const handleComplete = async (id: string) => { await completeReminder(id); setReminders(prev => prev.filter(r => r.id !== id)); };

  const fmtTarget = (ts: number | null) => {
    if (!ts) return null;
    const days = Math.ceil((ts - Date.now()) / 86400000);
    if (days < 0) return Math.abs(days) + "d overdue";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return days + "d";
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-8 text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Home
        </button>
        <div className="mb-10">
          <h1 className="text-2xl font-light text-zinc-900 dark:text-zinc-100 tracking-wide">Reminders</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{reminders.length} pending</p>
        </div>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-900/30 rounded-xl animate-pulse" />)}</div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">No pending reminders.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reminders.map(r => {
              const cfg = TYPE_CFG[r.type]; const Icon = cfg.icon;
              return (
                <div key={r.id} className="group bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><Icon className={"w-3.5 h-3.5 " + cfg.color} /><span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{r.title}</span></div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => handleDismiss(r.id)} className="p-1 rounded text-zinc-400 hover:text-zinc-600" title="Dismiss"><X className="w-3 h-3" /></button>
                      <button onClick={() => handleComplete(r.id)} className="p-1 rounded text-zinc-400 hover:text-emerald-500" title="Done"><Check className="w-3 h-3" /></button>
                    </div>
                  </div>
                  {r.description && <p className="text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2">{r.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{cfg.label}</span>
                    {r.targetDate && <span className={"text-[10px] " + (r.targetDate < Date.now() ? "text-red-400" : "text-zinc-400")}>{fmtTarget(r.targetDate)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
