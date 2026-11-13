"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bird, Sparkles, Search, X } from "lucide-react";
import ConfirmDelete from "@/components/ConfirmDelete";
import { classifyNestEntry } from "@/lib/ai/classifier";
import type { Orbit, Entry } from "@/types";
import { getOrbitSummaries } from "@/lib/orbits";
import { getUnclassifiedEntries, deleteEntry, deleteOrbit, updateOrbit } from "@/lib/db";

interface OrbitsListProps { refreshTrigger?: number; }

type OrbitNode = { orbit: Orbit; children: OrbitNode[] };

function buildTree(orbits: Orbit[]): OrbitNode[] {
  const map = new Map<string, OrbitNode>();
  const roots: OrbitNode[] = [];
  for (const o of orbits) map.set(o.id, { orbit: o, children: [] });
  for (const o of orbits) {
    const node = map.get(o.id)!;
    if (o.parentOrbitId && map.has(o.parentOrbitId)) {
      map.get(o.parentOrbitId)!.children.push(node);
    } else { roots.push(node); }
  }
  // Sort children by last active
  const sortFn = (a: OrbitNode, b: OrbitNode) => b.orbit.lastActiveAt - a.orbit.lastActiveAt;
  for (const [, node] of map) node.children.sort(sortFn);
  return roots.sort(sortFn);
}

function countTree(nodes: OrbitNode[]): number {
  return nodes.reduce((s, n) => s + 1 + countTree(n.children), 0);
}

