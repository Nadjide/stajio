import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Award, Check, GitMerge, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "../../services/api";
import { useToast } from "../ui/Toast";
import type { LogEntry, Skill, SkillLevel, UserProfile } from "../../types/models";
import { isCalendarDate } from "../../utils/internship";
import { SKILL_LEVEL_LABELS, SKILL_LEVEL_STYLES, SKILL_LEVELS, skillSuggestions } from "../../utils/skills";

type Props = {
  profile: UserProfile;
  logs: LogEntry[];
  skills: Skill[];
  onChanged: () => Promise<void>;
};

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-700 dark:text-white";

const noteLabel = (log: LogEntry) =>
  `${isCalendarDate(log.date) ? format(parseISO(log.date), "dd MMM yyyy", { locale: fr }) : log.date} — ${log.rawContent.slice(0, 80)}${log.rawContent.length > 80 ? "…" : ""}`;

function LevelSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: SkillLevel;
  onChange: (level: SkillLevel) => void;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      className={inputClass}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as SkillLevel)}
    >
      {SKILL_LEVELS.map((level) => (
        <option key={level.value} value={level.value} className="dark:bg-stone-900">
          {level.label}
        </option>
      ))}
    </select>
  );
}

function SkillCard({
  skill,
  skills,
  logs,
  onChanged,
}: {
  skill: Skill;
  skills: Skill[];
  logs: LogEntry[];
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(skill.label);
  const [goal, setGoal] = useState(skill.goal);
  const [evidenceChoice, setEvidenceChoice] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const evidence = logs.filter((log) => skill.logIds.includes(log.id));
  const candidates = logs.filter((log) => !skill.logIds.includes(log.id));
  const others = skills.filter((item) => item.id !== skill.id);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await action();
      await onChanged();
      if (success) toast(success, "success");
      return true;
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "L'opération a échoué.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!label.trim()) return;
    if (
      await run(
        () => api.skills.update(skill.id, { label: label.trim(), goal: goal.trim() }),
        "Compétence mise à jour.",
      )
    ) {
      setEditing(false);
    }
  };

  const merge = async () => {
    const target = others.find((item) => item.id === mergeTarget);
    if (!target) return;
    if (
      !window.confirm(
        `Fusionner « ${skill.label} » dans « ${target.label} » ? Les preuves seront regroupées et « ${skill.label} » sera supprimée.`,
      )
    )
      return;
    await run(
      () => api.skills.merge(skill.id, target.id),
      `« ${skill.label} » a été fusionnée dans « ${target.label} ».`,
    );
  };

  const remove = async () => {
    if (!window.confirm(`Supprimer la compétence « ${skill.label} » ? Les notes du journal ne sont pas supprimées.`))
      return;
    await run(() => api.skills.delete(skill.id), "Compétence supprimée.");
  };

  return (
    <article
      aria-labelledby={`skill-${skill.id}`}
      className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900"
    >
      {editing ? (
        <div className="mb-4 space-y-3">
          <div className="space-y-1">
            <label
              htmlFor={`skill-label-${skill.id}`}
              className="text-xs font-semibold text-stone-500 dark:text-stone-400"
            >
              Libellé
            </label>
            <input
              id={`skill-label-${skill.id}`}
              className={inputClass}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={`skill-goal-${skill.id}`}
              className="text-xs font-semibold text-stone-500 dark:text-stone-400"
            >
              Objectif (facultatif)
            </label>
            <input
              id={`skill-goal-${skill.id}`}
              className={inputClass}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setLabel(skill.label);
                setGoal(skill.goal);
                setEditing(false);
              }}
              className="rounded-xl px-3 py-2 text-sm text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void saveEdit()}
              disabled={busy || !label.trim()}
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden /> Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={`skill-${skill.id}`} className="text-lg font-bold text-stone-900 dark:text-white">
              {skill.label}
            </h3>
            {skill.goal && <p className="text-sm text-stone-500 dark:text-stone-400">Objectif : {skill.goal}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Renommer ou modifier ${skill.label}`}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-emerald-600 dark:hover:bg-stone-800"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              aria-label={`Supprimer ${skill.label}`}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-red-600 dark:hover:bg-stone-800"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor={`skill-level-${skill.id}`} className="text-xs font-semibold text-stone-500 dark:text-stone-400">
          Niveau déclaré
        </label>
        <div className="w-44">
          <LevelSelect
            id={`skill-level-${skill.id}`}
            value={skill.level}
            disabled={busy}
            onChange={(level) => void run(() => api.skills.update(skill.id, { level }))}
          />
        </div>
        <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${SKILL_LEVEL_STYLES[skill.level]}`}>
          {SKILL_LEVEL_LABELS[skill.level]}
        </span>
      </div>

      <h4 className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">Preuves ({evidence.length})</h4>
      {evidence.length === 0 ? (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
          Aucune note ne démontre encore cette compétence.
        </p>
      ) : (
        <ul className="mb-3 space-y-2">
          {evidence.map((log) => (
            <li
              key={log.id}
              className="flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-600 dark:bg-stone-800/50 dark:text-stone-300"
            >
              <span className="flex-1">{noteLabel(log)}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() => api.skills.update(skill.id, { logIds: skill.logIds.filter((id) => id !== log.id) }))
                }
                aria-label="Retirer cette preuve"
                className="shrink-0 rounded p-1 text-stone-400 hover:text-red-600"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && (
        <div className="mb-3 flex gap-2">
          <label htmlFor={`skill-evidence-${skill.id}`} className="sr-only">
            Ajouter une note comme preuve
          </label>
          <select
            id={`skill-evidence-${skill.id}`}
            className={inputClass}
            value={evidenceChoice}
            disabled={busy}
            onChange={(event) => setEvidenceChoice(event.target.value)}
          >
            <option value="" className="dark:bg-stone-900">
              Ajouter une note comme preuve…
            </option>
            {candidates.map((log) => (
              <option key={log.id} value={log.id} className="dark:bg-stone-900">
                {noteLabel(log)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!evidenceChoice || busy}
            onClick={() =>
              void run(() => api.skills.update(skill.id, { logIds: [...skill.logIds, evidenceChoice] })).then(() =>
                setEvidenceChoice(""),
              )
            }
            className="shrink-0 rounded-xl bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-emerald-700"
          >
            Ajouter
          </button>
        </div>
      )}
      {others.length > 0 && (
        <div className="flex gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
          <label htmlFor={`skill-merge-${skill.id}`} className="sr-only">
            Fusionner {skill.label} avec une autre compétence
          </label>
          <select
            id={`skill-merge-${skill.id}`}
            className={inputClass}
            value={mergeTarget}
            disabled={busy}
            onChange={(event) => setMergeTarget(event.target.value)}
          >
            <option value="" className="dark:bg-stone-900">
              Doublon ? Fusionner dans…
            </option>
            {others.map((item) => (
              <option key={item.id} value={item.id} className="dark:bg-stone-900">
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!mergeTarget || busy}
            onClick={() => void merge()}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-stone-200 px-4 text-sm font-medium text-stone-700 disabled:opacity-40 dark:border-stone-700 dark:text-stone-300"
          >
            <GitMerge className="h-4 w-4" aria-hidden /> Fusionner
          </button>
        </div>
      )}
    </article>
  );
}

export function SkillsTab({ logs, skills, onChanged }: Props) {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<SkillLevel>("to_work");
  const [saving, setSaving] = useState(false);
  const suggestions = useMemo(() => skillSuggestions(logs, skills), [logs, skills]);

  const create = async (payload: { label: string; goal?: string; level?: SkillLevel; logIds?: string[] }) => {
    setSaving(true);
    try {
      await api.skills.create(payload);
      await onChanged();
      toast(`Compétence « ${payload.label} » ajoutée.`, "success");
      return true;
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "La compétence n'a pas pu être ajoutée.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!label.trim()) return;
    if (await create({ label: label.trim(), goal: goal.trim(), level })) {
      setLabel("");
      setGoal("");
      setLevel("to_work");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl"
    >
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Compétences</h2>
        <p className="text-stone-500 dark:text-stone-400">
          Choisis les compétences que tu veux démontrer, déclare ton niveau et relie-les à des notes du journal qui
          servent de preuves.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="mb-8 grid gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:grid-cols-[2fr_2fr_1fr_auto] md:items-end dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="space-y-1">
          <label htmlFor="new-skill-label" className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            Compétence
          </label>
          <input
            id="new-skill-label"
            className={inputClass}
            placeholder="Ex : Développer une API REST"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-skill-goal" className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            Objectif (facultatif)
          </label>
          <input
            id="new-skill-goal"
            className={inputClass}
            placeholder="Ex : Être autonome d'ici la fin du stage"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-skill-level" className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            Niveau déclaré
          </label>
          <LevelSelect id="new-skill-level" value={level} onChange={setLevel} />
        </div>
        <button
          type="submit"
          disabled={saving || !label.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}{" "}
          Ajouter
        </button>
      </form>

      {suggestions.length > 0 && (
        <section
          aria-labelledby="skill-suggestions"
          className="mb-8 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/40 p-6 dark:border-emerald-800 dark:bg-emerald-900/10"
        >
          <h3 id="skill-suggestions" className="mb-1 font-bold text-stone-900 dark:text-white">
            Suggestions repérées dans tes notes
          </h3>
          <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
            Ce sont des propositions de l'IA. Ajoute seulement celles qui te correspondent : les notes concernées
            deviennent des preuves.
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 20).map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                disabled={saving}
                onClick={() => void create({ label: suggestion.label, logIds: suggestion.logIds })}
                className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-sm text-emerald-800 hover:border-emerald-400 disabled:opacity-50 dark:border-emerald-800 dark:bg-stone-900 dark:text-emerald-300"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> {suggestion.label}
                <span className="text-xs text-stone-400">({suggestion.logIds.length})</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {skills.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center dark:border-stone-700 dark:bg-stone-900">
          <Award className="mx-auto mb-3 h-8 w-8 text-stone-300" aria-hidden />
          <p className="text-stone-500 dark:text-stone-400">
            Aucune compétence enregistrée. Ajoute ta première compétence ci-dessus.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {skills.map((skill) => (
            <SkillCard
              key={`${skill.id}-${skill.updatedAt}`}
              skill={skill}
              skills={skills}
              logs={logs}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
