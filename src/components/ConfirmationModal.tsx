"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

interface ConfirmationModalProps {
  orbitName: string;
  confidence: number;
  onConfirm: () => void;
  onDecline: () => void;
}

export default function ConfirmationModal({ orbitName, confidence, onConfirm, onDecline }: ConfirmationModalProps) {
  const [closing, setClosing] = useState(false);
  const decline = () => { setClosing(true); setTimeout(onDecline, 200); };
  const confirm = () => { setClosing(true); setTimeout(onConfirm, 200); };

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    const timer = setTimeout(decline, 10000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm">
      <div className={`bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl transition-all duration-200 ${closing ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Gravity noticed a new pattern</span>
          </div>
        </div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">&ldquo;{orbitName}&rdquo;</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Create this memory orbit? Future notes like this will be automatically routed here.</p>
        <div className="mb-6">
          <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500 mb-1"><span>Confidence</span><span>{Math.round(confidence * 100)}%</span></div>
          <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${confidence * 100}%` }} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={decline} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-sm">No, thanks</button>
          <button onClick={confirm} className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all text-sm font-medium">Create Orbit</button>
        </div>
      </div>
    </div>
  );
}
