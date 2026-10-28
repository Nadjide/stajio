import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../services/api";
import type { Report } from "../../types/models";

export type SaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";

const SAVE_DELAY_MS = 1000;

/** Saves still running after their editor unmounted; a reopened editor waits for them. */
const pendingSaves = new Map<string, Promise<void>>();

export function waitForReportSave(id: string) {
  return pendingSaves.get(id) ?? Promise.resolve();
}

/**
 * Keeps the edited report on screen and saves it in the background, one request
 * at a time. The server rejects a stale revision, so another tab can never be
 * silently overwritten: the student chooses which version to keep.
 */
export function useReportAutosave(initial: Report) {
  const [report, setReport] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [conflict, setConflict] = useState<Report | null>(null);
  const reportRef = useRef(initial);
  const dirty = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);

  const save = useCallback(async (keepalive = false): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) await inFlight.current;
    if (!dirty.current || blocked.current) return;
    dirty.current = false;
    setStatus("saving");
    const sent = reportRef.current;
    const request = api.reports
      .save(sent, keepalive)
      .then((saved) => {
        // Keep anything typed meanwhile; only adopt the new revision and timestamps.
        reportRef.current = {
          ...reportRef.current,
          revision: saved.revision,
          updatedAt: saved.updatedAt,
          validatedAt: saved.validatedAt,
        };
        setReport(reportRef.current);
        setStatus(dirty.current ? "pending" : "saved");
      })
      .catch((error) => {
        dirty.current = true;
        if (error instanceof ApiError && error.status === 409) {
          blocked.current = true;
          setConflict((error.data as { current?: Report })?.current ?? null);
          setStatus("conflict");
        } else {
          setStatus("error");
        }
      })
      .finally(() => {
        inFlight.current = null;
        if (pendingSaves.get(sent.id) === request) pendingSaves.delete(sent.id);
      });
    inFlight.current = request;
    pendingSaves.set(sent.id, request);
    // Edits made meanwhile scheduled their own save, which waits for this one.
    await request;
  }, []);

  const update = useCallback(
    (change: (current: Report) => Report) => {
      const next = change(reportRef.current);
      const contentChanged = next.sections !== reportRef.current.sections || next.title !== reportRef.current.title;
      // Any correction after the final validation makes the report a draft again.
      reportRef.current =
        contentChanged && next.status === "validated" && reportRef.current.status === "validated"
          ? { ...next, status: "draft" }
          : next;
      setReport(reportRef.current);
      dirty.current = true;
      setStatus(blocked.current ? "conflict" : "pending");
      if (timer.current) clearTimeout(timer.current);
      if (!blocked.current) timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    [save],
  );

  /** Replace the local copy with a server version (after a restore or a conflict). */
  const replace = useCallback((next: Report) => {
    if (timer.current) clearTimeout(timer.current);
    blocked.current = false;
    dirty.current = false;
    reportRef.current = next;
    setReport(next);
    setConflict(null);
    setStatus("saved");
  }, []);

  /** Keep this tab's text, on top of the newer revision. */
  const overwrite = useCallback(async () => {
    if (!conflict) return;
    blocked.current = false;
    reportRef.current = { ...reportRef.current, revision: conflict.revision };
    setConflict(null);
    dirty.current = true;
    await save();
  }, [conflict, save]);

  useEffect(() => {
    const flush = () => void save(true);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      void save(true);
    };
  }, [save]);

  useEffect(() => {
    if (status !== "error") return;
    const retry = setTimeout(() => void save(), 5000);
    return () => clearTimeout(retry);
  }, [status, save]);

  return { report, status, conflict, update, replace, overwrite, flush: save };
}

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  saved: "Enregistré",
  pending: "Modifications en attente…",
  saving: "Enregistrement…",
  error: "Échec de l'enregistrement — nouvel essai automatique",
  conflict: "Conflit : modifié dans un autre onglet",
};
