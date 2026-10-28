import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { useToast } from "../ui/Toast";
import type { LogEntry, Skill, UserProfile } from "../../types/models";
import { inputClass } from "./noteFields";
import { NoteCard } from "./NoteCard";
import { NoteComposer } from "./NoteComposer";

export type DataStatus = "loading" | "ready" | "error";

type Props = {
  profile: UserProfile;
  logs: LogEntry[];
  skills: Skill[];
  status: DataStatus;
  onRefresh: () => Promise<void>;
  onSkillsChanged: () => Promise<void>;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function matches(log: LogEntry, query: string) {
  if (!query) return true;
  const haystack = normalize(
    [log.rawContent, log.summary, ...(log.missions ?? []), ...(log.technologies ?? []), ...(log.skills ?? [])].join(
      " ",
    ),
  );
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function JournalTab({ profile, logs, skills, status, onRefresh, onSkillsChanged }: Props) {
  const { toast } = useToast();
  const [composing, setComposing] = useState(false);
  const [structureId, setStructureId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const visible = useMemo(
    () => logs.filter((log) => matches(log, query) && (!from || log.date >= from) && (!to || log.date <= to)),
    [logs, query, from, to],
  );
  const filtered = !!(query || from || to);

  const saved = async (id: string) => {
    setComposing(false);
    await onRefresh();
    toast("Note enregistrée.", "success");
    // Offer structuring for this note, without starting the AI automatically.
    setStructureId(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Journal de bord</h2>
          <p className="text-stone-500 dark:text-stone-400">
            Note tes activités : elles servent de preuves pour tes compétences et ton rapport.
          </p>
        </div>
        {!composing && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white transition-all hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            <Plus className="h-5 w-5" aria-hidden />
            Nouvelle note
          </button>
        )}
      </div>

      {composing && <NoteComposer profile={profile} onSaved={saved} onCancel={() => setComposing(false)} />}

      {structureId && logs.some((log) => log.id === structureId) && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          <span className="flex-1">
            Ta note est enregistrée. Veux-tu que l'IA propose un résumé, des missions et des compétences ?
          </span>
          <button
            type="button"
            onClick={() => {
              document.getElementById(`note-${structureId}`)?.scrollIntoView({ behavior: "smooth" });
              setStructureId(`structure:${structureId}`);
            }}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white"
          >
            Structurer avec l'IA
          </button>
          <button type="button" onClick={() => setStructureId(null)} className="rounded-lg px-3 py-1.5 font-medium">
            Plus tard
          </button>
        </div>
      )}

      <section
        aria-label="Rechercher dans le journal"
        className="mb-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-[1fr_auto_auto_auto] dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="relative">
          <label htmlFor="journal-search" className="sr-only">
            Rechercher un mot dans les notes
          </label>
          <Search className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-stone-400" aria-hidden />
          <input
            id="journal-search"
            type="search"
            className={`${inputClass} pl-9`}
            placeholder="Rechercher (mot, outil, mission…)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="journal-from" className="text-xs text-stone-500 dark:text-stone-400">
            Du
          </label>
          <input
            id="journal-from"
            type="date"
            className={inputClass}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="journal-to" className="text-xs text-stone-500 dark:text-stone-400">
            Au
          </label>
          <input
            id="journal-to"
            type="date"
            className={inputClass}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setFrom("");
            setTo("");
          }}
          disabled={!filtered}
          className="rounded-xl px-3 py-2 text-sm text-stone-500 hover:bg-stone-50 disabled:opacity-40 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          Réinitialiser
        </button>
      </section>

      {status === "loading" && (
        <div className="flex items-center justify-center gap-3 py-16 text-stone-500 dark:text-stone-400" role="status">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> Chargement du journal…
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
        >
          <p className="flex-1">
            Impossible de récupérer ton journal. Tes notes ne sont pas perdues ; vérifie que Stajio tourne puis
            réessaie.
          </p>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Réessayer
          </button>
        </div>
      )}

      {status === "ready" && (
        <div className="space-y-6">
          {filtered && (
            <p className="text-sm text-stone-500 dark:text-stone-400" aria-live="polite">
              {visible.length} note{visible.length > 1 ? "s" : ""} sur {logs.length}
            </p>
          )}
          {logs.length === 0 && !composing && (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center dark:border-stone-700 dark:bg-stone-900">
              <p className="text-stone-500 dark:text-stone-400">
                Aucune note pour l'instant. Raconte ta première journée ou ta première semaine : l'IA n'est pas
                nécessaire pour commencer.
              </p>
            </div>
          )}
          {logs.length > 0 && visible.length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-center text-stone-500 dark:bg-stone-900 dark:text-stone-400">
              Aucune note ne correspond à ta recherche.
            </p>
          )}
          {visible.map((log) => (
            <div key={log.id} id={`note-${log.id}`}>
              <NoteCard
                key={structureId === `structure:${log.id}` ? `${log.id}-structure` : log.id}
                log={log}
                profile={profile}
                skills={skills}
                autoStructure={structureId === `structure:${log.id}`}
                onChanged={onRefresh}
                onSkillsChanged={onSkillsChanged}
              />
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
