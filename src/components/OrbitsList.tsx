"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Clock, Hash } from "lucide-react";
import type { Orbit } from "@/types";
import { getActiveOrbits } from "@/lib/orbits";

interface OrbitsListProps { refreshTrigger?: number; }

export default function OrbitsList({ refreshTrigger }: OrbitsListProps) {
  const router = useRouter();
  const [orbits, setOrbits] = useState<(Orbit & { entryCount: number; lastPreview?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const active = await getActiveOrbits();
      setOrbits(active.map((s) => ({ ...s, lastPreview: s.entries.length > 0 ? s.entries[0].content.slice(0, 120) : undefined })));
      setLoading(false);
    })();
  }, [refreshTrigger]);

  const formatDate = (ts: number): string => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-12">
          <h1 className="text-2xl font-light text-zinc-900 dark:text-zinc-100 mb-2 tracking-wide">Your Mind</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{orbits.length} orbit{orbits.length !== 1 ? "s" : ""} discovered</p>
        </div>
        {loading && <div className="space-y-4">{[1,2,3].map((i) => (<div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-900 rounded-xl animate-pulse" />))}</div>}
        {!loading && (
          <div className="space-y-3">
            {orbits.length === 0 && (
              <div className="text-center py-16">
                <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-400 dark:text-zinc-500 text-sm">No orbits yet. Start writing and Gravity will discover them.</p>
              </div>
            )}
            {orbits.map((orbit) => (
              <button key={orbit.id} onClick={() => router.push(`/orbits/${orbit.id}`)} className="w-full text-left group">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700/50 rounded-xl p-5 transition-all duration-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: orbit.color }} />
                      <div>
                        <h2 className="text-zinc-900 dark:text-zinc-200 font-medium group-hover:text-black dark:group-hover:text-white transition-colors">{orbit.name}</h2>
                        {orbit.isUserCreated && <span className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">You created this</span>}
                      </div>
                    </div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(orbit.lastActiveAt)}</span>
                  </div>
                  {orbit.lastPreview && <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 ml-5.5 mb-3">{orbit.lastPreview}</p>}
                  <div className="flex items-center gap-3 ml-5.5">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1"><Hash className="w-3 h-3" />{orbit.entryCount} note{orbit.entryCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
