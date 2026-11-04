import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans un ToastProvider");
  return ctx;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />,
  error: <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />,
  info: <Info className="h-5 w-5 shrink-0 text-blue-500" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), type === "error" ? 8000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg dark:border-stone-700 dark:bg-stone-900"
            >
              {ICONS[t.type]}
              <p className="flex-1 text-sm leading-snug text-stone-700 dark:text-stone-200">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-stone-500 hover:text-stone-600 dark:text-stone-400 dark:hover:text-stone-300"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
