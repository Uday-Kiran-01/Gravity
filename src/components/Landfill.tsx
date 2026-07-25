"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createEntry, updateEntryContent, getDraftEntry } from "@/lib/db";
import type { Entry } from "@/types";

interface LandfillProps {
  onEntryComplete: (entry: Entry) => void;
  onUserActivity: (entry: Entry) => void;
  onUserIdle: () => void;
}

export default function Landfill({ onEntryComplete, onUserActivity, onUserIdle }: LandfillProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const draft = await getDraftEntry();
      if (draft) { setEntry(draft); setContent(draft.content); }
      setTimeout(() => textareaRef.current?.focus(), 100);
    })();
  }, []);

  const saveContent = useCallback(async (text: string, currentEntry: Entry) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      await updateEntryContent(currentEntry.id, text);
      setIsSaving(false);
    }, 500);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => onUserIdle(), 5 * 60 * 1000);
  }, [onUserIdle]);

  const handleChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    let cur = entry;
    if (!cur) { cur = await createEntry(newContent); setEntry(cur); }
    await saveContent(newContent, cur);
    if (cur) onUserActivity({ ...cur, content: newContent });
    resetIdleTimer();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (entry && content.trim()) { onEntryComplete({ ...entry, content }); setContent(""); setEntry(null); }
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) { textarea.style.height = "auto"; textarea.style.height = textarea.scrollHeight + "px"; }
  }, [content]);

  useEffect(() => () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="flex-1 flex items-start justify-center px-4 pt-24 pb-32">
        <div className="w-full max-w-2xl">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder=""
            autoFocus
            spellCheck
            className="w-full min-h-[40vh] bg-transparent text-zinc-900 dark:text-zinc-100 text-lg leading-relaxed resize-none outline-none border-none placeholder-transparent font-serif"
            style={{ caretColor: "#a1a1aa", lineHeight: "1.8" }}
          />
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-6 py-3 text-xs text-zinc-400 dark:text-zinc-500 select-none">
        <div className="flex items-center gap-4">
          <span>{wordCount > 0 ? `${wordCount} word${wordCount === 1 ? "" : "s"}` : "Write something..."}</span>
          {isSaving && <span className="text-zinc-400 dark:text-zinc-500 animate-pulse">Saving...</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-zinc-300 dark:text-zinc-600">Ctrl+Enter to finish</span>
        </div>
      </div>
    </div>
  );
}
