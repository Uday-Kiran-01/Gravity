"use client";

// ─── Gravity Main Page: The Landfill ───
// The primary user experience: open app, see blank screen, write.
// Everything else is handled by the engine in the background.

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Compass, Settings, Key, X } from "lucide-react";
import Landfill from "@/components/Landfill";
import Notification, { type NotificationData } from "@/components/Notification";
import ConfirmationModal from "@/components/ConfirmationModal";
import ProductionGrid from "@/components/ProductionGrid";
import ReminderPanel from "@/components/ReminderPanel";
import ThemeToggle from "@/components/ThemeToggle";
import { GravityEngine } from "@/lib/engine";
import { createAIProvider, loadAIConfig, saveAIConfig } from "@/lib/ai/classifier";
import { logWritingSession } from "@/lib/db";
import type { Entry, AIProvider, AIProviderConfig, ClassificationResult, Reminder } from "@/types";

export default function Home() {
  const router = useRouter();
  const engineRef = useRef<GravityEngine | null>(null);
  const [notification, setNotification] = useState<NotificationData | null>(
    null
  );
  const [confirmOrbit, setConfirmOrbit] = useState<{
    name: string;
    confidence: number;
    resolve: (approved: boolean) => void;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const resolveRef = useRef<((approved: boolean) => void) | null>(null);

  // Initialize engine with stored config
  useEffect(() => {
    const config = loadAIConfig();
    setHasKey(!!config.apiKey);
    setApiKey(config.apiKey || "");

    const provider: AIProvider = createAIProvider(config);

    const engine = new GravityEngine(provider, {
      onClassified: (result: ClassificationResult) => {
        if (result.type === "existing_pattern") {
          setNotification({
            type: "classified",
            orbitName: result.orbitName,
            confidence: result.confidence,
          });
        } else if (result.type === "unclassified") {
          setNotification({
            type: "unclassified",
          });
        }
        setRefreshTrigger((t) => t + 1);
      },

      onNewPattern: async (orbitName: string, confidence: number) => {
        return new Promise((resolve) => {
          resolveRef.current = resolve;
          setConfirmOrbit({ name: orbitName, confidence, resolve });
        });
      },

      onReminderDetected: (reminder: Reminder) => {
        console.log("Reminder detected:", reminder.title);
        setRefreshTrigger((t) => t + 1);
      },

      onStateChange: (state) => {
        console.log("Engine state:", state);
      },
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
    };
  }, []);

  // Handle user typing activity
  const handleUserActivity = useCallback((entry: Entry) => {
    engineRef.current?.onUserActivity(entry);
  }, []);

  // Handle user idle (5 min no typing)
  const handleUserIdle = useCallback(() => {
    engineRef.current?.onUserIdle();
  }, []);

  // Handle manual entry completion (Ctrl+Enter)
  const handleEntryComplete = useCallback(
    async (entry: Entry) => {
      // Log the writing session
      const date = new Date().toISOString().split("T")[0];
      await logWritingSession(date, 1, entry.wordCount);

      // Process the entry immediately
      await engineRef.current?.forceProcess(entry);
      setRefreshTrigger((t) => t + 1);
    },
    []
  );

  // Settings handlers
  const handleSaveSettings = useCallback(() => {
    const config: AIProviderConfig = {
      provider: apiKey ? "deepseek" : "none",
      apiKey: apiKey || undefined,
    };
    saveAIConfig(config);
    setHasKey(!!apiKey);

    // Reload engine with new provider
    if (engineRef.current) {
      engineRef.current.setAIProvider(createAIProvider(config));
    }

    setShowSettings(false);
  }, [apiKey]);

  // Confirmation handlers
  const handleConfirmOrbit = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
    setConfirmOrbit(null);
  }, []);

  const handleDeclineOrbit = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setConfirmOrbit(null);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Navigation: minimal, top-right */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4">
        <div className="text-sm font-light text-zinc-400 dark:text-zinc-500 tracking-widest uppercase select-none">
          Gravity
        </div>
        <button
          onClick={() => router.push("/orbits")}
          className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          title="Explore your orbits"
        >
          <Compass className="w-3.5 h-3.5" />
          Orbits
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            hasKey ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400"
          }`}
          title="AI settings"
        >
          <Settings className="w-3 h-3" />
          {hasKey ? "AI on" : "AI off"}
        </button>
        <ThemeToggle />
      </nav>

      {/* Landfill: the core writing interface */}
      <Landfill
        onEntryComplete={handleEntryComplete}
        onUserActivity={handleUserActivity}
        onUserIdle={handleUserIdle}
      />

      {/* Reminder Panel: floating, subtle */}
      <ReminderPanel
        refreshTrigger={refreshTrigger}
        onNavigate={(entryId, orbitId) => {
          if (orbitId) {
            router.push(`/orbits/${orbitId}`);
          } else {
            router.push("/orbits");
          }
        }}
      />

      {/* Production Grid: at the bottom */}
      <ProductionGrid refreshTrigger={refreshTrigger} />

      {/* Notification toast */}
      <Notification
        data={notification}
        onDismiss={() => setNotification(null)}
      />

      {/* Confirmation modal for new patterns */}
      {confirmOrbit && (
        <ConfirmationModal
          orbitName={confirmOrbit.name}
          confidence={confirmOrbit.confidence}
          onConfirm={handleConfirmOrbit}
          onDecline={handleDeclineOrbit}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">AI Settings</span>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block mb-2 text-xs text-zinc-500 dark:text-zinc-500">
              DeepSeek API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 mb-2 font-mono"
              autoFocus
            />
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mb-4">
              Your key stays in your browser. Never sent anywhere except directly to DeepSeek.
            </p>

            <button
              onClick={handleSaveSettings}
              className="w-full py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all text-sm font-medium"
            >
              {apiKey ? "Save & Enable AI" : "Disable AI"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
