"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface ConfirmDeleteProps {
  onDelete: () => void;
  label?: string;
}

export default function ConfirmDelete({ onDelete, label = "Delete?" }: ConfirmDeleteProps) {
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirming) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [confirming]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirming) {
      onDelete();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  return (
    <span
      ref={ref as any}
      onClick={handleClick}
      className={`inline-flex items-center gap-1 rounded-md transition-all flex-shrink-0 cursor-pointer ${
        confirming
          ? "px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40"
          : "p-1 text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100"
      }`}
      title={confirming ? "Click again to confirm" : "Delete"}
      role="button"
      tabIndex={-1}
    >
      <X className="w-3.5 h-3.5" />
      {confirming && <span>{label}</span>}
    </span>
  );
}
