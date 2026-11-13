"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createEntry, updateEntryContent, getDraftEntry } from "@/lib/db";
import { Check, Sparkles, ExternalLink } from "lucide-react";
import type { Entry } from "@/types";
import type { EngineState } from "@/lib/engine";
import type { ClassificationResult } from "@/types";

interface LandfillProps {
  engineState: EngineState;
  classificationResult: ClassificationResult | null;
  onClearClassification: () => void;
  onEntryComplete: (entry: Entry) => void;
  onUserActivity: (entry: Entry) => void;
  onUserIdle: () => void;
}

export default function Landfill({ engineState, classificationResult, onClearClassification, onEntryComplete, onUserActivity, onUserIdle }: LandfillProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const draft = await getDraftEntry();
      if (draft) { setEntry(draft); setContent(draft.content); setDraftRestored(true); setTimeout(() => setDraftRestored(false), 3000); }
      setTimeout(() => textareaRef.current?.focus(), 100);
    })();
  }, []);

  const saveContent = useCallback(async (text: string, cur: Entry) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      await updateEntryContent(cur.id, text);
      setIsSaving(false);
    }, 500);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => onUserIdle(), 10 * 1000); // 10s
  }, [onUserIdle]);

  const handleChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    let cur = entry;
    if (!cur) { cur = await createEntry(val); setEntry(cur); }
    await saveContent(val, cur);
    if (cur) onUserActivity({ ...cur, content: val });
    resetIdleTimer();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (entry && content.trim()) { onEntryComplete({ ...entry, content }); setContent(""); setEntry(null); }
    }
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
  }, [content]);

  useEffect(() => () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="flex-1 flex items-start justify-center px-4 sm:px-6 pt-16 sm:pt-24 pb-32">
        <div className="w-full max-w-2xl">
          {/* Classification result — inline, flush above textarea */}
          {classificationResult && (
            <div className="mb-3 animate-in fade-in slide-in-from-top-2">
              {classificationResult.type === "existing_pattern" ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 shadow-sm">
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">
                    Added to{" "}
                    <button onClick={() => { onClearClassification(); router.push(`/orbits/${classificationResult.orbitId}`); }}
                      className="font-medium hover:underline inline-flex items-center gap-0.5">
                      {classificationResult.orbitName} <ExternalLink className="w-3 h-3" />
                    </button>
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); onClearClassification(); }} className="text-emerald-400 hover:text-emerald-600 ml-1">×</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 shadow-sm">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    Saved to{" "}
                    <button onClick={() => { onClearClassification(); router.push("/orbits"); }}
                      className="font-medium hover:underline inline-flex items-center gap-0.5">
                      Nest <ExternalLink className="w-3 h-3" />
                    </button>
                    {" "}— classify anytime
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); onClearClassification(); }} className="text-amber-400 hover:text-amber-600 ml-1">×</button>
                </div>
              )}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind?"
            autoFocus
            spellCheck
            className="w-full min-h-[40vh] sm:min-h-[50vh] bg-transparent text-zinc-900 dark:text-zinc-100 text-base sm:text-lg leading-relaxed resize-none outline-none border-none placeholder-zinc-300 dark:placeholder-zinc-600 font-serif"
            style={{ caretColor: "#a1a1aa", lineHeight: "1.8" }}
          />
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-4 sm:px-6 py-3 text-xs text-zinc-400 dark:text-zinc-500 select-none">
        <div className="flex items-center gap-3">
          <span>{wordCount > 0 ? `${wordCount} word${wordCount === 1 ? "" : "s"}` : "Start typing — Gravity listens for pauses."}</span>
          {engineState === "processing" && <span className="flex items-center gap-1 text-amber-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />Thinking...</span>}
          {draftRestored && <span className="text-emerald-500 animate-in fade-in">Draft restored</span>}
        </div>
        <span className="hidden sm:inline text-zinc-300 dark:text-zinc-600">{wordCount > 10 ? "Ctrl+Enter to finish" : ""}</span>
      </div>
    </div>
  );
}
