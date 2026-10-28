import { useState } from "react";
import { motion } from "motion/react";
import { GraduationCap, MessageCircle } from "lucide-react";
import type { LogEntry } from "../../types/models";
import { ChatPanel } from "./ChatPanel";
import { SimulationPanel } from "./SimulationPanel";

export function AssistantTab({ logs }: { logs: LogEntry[] }) {
  const [mode, setMode] = useState<"chat" | "simulation">("chat");

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex h-full max-w-5xl flex-col"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Assistant IA</h2>
          <p className="text-stone-500 dark:text-stone-400">
            Il s'appuie sur ton profil et ton journal. Tes échanges sont enregistrés et reprenables.
          </p>
        </div>
        <div
          className="flex rounded-xl bg-stone-100 p-1 dark:bg-stone-800"
          role="tablist"
          aria-label="Mode de l'assistant"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "chat"}
            onClick={() => setMode("chat")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${mode === "chat" ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-white" : "text-stone-500 dark:text-stone-400"}`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden /> Discussion
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "simulation"}
            onClick={() => setMode("simulation")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${mode === "simulation" ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-white" : "text-stone-500 dark:text-stone-400"}`}
          >
            <GraduationCap className="h-4 w-4" aria-hidden /> Simulation soutenance
          </button>
        </div>
      </div>
      {mode === "chat" ? <ChatPanel /> : <SimulationPanel hasLogs={logs.length > 0} />}
    </motion.div>
  );
}
