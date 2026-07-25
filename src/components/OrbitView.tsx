"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Entry, Orbit } from "@/types";
import { getEntriesByOrbit } from "@/lib/db";

interface OrbitViewProps { orbit: Orbit; }

export default function OrbitView({ orbit }: OrbitViewProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { setEntries(await getEntriesByOrbit(orbit.id)); setLoading(false); })(); }, [orbit.id]);

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <button onClick={() => router.push("/orbits")} className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-8 text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> All Orbits
        </button>
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: orbit.color }} />
            <h1 className="text-2xl font-light text-zinc-900 dark:text-zinc-100 tracking-wide">{orbit.name}</h1>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{entries.length} entr{entries.length === 1 ? "y" : "ies"} · {orbit.isUserCreated ? "Created by you" : "Discovered by Gravity"}</p>
        </div>
        {loading && <div className="space-y-4">{[1,2,3].map((i) => (<div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-900 rounded-xl animate-pulse" />))}</div>}
        {!loading && (
          <div className="space-y-6">
            {entries.length === 0 && <p className="text-zinc-400 dark:text-zinc-500 text-sm text-center py-16">No entries yet in this orbit.</p>}
            {entries.map((entry) => (
              <div key={entry.id} className="group relative">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800/50" />
                <div className="pl-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(entry.createdAt)} · {fmtTime(entry.createdAt)}</span>
                    <span className="text-[10px] text-zinc-300 dark:text-zinc-600">{entry.wordCount} words</span>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700/50 transition-colors">
                    <p className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
