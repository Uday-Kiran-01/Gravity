"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Pencil, ArrowRightLeft, Check, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Entry, Orbit } from "@/types";
import { getSupabase } from "@/lib/supabase";
import { editEntryContent, trashEntry, moveEntryToOrbit, getAllOrbits } from "@/lib/db";
import ConfirmDelete from "@/components/ConfirmDelete";

function uid(): string { return "gravity-user"; }

export default function AllEntriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allOrbits, setAllOrbits] = useState<Orbit[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (getSupabase() as any).from("entries")
        .select().eq("user_id", uid()).neq("status", "draft").neq("status", "trashed")
        .order("created_at", { ascending: false }).limit(100);
      setEntries((data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string, content: row.content as string,
        createdAt: new Date(row.created_at as string).getTime(),
        updatedAt: new Date(row.updated_at as string).getTime(),
        editedAt: row.edited_at ? new Date(row.edited_at as string).getTime() : null,
        wordCount: row.word_count as number, status: row.status as Entry["status"],
        orbitId: (row.orbit_id as string) || null,
        tags: (row.tags as string[]) || [],
        trashedAt: row.trashed_at ? new Date(row.trashed_at as string).getTime() : null,
      })));
      setAllOrbits(await getAllOrbits());
      setLoading(false);
    })();
  }, []);

  const relTime = (ts: number) => { const d = Date.now() - ts; if (d < 60000) return "just now"; if (d < 3600000) return Math.floor(d/60000)+"m"; if (d < 86400000) return Math.floor(d/3600000)+"h"; return Math.floor(d/86400000)+"d"; };
  const isMd = (c: string) => /[#*`\[\]>\-]|^\d+\.\s/m.test(c);

  const handleEdit = async (id: string) => { if (!editText.trim()) return; await editEntryContent(id, editText); setEntries(p => p.map(e => e.id === id ? { ...e, content: editText, editedAt: Date.now() } : e)); setEditingId(null); };
  const handleTrash = async (id: string) => { await trashEntry(id); setEntries(p => p.filter(e => e.id !== id)); };
  const handleMove = async (entryId: string, targetId: string | null) => { await moveEntryToOrbit(entryId, targetId); setEntries(p => p.filter(e => e.id !== entryId)); setMovingId(null); };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <button onClick={() => router.push("/orbits")} className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-8 text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back
        </button>
        <div className="mb-10">
          <h1 className="text-2xl font-light text-zinc-900 dark:text-zinc-100 tracking-wide">All Entries</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{entries.length} entries</p>
        </div>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800/20 animate-pulse" />)}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16"><p className="text-zinc-400 dark:text-zinc-500 text-sm">No entries yet.</p></div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => {
              const orbit = allOrbits.find(o => o.id === entry.orbitId);
              return (
                <div key={entry.id} className="group bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700/50 transition-colors p-4">
                  {/* Meta row */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" />{relTime(entry.createdAt)}</span>
                    {entry.editedAt && <span className="text-[10px] text-zinc-400">edited</span>}
                    <span className="text-[10px] text-zinc-400">{entry.wordCount}w</span>
                    {orbit && (
                      <button onClick={() => router.push(`/orbits/${orbit.id}`)} className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ backgroundColor: orbit.color+"20", color: orbit.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: orbit.color }} />{orbit.name}
                      </button>
                    )}
                    {!orbit && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">nest</span>}
                    
                    {/* Hover actions */}
                    <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={e => { e.stopPropagation(); setEditingId(entry.id); setEditText(entry.content); }}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800" title="Edit"><Pencil className="w-3 h-3" /></button>
                      <button onClick={e => { e.stopPropagation(); setMovingId(movingId === entry.id ? null : entry.id); }}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800" title="Move"><ArrowRightLeft className="w-3 h-3" /></button>
                      <ConfirmDelete onDelete={() => handleTrash(entry.id)} />
                    </div>
                  </div>

                  {/* Move dropdown */}
                  {movingId === entry.id && (
                    <div className="mb-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-1 shadow-lg z-30">
                      <button onClick={() => handleMove(entry.id, null)} className="w-full text-left px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30">Move to Nest</button>
                      <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />
                      {allOrbits.map(o => (
                        <button key={o.id} onClick={() => handleMove(entry.id, o.id)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: o.color }} />{o.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Content */}
                  {editingId === entry.id ? (
                    <div>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)}
                        className="w-full min-h-[60px] bg-transparent text-sm text-zinc-700 dark:text-zinc-300 outline-none resize-none leading-relaxed" autoFocus />
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => handleEdit(entry.id)} className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium"><Check className="w-3 h-3" /> Save</button>
                        <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded text-xs text-zinc-500"><X className="w-3 h-3 inline mr-1" />Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {isMd(entry.content) ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 leading-relaxed prose-headings:text-zinc-900 prose-a:text-indigo-500 line-clamp-3">
                          <ReactMarkdown>{entry.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap line-clamp-3">{entry.content}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
