"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, List, Trash2, Calendar } from "lucide-react";
import OrbitsList from "@/components/OrbitsList";
import { createOrbit, getAllOrbits } from "@/lib/db";
import type { Orbit } from "@/types";

export default function OrbitsPage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [allOrbits, setAllOrbits] = useState<Orbit[]>([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => { (async () => { setAllOrbits(await getAllOrbits()); })(); }, [refresh]);

  const handleCreate = async () => {
    if (newName.trim()) {
      await createOrbit(newName.trim(), true, parentId);
      setNewName("");
      setParentId(null);
      setShowCreate(false);
      setRefresh(r => r + 1);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Write
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/reminders")} className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" title="Reminders">
            <Calendar className="w-3 h-3" />
          </button>
          <button onClick={() => router.push("/trash")} className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" title="Trash">
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={() => router.push("/entries")} className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" title="All entries">
            <List className="w-3 h-3" /> Feed
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800">
            <Plus className="w-3 h-3" /> New Orbit
          </button>
        </div>
      </nav>
      {showCreate && (
        <div className="fixed top-16 left-0 right-0 z-30 flex justify-center px-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-lg flex flex-col gap-2 w-full max-w-md">
            <div className="flex gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Orbit name..." className="flex-1 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-200 outline-none" onKeyDown={e => e.key === "Enter" && handleCreate()} autoFocus />
              <button onClick={handleCreate} className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-sm font-medium">Create</button>
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-zinc-400 hover:text-zinc-600 text-sm">Cancel</button>
            </div>
            {allOrbits.length > 0 && (
              <select value={parentId || ""} onChange={e => setParentId(e.target.value || null)}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 outline-none">
                <option value="">No parent (top-level orbit)</option>
                {allOrbits.map(o => <option key={o.id} value={o.id}>Sub-orbit of: {o.name}</option>)}
              </select>
            )}
          </div>
        </div>
      )}
      <OrbitsList refreshTrigger={refresh} />
    </div>
  );
}
