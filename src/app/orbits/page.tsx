"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, PenLine } from "lucide-react";
import OrbitsList from "@/components/OrbitsList";

export default function OrbitsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Write
        </button>
        <button onClick={() => router.push("/")} className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800">
          <PenLine className="w-3 h-3" /> New entry
        </button>
      </nav>
      <OrbitsList />
    </div>
  );
}
