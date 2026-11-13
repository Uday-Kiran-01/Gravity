"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Clock, Pencil, ArrowRightLeft, Tag, Check, X, Copy, Trash2, FileText, AlignLeft, Calendar, Activity, BarChart3, Hash, GitFork, Users, Zap, Minus, TrendingUp, Pause, Layers, Target, AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { Entry, Orbit } from "@/types";
import { getEntriesByOrbit, moveEntryToOrbit, getAllOrbits, editEntryContent, trashEntry, setEntryTags } from "@/lib/db";
import { scoreEntriesInOrbit } from "@/lib/ai/classifier";
import ConfirmDelete from "@/components/ConfirmDelete";
import OrbitCard from "@/components/OrbitCard";

interface OrbitViewProps { orbit: Orbit; }

export default function OrbitView({ orbit }: OrbitViewProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [allOrbits, setAllOrbits] = useState<Orbit[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [tagId, setTagId] = useState<string | null>(null);
  const [tagVal, setTagVal] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entryId: string } | null>(null);
  const [relevance, setRelevance] = useState<Record<string, number>>({});
  const [subOrbits, setSubOrbits] = useState<Orbit[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [organizing, setOrganizing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  const handleReorganize = async () => {
    setOrganizing(true);
    try {
      const { GravityEngine } = await import("@/lib/engine");
      // We need the engine instance — expose a global helper or call directly
      const response = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orbitId: orbit.id }),
      });
      if (response.ok) {
        // Refresh entries
        const e = await getEntriesByOrbit(orbit.id);
        setEntries(e);
        const all = await getAllOrbits();
        setSubOrbits(all.filter(o => o.parentOrbitId === orbit.id));
      }
    } catch {} 
    setOrganizing(false);
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    setSummary(null);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orbitId: orbit.id }),
      });
      const data = await response.json();
      setSummary(data.summary || "Could not generate summary.");
    } catch {
      setSummary("Something went wrong.");
    }
    setSummarizing(false);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      localStorage.setItem("gravity_last_orbit", orbit.id);
      const e = await getEntriesByOrbit(orbit.id);
      setEntries(e);
      const all = await getAllOrbits();
      setAllOrbits(all.filter(o => o.id !== orbit.id));
      setSubOrbits(all.filter(o => o.parentOrbitId === orbit.id));
      setLoading(false);
      // Score entries for relevance to this orbit
      if (e.length >= 3) {
        scoreEntriesInOrbit(orbit.name, e.map(en => ({ id: en.id, content: en.content })), orbit.id)
          .then(scores => setRelevance(Object.fromEntries(scores.map(s => [s.id, s.score]))));
      }
    })();
  }, [orbit.id]);

  useEffect(() => { if (!ctxMenu) return; const h = () => setCtxMenu(null); document.addEventListener("click", h); return () => document.removeEventListener("click", h); }, [ctxMenu]);

  const rel = (ts: number) => { const d = Date.now() - ts; if (d < 60000) return "just now"; if (d < 3600000) return Math.floor(d/60000)+"m ago"; if (d < 86400000) return Math.floor(d/3600000)+"h ago"; return Math.floor(d/86400000)+"d ago"; };
  const fmt = (ts: number) => { const d = new Date(ts); return d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }); };
  const isMd = (c: string) => /[#*`\[\]>\-]|^\d+\.\s/m.test(c);

  // ─── Orbit stats ───
  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const words = entries.map(e => e.wordCount);
    const totalWords = words.reduce((a, b) => a + b, 0);
    const avgWords = Math.round(totalWords / entries.length);
    const maxWords = Math.max(...words);
    const minWords = Math.min(...words);
    const times = entries.map(e => e.createdAt);
    const first = Math.min(...times);
    const last = Math.max(...times);
    const span = Math.ceil((last - first) / 86400000) + 1;
    const activeDays = new Set(entries.map(e => new Date(e.createdAt).toDateString())).size;
    const allTags = new Set(entries.flatMap(e => e.tags));
    const tagCount = allTags.size;
    const editedCount = entries.filter(e => e.editedAt).length;
    const todayEntries = entries.filter(e => new Date(e.createdAt).toDateString() === new Date().toDateString()).length;
    const wordsPerDay = activeDays > 0 ? Math.round(totalWords / activeDays) : totalWords;
    const density = activeDays > 0 ? (entries.length / activeDays).toFixed(1) : entries.length.toString();
    const sorted = [...times].sort((a, b) => a - b);
    let longestGap = 0;
    for (let i = 1; i < sorted.length; i++) { const g = Math.ceil((sorted[i] - sorted[i-1]) / 86400000); if (g > longestGap) longestGap = g; }
    const health = entries.length >= 3 ? Math.round(Object.values(relevance).reduce((s, v) => s + v, 0) / entries.length * 100) : null;
    return { totalWords, avgWords, maxWords, minWords, first, last, span, activeDays, tagCount, editedCount, todayEntries, wordsPerDay, density, longestGap, health };
  }, [entries, relevance]);

  const handleEdit = async (id: string) => { if (!editText.trim()) return; await editEntryContent(id, editText); setEntries(p => p.map(e => e.id===id ? { ...e, content: editText, editedAt: Date.now() } : e)); setEditingId(null); };
  const handleTrash = async (id: string) => { await trashEntry(id); setEntries(p => p.filter(e => e.id!==id)); };
  const handleMove = async (eid: string, tid: string | null) => { await moveEntryToOrbit(eid, tid); setEntries(p => p.filter(e => e.id!==eid)); setMovingId(null); };
  const handleAddTag = async (eid: string) => { const entry = entries.find(e => e.id===eid); if (!entry || !tagVal.trim()) return; const tags = [...new Set([...entry.tags, tagVal.trim().toLowerCase()])]; await setEntryTags(eid, tags); setEntries(p => p.map(e => e.id===eid ? { ...e, tags } : e)); setTagId(null); };
  const handleRemoveTag = async (eid: string, tag: string) => { const entry = entries.find(e => e.id===eid); if (!entry) return; const tags = entry.tags.filter(t => t!==tag); await setEntryTags(eid, tags); setEntries(p => p.map(e => e.id===eid ? { ...e, tags } : e)); };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <button onClick={() => router.push("/orbits")} className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 mb-8 text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> All Orbits
        </button>
        
        {/* Orbit header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: orbit.color }} />
          <div>
            <h1 className="text-2xl font-light text-zinc-900 dark:text-zinc-100 tracking-wide">{orbit.name}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{orbit.isUserCreated ? "Created by you" : "Discovered by Gravity"}{orbit.parentOrbitId ? " · Sub-orbit" : ""}</p>
          </div>
          {!orbit.parentOrbitId && entries.length >= 6 && subOrbits.length === 0 && (
            <button onClick={handleReorganize} disabled={organizing}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${organizing ? "animate-spin" : ""}`} />
              {organizing ? "Analyzing..." : "Re-organize"}
            </button>
          )}
          {entries.length >= 3 && (
            <button onClick={handleSummarize} disabled={summarizing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${summarizing ? "animate-spin" : ""}`} />
              {summarizing ? "Summarizing..." : "Summarize"}
            </button>
          )}
        </div>

        {/* AI Summary */}
        {summary && (
          <div className="mb-8 p-4 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800/30">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{summary}</p>
            <button onClick={() => setSummary(null)} className="mt-2 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">Dismiss</button>
          </div>
        )}

        {/* Sub-orbits — shown as full solar system cards */}
        {subOrbits.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Sub-orbits</span>
              <span className="text-[10px] text-zinc-500">({subOrbits.length})</span>
            </div>
            <div className="flex flex-wrap gap-6 justify-center">
              {subOrbits.map(sub => (
                <OrbitCard key={sub.id} orbit={sub} size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Stats panel — 15 metrics */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-10">
            <Stat label="Entries" value={entries.length} icon={<FileText className="w-3 h-3" />} color={orbit.color} />
            <Stat label="Words" value={stats.totalWords.toLocaleString()} icon={<AlignLeft className="w-3 h-3" />} />
            <Stat label="Avg length" value={`${stats.avgWords}w`} icon={<BarChart3 className="w-3 h-3" />} />
            <Stat label="Longest" value={`${stats.maxWords}w`} icon={<Zap className="w-3 h-3" />} />
            <Stat label="Shortest" value={`${stats.minWords}w`} icon={<Minus className="w-3 h-3" />} />
            <Stat label="Active days" value={stats.activeDays} icon={<Activity className="w-3 h-3" />} />
            <Stat label="First entry" value={fmt(stats.first)} icon={<Calendar className="w-3 h-3" />} />
            <Stat label="Last active" value={rel(stats.last)} icon={<Clock className="w-3 h-3" />} />
            <Stat label="Span" value={`${stats.span}d`} icon={<GitFork className="w-3 h-3" />} />
            <Stat label="Longest gap" value={stats.longestGap > 0 ? `${stats.longestGap}d` : "—"} icon={<Pause className="w-3 h-3" />} />
            <Stat label="Words/day" value={stats.wordsPerDay} icon={<TrendingUp className="w-3 h-3" />} />
            <Stat label="Density" value={`${stats.density}/day`} icon={<Layers className="w-3 h-3" />} />
            <Stat label="Edited" value={stats.editedCount} icon={<Pencil className="w-3 h-3" />} />
            <Stat label="Tags" value={stats.tagCount} icon={<Hash className="w-3 h-3" />} />
            <Stat label="Today" value={stats.todayEntries} icon={<Users className="w-3 h-3" />} />
            {stats.health !== null && <Stat label="Health" value={`${stats.health}%`} icon={<Target className="w-3 h-3" />} color={stats.health >= 80 ? "#10b981" : stats.health >= 50 ? "#f59e0b" : "#ef4444"} />}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800/20 animate-pulse" />)}</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16"><p className="text-zinc-400 dark:text-zinc-500 text-sm">No entries yet.</p></div>
        ) : (
          <div className="space-y-4">
            {[...entries].sort((a, b) => (relevance[b.id] ?? 0.5) - (relevance[a.id] ?? 0.5)).slice(0, visibleCount).map(entry => {
              const relScore = relevance[entry.id];
              const tier = relScore !== undefined ? (relScore >= 0.8 ? "core" : relScore >= 0.5 ? "peripheral" : "misfit") : null;
              return (
              <div key={entry.id} className={`group bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border transition-colors p-4 ${
                tier === "core" ? "border-l-2 border-l-emerald-400/60 border-zinc-200 dark:border-zinc-800/30" :
                tier === "peripheral" ? "border-l-2 border-l-amber-400/40 border-zinc-200 dark:border-zinc-800/30" :
                tier === "misfit" ? "border-l-2 border-l-red-400/50 border-zinc-200 dark:border-zinc-800/30" :
                "border-zinc-200 dark:border-zinc-800/30"
              } hover:border-zinc-300 dark:hover:border-zinc-700/50`} onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, entryId: entry.id }); }}>
                {/* Meta row */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {tier && (
                    <span title={tier === "core" ? "Core — directly about this orbit" : tier === "peripheral" ? "Peripheral — tangentially related" : "Misfit — may belong elsewhere"} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      tier === "core" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                      tier === "peripheral" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    }`}>
                      {tier === "core" ? "● Core" : tier === "peripheral" ? "◐ Peripheral" : "○ Misfit"}
                    </span>
                  )}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" />{rel(entry.createdAt)}</span>
                  {entry.editedAt && <span className="text-[10px] text-zinc-400">edited</span>}
                  <span className="text-[10px] text-zinc-400">{entry.wordCount}w</span>
                  {entry.tags.map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center gap-1">{t}<button onClick={() => handleRemoveTag(entry.id, t)} className="hover:text-red-400">&times;</button></span>
                  ))}
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setEditingId(entry.id); setEditText(entry.content); }} className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800" title="Edit"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => { setTagId(entry.id); setTagVal(""); }} className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800" title="Tag"><Tag className="w-3 h-3" /></button>
                    <button onClick={() => setMovingId(movingId===entry.id ? null : entry.id)} className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800" title="Move"><ArrowRightLeft className="w-3 h-3" /></button>
                    <ConfirmDelete onDelete={() => handleTrash(entry.id)} />
                  </div>
                </div>

                {/* Tag input */}
                {tagId === entry.id && (
                  <div className="mb-2 flex items-center gap-1">
                    <input value={tagVal} onChange={e => setTagVal(e.target.value)} onKeyDown={e => { if (e.key==="Enter") handleAddTag(entry.id); if (e.key==="Escape") setTagId(null); }}
                      placeholder="Add tag..." autoFocus className="text-[11px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 outline-none text-zinc-700 dark:text-zinc-300 w-24" />
                  </div>
                )}

                {/* Move dropdown */}
                {movingId === entry.id && (
                  <div className="mb-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-1 shadow-lg">
                    <button onClick={() => handleMove(entry.id, null)} className="w-full text-left px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30">Move to Nest</button>
                    <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1" />
                    {allOrbits.map(o => <button key={o.id} onClick={() => handleMove(entry.id, o.id)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: o.color }} />{o.name}</button>)}
                  </div>
                )}

                {/* Content */}
                {editingId === entry.id ? (
                  <div>
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} className="w-full min-h-[80px] bg-transparent text-sm text-zinc-700 dark:text-zinc-300 outline-none resize-none leading-relaxed" autoFocus />
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => handleEdit(entry.id)} className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium"><Check className="w-3 h-3" /> Save</button>
                      <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded text-xs text-zinc-500"><X className="w-3 h-3 inline mr-1" />Cancel</button>
                    </div>
                  </div>
                ) : isMd(entry.content) ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 leading-relaxed prose-headings:text-zinc-900 dark:prose-headings:text-zinc-200 prose-a:text-indigo-500 prose-code:text-zinc-800 dark:prose-code:text-zinc-200 prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs">
                    <ReactMarkdown>{entry.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                )}
              </div>
            ); })}
            {entries.length > visibleCount && (
              <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="w-full py-3 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-xl transition-colors">
                Load more ({entries.length - visibleCount} remaining)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <button onClick={() => { const e = entries.find(en => en.id===ctxMenu.entryId); if (e) { setEditingId(e.id); setEditText(e.content); } setCtxMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"><Pencil className="w-3 h-3" /> Edit</button>
          <button onClick={() => { navigator.clipboard.writeText(entries.find(e => e.id===ctxMenu.entryId)?.content||""); setCtxMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"><Copy className="w-3 h-3" /> Copy</button>
          <button onClick={() => { handleTrash(ctxMenu.entryId); setCtxMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"><Trash2 className="w-3 h-3" /> Trash</button>
        </div>
      )}
    </div>
  );
}

// ─── Stat pill ───
function Stat({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700/60 transition-colors group">
      <span className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 leading-none">{label}</div>
        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate" style={color ? { color } : undefined}>{value}</div>
      </div>
    </div>
  );
}
