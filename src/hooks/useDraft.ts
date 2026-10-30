import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";

export type DraftStatus = "loading" | "idle" | "pending" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 5000;

/** Pending saves of every mounted draft, flushed before logout. */
const pendingFlushes = new Set<() => Promise<void>>();

export async function flushAllDrafts() {
  await Promise.allSettled([...pendingFlushes].map((flush) => flush()));
}

/**
 * Autosaves a value under the current account. Drafts are stored by the server,
 * so they follow the account, never leak into another one, and are included in
 * backups. A value typed before the stored draft arrives is never overwritten.
 * `isEmpty` must be stable (defined at module level).
 */
export function useDraft<T>(key: string, initial: T, isEmpty: (value: T) => boolean) {
  const [value, setValueState] = useState<T>(initial);
  const [status, setStatus] = useState<DraftStatus>("loading");
  const [restored, setRestored] = useState(false);
  const valueRef = useRef(value);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initialValue] = useState(initial);

  const save = useCallback(
    async (keepalive = false) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (!dirty.current) return;
      dirty.current = false;
      const current = valueRef.current;
      setStatus("saving");
      try {
        if (isEmpty(current)) await api.drafts.delete(key);
        else await api.drafts.save(key, JSON.stringify(current), keepalive);
        setStatus(dirty.current ? "pending" : isEmpty(current) ? "idle" : "saved");
      } catch {
        // Keep the text on screen; the effect below tries again. It is never discarded.
        dirty.current = true;
        setStatus("error");
      }
    },
    [key, isEmpty],
  );

  useEffect(() => {
    if (status !== "error") return;
    const retry = setTimeout(() => void save(), RETRY_DELAY_MS);
    return () => clearTimeout(retry);
  }, [status, save]);

  useEffect(() => {
    let active = true;
    api.drafts
      .get(key)
      .then(({ draft }) => {
        if (!active || dirty.current || !draft) return;
        try {
          const parsed = JSON.parse(draft.content) as T;
          valueRef.current = parsed;
          setValueState(parsed);
          setRestored(true);
        } catch {
          // An unreadable draft is ignored rather than shown half-parsed.
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setStatus((previous) => (previous === "loading" ? "idle" : previous));
      });
    const flush = () => save(true);
    pendingFlushes.add(flush);
    const onHide = () => {
      if (document.visibilityState === "hidden") void save(true);
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      active = false;
      pendingFlushes.delete(flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      void save(true);
    };
  }, [key, save]);

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (previous: T) => T)(valueRef.current) : next;
      valueRef.current = resolved;
      setValueState(resolved);
      dirty.current = true;
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    [save],
  );

  /** Discards the draft once its content has been saved for real. */
  const clear = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    dirty.current = false;
    valueRef.current = initialValue;
    setValueState(initialValue);
    setRestored(false);
    setStatus("idle");
    await api.drafts.delete(key).catch(() => undefined);
  }, [key, initialValue]);

  return { value, setValue, status, restored, clear, flush: save };
}

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  loading: "Chargement du brouillon…",
  idle: "",
  pending: "Modifications non enregistrées…",
  saving: "Enregistrement du brouillon…",
  saved: "Brouillon enregistré",
  error: "Brouillon non enregistré — nouvel essai automatique",
};
