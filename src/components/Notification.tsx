"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";

export interface NotificationData {
  type: "classified" | "new_pattern" | "unclassified";
  orbitName?: string;
  confidence?: number;
}

interface NotificationProps { data: NotificationData | null; onDismiss: () => void; }

export default function Notification({ data, onDismiss }: NotificationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (data) { setVisible(true); const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, 4000); return () => clearTimeout(t); }
  }, [data, onDismiss]);

  if (!data) return null;

  const message = data.type === "classified" ? `Added to ${data.orbitName}` : data.type === "new_pattern" ? `New pattern detected: ${data.orbitName}` : "Saved to Nest";

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-800 dark:text-zinc-200 text-sm shadow-lg">
        {data.type === "classified" ? <Check className="w-4 h-4 text-emerald-500" /> : data.type === "new_pattern" ? <Sparkles className="w-4 h-4 text-amber-400" /> : <Check className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />}
        <span>{message}</span>
        {data.confidence !== undefined && data.confidence > 0 && <span className="text-xs text-zinc-400 dark:text-zinc-500">{Math.round(data.confidence * 100)}%</span>}
      </div>
    </div>
  );
}
