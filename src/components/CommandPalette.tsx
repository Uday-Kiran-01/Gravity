"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Calendar, Trash2, Zap, Plus, Compass, List } from "lucide-react";

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const commands = [
    { label: "Go to Feed", icon: List, action: () => router.push("/entries"), keywords: "all entries timeline" },
    { label: "Go to Orbits", icon: Compass, action: () => router.push("/orbits"), keywords: "orbits cosmos" },
    { label: "Go to Reminders", icon: Calendar, action: () => router.push("/reminders"), keywords: "reminders dates deadlines" },
    { label: "Go to Trash", icon: Trash2, action: () => router.push("/trash"), keywords: "trash deleted" },
    { label: "New Entry", icon: Plus, action: () => router.push("/"), keywords: "write new" },
    { label: "New Orbit", icon: Zap, action: () => { router.push("/orbits"); setTimeout(() => { const btn = document.querySelector('[title="New Orbit"]'); if (btn) (btn as HTMLButtonElement).click(); }, 200); }, keywords: "create orbit" },
  ];

  const filtered = query ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || c.keywords.includes(query.toLowerCase())) : commands;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <Search className="w-4 h-4 text-zinc-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Type a command..." autoFocus
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-200 outline-none placeholder-zinc-400" />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 font-mono">esc</kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.map(c => (
            <button key={c.label} onClick={() => { c.action(); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <c.icon className="w-4 h-4 text-zinc-400" /> {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