export default function OrbitsList({ refreshTrigger }: OrbitsListProps) {
  const r = useRouter();
  const [tree, setTree] = useState<OrbitNode[]>([]);
  const [nest, setNest] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [q, setQ] = useState("");
  const [letter, setLetter] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [orbits, unclassified] = await Promise.all([getOrbitSummaries(), getUnclassifiedEntries()]);
      setTree(buildTree(orbits));
      setNest(unclassified); setLoading(false);
    })();
  }, [refreshTrigger]);

  const fmt = (ts: number) => { const d = Date.now() - ts; if (d < 60000) return "Just now"; if (d < 3600000) return Math.floor(d/60000)+"m"; if (d < 86400000) return Math.floor(d/3600000)+"h"; return Math.floor(d/86400000)+"d"; };
  const total = countTree(tree);
  const sq = q.toLowerCase().trim();
  const fNest = sq ? nest.filter(e => e.content.toLowerCase().includes(sq)) : nest;

  // Flatten tree for A-Z grouping
  const flattenTree = (nodes: OrbitNode[]): OrbitNode[] => nodes.flatMap(n => [n, ...flattenTree(n.children)]);
  const flatOrbits = flattenTree(tree);

  const byLetter = new Map<string, OrbitNode[]>();
  for (const o of flatOrbits) { const l = o.orbit.name.charAt(0).toUpperCase(); if (!byLetter.has(l)) byLetter.set(l, []); byLetter.get(l)!.push(o); }
  const letters = Array.from(byLetter.keys()).sort();
  // Only show top-level orbits on main page. Sub-orbits appear when you click inside.
  const displayList = letter ? (byLetter.get(letter) || []) : tree;
  const isFlatMode = false;

  const delOrbit = async (id: string) => { await deleteOrbit(id); const orbits = await getOrbitSummaries(); setTree(buildTree(orbits)); };
  const delEntry = async (id: string) => { await deleteEntry(id); setNest(p => p.filter(e => e.id !== id)); };
  const classify = async (ev: React.MouseEvent, eid: string, content: string) => {
    ev.stopPropagation(); ev.preventDefault();
    setClassifying(p => new Set(p).add(eid));
    try { const result = await classifyNestEntry(eid, content); if (result.type === "existing_pattern") { setNest(p => p.filter(e => e.id !== eid)); const orbits = await getOrbitSummaries(); setTree(buildTree(orbits)); } } catch {}
    setClassifying(p => { const n = new Set(p); n.delete(eid); return n; });
  };
  const saveEdit = async (id: string) => { if (editName.trim()) { await updateOrbit(id, { name: editName.trim() }); const orbits = await getOrbitSummaries(); setTree(buildTree(orbits)); } setEditId(null); };
  const setColor = async (id: string, c: string) => { await updateOrbit(id, { color: c }); const orbits = await getOrbitSummaries(); setTree(buildTree(orbits)); };

  const C = ["#6366f1","#06b6d4","#10b981","#f59e0b","#ef4444"];

  const Stars = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 150 }).map((_, i) => (
        <div key={i} className="absolute rounded-full animate-pulse"
          style={{ width: (i%7===0?2:0.5)+"px", height: (i%7===0?2:0.5)+"px", backgroundColor: i%9===0?"rgba(180,210,255,0.8)":"white", left: ((i*137+53)%100)+"%", top: ((i*251+89)%100)+"%", animationDelay: (i*0.17%6)+"s", animationDuration: (1.5+i%4)+"s", opacity: 0.1+(i%7)*0.1 }} />
      ))}
    </div>
  );

  const SolarSystem = memo(function SolarSystem({ node, depth = 0, flat = false }: { node: OrbitNode; depth?: number; flat?: boolean }) {
    const { orbit, children } = node;
    const editing = editId === orbit.id;
    // Show sub-orbit count if it has children, otherwise entry count
    const displayCount = children.length > 0 ? children.length : orbit.entryCount;
    const pc = Math.min(displayCount, 8);
    const S = depth === 0 ? 180 : depth === 1 ? 140 : 110;
    const hasKids = children.length > 0;
    const showKids = hasKids && !flat;
    return (
      <div className="group relative flex flex-col items-center">
        <button onClick={() => !editing && r.push(`/orbits/${orbit.id}`)} className="relative flex items-center justify-center transition-transform hover:scale-105" style={{ width: S, height: S }}>
          <div className="absolute rounded-full border" style={{ width: S*.78, height: S*.78, borderColor: orbit.color+"20" }} />
          {Array.from({ length: pc }).map((_, i) => { const a = (i/pc)*360; const rad = S*.33; return <div key={i} className="absolute rounded-full" style={{ width: Math.max(4, 8-depth*2), height: Math.max(4, 8-depth*2), background: orbit.color+"90", boxShadow: `0 0 5px ${orbit.color}50`, top: "calc(50% - 2px)", left: "calc(50% - 2px)", transform: `rotate(${a}deg) translateY(-${rad}px)` }} />; })}
          <div className="relative rounded-full flex items-center justify-center" style={{ width: S*.33, height: S*.33, background: `radial-gradient(circle at 35% 30%, ${orbit.color}cc, ${orbit.color}60 50%, ${orbit.color}20)`, boxShadow: `0 0 ${S*.07}px ${orbit.color}70, 0 0 ${S*.14}px ${orbit.color}30`, animation: "pulse 2.5s ease-in-out infinite" }}>
            <div className="absolute rounded-full" style={{ width: "28%", height: "18%", background: "rgba(255,255,255,0.3)", top: "18%", left: "15%", borderRadius: "50%", transform: "rotate(-25deg)" }} />
            <span className="text-white/90 font-bold z-10 drop-shadow-md" style={{ fontSize: depth===0?14:depth===1?12:10 }}>{displayCount}</span>
          </div>
        </button>
        <div className="mt-2 flex flex-col items-center gap-1">
          {editing ? (
            <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key==="Enter") saveEdit(orbit.id); if (e.key==="Escape") setEditId(null); }} onBlur={() => saveEdit(orbit.id)} onClick={e => e.stopPropagation()} className="text-xs font-medium bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 outline-none text-zinc-200 text-center w-28" autoFocus />
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">{orbit.name}</span>
              {hasKids && <span className="text-[10px] text-zinc-600">+{children.length}</span>}
              <button onClick={e => { e.stopPropagation(); e.preventDefault(); setEditId(orbit.id); setEditName(orbit.name); }} className="text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-all text-[10px]">✎</button>
            </div>
          )}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
            {C.map(c => <button key={c} onClick={e => { e.stopPropagation(); e.preventDefault(); setColor(orbit.id, c); }} className="w-2.5 h-2.5 rounded-full hover:scale-150 transition-transform" style={{ backgroundColor: c, boxShadow: orbit.color===c?`0 0 4px ${c}`:"none" }} />)}
            <ConfirmDelete onDelete={() => delOrbit(orbit.id)} />
          </div>
        </div>
        {/* Recursive children — render sub-orbits indented (only in tree mode) */}
        {showKids && (
          <div className="mt-6 flex flex-wrap justify-center gap-4 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 bg-zinc-700/50" />
            {children.map(child => (
              <div key={child.orbit.id} className="relative pt-4">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 bg-zinc-700/50" />
                <SolarSystem node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  });

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      <Stars />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-20 pb-32">
        <div className="mb-12">
          <h1 className="text-4xl font-thin text-zinc-200 tracking-[0.2em] uppercase text-center">Your Cosmos</h1>
          <p className="text-xs text-zinc-500 mt-3 text-center tracking-widest">{tree.length} system{tree.length!==1?"s":""} · {nest.length} unformed</p>
          <div className="mt-6 max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search the cosmos..." className="w-full pl-11 pr-10 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-full text-sm text-zinc-300 outline-none focus:border-zinc-600 transition-colors placeholder-zinc-600 backdrop-blur-sm" />
            {q && <button onClick={() => setQ("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-32"><div className="w-20 h-20 rounded-full border-2 border-zinc-800 border-t-zinc-500 animate-spin" /></div>
        ) : (
          <>
            {fNest.length > 0 && (
              <div className="mb-16">
                <div className="flex items-center justify-center gap-2 mb-5"><Bird className="w-4 h-4 text-amber-400" /><h2 className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-[0.3em]">Unformed Matter</h2><span className="text-[10px] text-amber-600">{fNest.length}</span></div>
                <div className="max-w-lg mx-auto rounded-3xl border border-amber-800/20 bg-amber-950/10 backdrop-blur-sm overflow-hidden divide-y divide-amber-800/10">
                  {fNest.map(e => (
                    <div key={e.id} className="px-5 py-3 group flex items-start justify-between hover:bg-amber-950/20 transition-colors">
                      <div className="min-w-0 flex-1"><div className="flex items-center gap-2 mb-1"><span className="text-[10px] text-zinc-500">{fmt(e.createdAt)}</span><span className="text-[10px] text-zinc-600">{e.wordCount}w</span></div><p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{e.content}</p></div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                        <button onClick={ev => classify(ev, e.id, e.content)} disabled={classifying.has(e.id)} className="p-1.5 rounded-lg text-zinc-600 hover:text-amber-400 hover:bg-amber-950/30 opacity-0 group-hover:opacity-100 transition-all" title="Classify"><Sparkles className={"w-3.5 h-3.5"+(classifying.has(e.id)?" animate-pulse text-amber-400":"")} /></button>
                        <ConfirmDelete onDelete={() => delEntry(e.id)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {displayList.length > 0 ? (
              <div className="flex gap-8">
                {/* A-Z letter groups — all orbits including sub-orbits */}
                <div className="flex-1 space-y-12">
                  {(letter ? [letter] : letters).map(l => {
                    const group = isFlatMode ? displayList : displayList.filter(n => n.orbit.name.charAt(0).toUpperCase() === l);
                    if (group.length === 0) return null;
                    return (
                      <div key={l}>
                        <div className="flex items-center gap-3 mb-6">
                          <span className="text-3xl font-thin text-zinc-500">{l}</span>
                          <div className="flex-1 h-px bg-zinc-800" />
                        </div>
                        <div className="flex flex-wrap gap-8">
                          {group.map(n => <SolarSystem key={n.orbit.id} node={n} flat={true} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* A-Z index sidebar */}
                {letters.length > 1 && !sq && (
                  <div className="hidden md:flex flex-col gap-0.5 sticky top-24 self-start pr-2">
                    <button onClick={() => setLetter(null)} className={`text-[11px] w-6 h-6 rounded flex items-center justify-center transition-colors ${!letter ? "text-zinc-200 bg-zinc-800" : "text-zinc-600 hover:text-zinc-400"}`}>All</button>
                    {letters.map(l => {
                      const active = letter === l;
                      return (
                        <button key={l} onClick={() => setLetter(active ? null : l)}
                          className={`text-[11px] w-6 h-6 rounded flex items-center justify-center transition-colors ${active ? "text-zinc-200 bg-zinc-800" : "text-zinc-600 hover:text-zinc-400"}`}>
                          {l}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : tree.length === 0 && nest.length === 0 && !sq ? (
              <div className="text-center py-24">
                <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg" style={{ background: "radial-gradient(circle at 40% 35%, #fef3c7, #f59e0b 40%, #d97706 70%, #92400e)", boxShadow: "0 0 40px #f59e0b30" }}><div className="w-12 h-12 rounded-full bg-zinc-800 animate-pulse" /></div>
                <p className="text-zinc-500 text-sm mt-2">Empty cosmos.</p>
                <p className="text-zinc-700 text-xs mt-1">Start writing to create your first solar system.</p>
              </div>
            ) : sq ? (
              <div className="text-center py-16"><p className="text-zinc-500 text-sm">Nothing matches &ldquo;{sq}&rdquo;</p></div>
            ) : null}
          </>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}`}</style>
    </div>
  );
}
