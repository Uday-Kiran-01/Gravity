"use client";

import { useEffect, useState } from "react";
import type { WritingSession } from "@/types";
import { getAllSessions } from "@/lib/db";

interface ProductionGridProps { refreshTrigger?: number; }

export default function ProductionGrid({ refreshTrigger }: ProductionGridProps) {
  const [sessions, setSessions] = useState<WritingSession[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalDays, setTotalDays] = useState(0);

  useEffect(() => { (async () => { const d = await getAllSessions(); setSessions(d); setTotalWords(d.reduce((s, x) => s + x.totalWords, 0)); setTotalEntries(d.reduce((s, x) => s + x.entryCount, 0)); setTotalDays(d.length); })(); }, [refreshTrigger]);

  const heatmapData = (() => {
    const today = new Date();
    const days: { date: string; words: number; count: number }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      const s = sessions.find((x) => x.date === ds);
      days.push({ date: ds, words: s?.totalWords ?? 0, count: s?.entryCount ?? 0 });
    }
    return days;
  })();

  const intensity = (w: number, c: number) => { if (c === 0) return 0; if (w < 50) return 1; if (w < 200) return 2; if (w < 750) return 3; return 4; };

  const colors = [
    "bg-zinc-100 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800/20",
    "bg-emerald-100 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/20",
    "bg-emerald-200 dark:bg-emerald-800/30 border-emerald-300 dark:border-emerald-700/20",
    "bg-emerald-300 dark:bg-emerald-700/40 border-emerald-400 dark:border-emerald-600/20",
    "bg-emerald-400/40 dark:bg-emerald-600/50 border-emerald-500/40 dark:border-emerald-500/20",
  ];

  return (
    <div className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Production</h2>
          <div className="flex items-center gap-6 text-xs text-zinc-400 dark:text-zinc-500">
            <span><span className="text-zinc-700 dark:text-zinc-300 font-medium">{totalEntries}</span> entries</span>
            <span><span className="text-zinc-700 dark:text-zinc-300 font-medium">{totalWords.toLocaleString()}</span> words</span>
            <span><span className="text-zinc-700 dark:text-zinc-300 font-medium">{totalDays}</span> active days</span>
          </div>
        </div>
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 mr-2 pt-0.5">
            {["Mon","","Wed","","Fri","",""].map((l, i) => (<div key={i} className="w-6 h-3 flex items-center justify-end">{l && <span className="text-[9px] text-zinc-300 dark:text-zinc-600">{l}</span>}</div>))}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {Array.from({ length: 12 }).map((_, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {Array.from({ length: 7 }).map((_, di) => {
                  const day = heatmapData[wi * 7 + di];
                  if (!day) return <div key={di} className="w-3 h-3" />;
                  const iv = intensity(day.words, day.count);
                  const today = new Date().toISOString().split("T")[0];
                  return (
                    <div key={di} className={`w-3 h-3 rounded-sm border transition-colors cursor-default relative group ${colors[iv]} ${day.date === today ? "ring-1 ring-zinc-400 dark:ring-zinc-500" : ""}`}>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-zinc-200 dark:bg-zinc-800 text-[10px] text-zinc-700 dark:text-zinc-300 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}<br />{day.words > 0 ? `${day.words} words · ${day.count} entries` : "No writing"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-zinc-400 dark:text-zinc-600">
          <span>Less</span>{colors.map((c, i) => (<div key={i} className={`w-2.5 h-2.5 rounded-sm border ${c}`} />))}<span>More</span>
        </div>
      </div>
    </div>
  );
}
