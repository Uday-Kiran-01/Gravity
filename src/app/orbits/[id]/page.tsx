"use client";

// ─── Individual Orbit Page: Chronological Timeline ───
// Shows every entry in an Orbit, newest first.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Orbit } from "@/types";
import { getOrbitById } from "@/lib/db";
import OrbitView from "@/components/OrbitView";

export default function OrbitPage() {
  const params = useParams();
  const [orbit, setOrbit] = useState<Orbit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const found = await getOrbitById(params.id as string);
      setOrbit(found ?? null);
      setLoading(false);
    };
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 dark:text-zinc-500 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!orbit) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 dark:text-zinc-400">Orbit not found.</p>
        </div>
      </div>
    );
  }

  return <OrbitView orbit={orbit} />;
}
