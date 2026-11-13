"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import type { Entry } from "@/types";
import { getTrashedEntries, restoreEntry, emptyTrash, permanentDeleteEntry } from "@/lib/db";

export default function TrashPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { setEntries(await getTrashedEntries()); setLoading(false); })(); }, []);

  const handleRestore = async (id: string) => { await restoreEntry(id); setEntries(prev => prev.filter(e => e.id !== id)); };
  const handlePermanentDelete = async (id: string) => { if (confirm("Delete forever?")) { await permanentDeleteEntry(id); setEntries(prev => prev.filter(e => e.id !== id)); } };
  const handleEmpty = async () => { if (confirm("Permanently delete everything in trash?")) { await emptyTrash(); setEntries([]); } };

  const relTime = (ts: number) => {
    const d = Date.now() - ts;
    if (d < 3600000) return Math.floor(d/60000) + "m ago";
    if (d < 86400000) return Math.floor(d/3600000) + "h ago";
    return Math.floor(d/86400000) + "d ago";
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <button onClick={() => router.push("/orbits")} className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-8 text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back
        </button>
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-light text-zinc-900 dark:text-zinc-100 tracking-wide">Trash</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{entries.length} item{entries.length !== 1 ? "s" : ""}</p>
          </div>
          {entries.length > 0 && (
            <button onClick={handleEmpty} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors">
              <AlertTriangle className="w-3 h-3" /> Empty trash
            </button>
          )}
        </div>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-900/30 rounded-xl animate-pulse" />)}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <Trash2 className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">Trash is empty.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="group bg-zinc-50 dark:bg-zinc-900/30 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800/30 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-zinc-400">{relTime(entry.trashedAt!)}</span>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1">{entry.content}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <button onClick={() => handleRestore(entry.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all opacity-0 group-hover:opacity-100" title="Restore">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button onClick={() => handlePermanentDelete(entry.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all opacity-0 group-hover:opacity-100" title="Delete forever">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
