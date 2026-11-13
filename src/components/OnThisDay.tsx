"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import type { Entry } from "@/types";
import { getEntriesByDate } from "@/lib/db";

export default function OnThisDay() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date();
      const found = await getEntriesByDate(today.getMonth(), today.getDate());
      setEntries(found.filter(e => {
        const d = new Date(e.createdAt);
        return d.getFullYear() !== today.getFullYear(); // Only previous years
      }));
      setLoading(false);
    })();
  }, []);

  if (loading || entries.length === 0) return null;

  const fmtYear = (ts: number) => new Date(ts).getFullYear();

  return (
    <div className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-900">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-3.5 h-3.5 text-zinc-400" />
          <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">On This Day</h3>
        </div>
        <div className="space-y-3">
          {entries.slice(0, 3).map(entry => (
            <button
              key={entry.id}
              onClick={() => entry.orbitId ? router.push(`/orbits/${entry.orbitId}`) : router.push("/orbits")}
              className="w-full text-left bg-zinc-50 dark:bg-zinc-900/30 rounded-xl p-3 border border-zinc-200 dark:border-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700/50 transition-colors"
            >
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{fmtYear(entry.createdAt)}</span>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-0.5">{entry.content}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
