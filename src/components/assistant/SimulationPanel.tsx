import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { api } from "../../services/api";
import { getPreferredModel } from "../../services/ai";
import { useToast } from "../ui/Toast";
import type { Simulation } from "../../types/models";
import { averageScore, DEFENSE_CRITERIA } from "../../utils/defense";

function Criteria() {
  return (
    <details className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-sm dark:border-blue-900 dark:bg-blue-900/10">
      <summary className="flex cursor-pointer items-center gap-2 font-medium text-blue-800 dark:text-blue-300">
        <Info className="h-4 w-4" aria-hidden /> Critères d'évaluation et limites de la note
      </summary>
      <ul className="mt-3 space-y-1 text-stone-600 dark:text-stone-300">
        {DEFENSE_CRITERIA.map((criterion) => (
          <li key={criterion.label}>
            <strong>{criterion.label}</strong> : {criterion.description}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
        La note sur 10 est une aide à l'entraînement donnée par un modèle local. Elle ne prédit pas la note du jury.
      </p>
    </details>
  );
}

function Summary({ simulation }: { simulation: Simulation }) {
  const scores = simulation.steps.flatMap((step) => (step.evaluation ? [step.evaluation.score] : []));
  const average = averageScore(scores);
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="mb-2 text-sm font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
          Bilan de la session
        </p>
        <p className="text-5xl font-bold text-stone-900 dark:text-white">{average === null ? "—" : `${average}/10`}</p>
        <p className="text-stone-500 dark:text-stone-400">
          Note indicative moyenne sur {scores.length} réponse{scores.length > 1 ? "s" : ""} évaluée
          {scores.length > 1 ? "s" : ""}
        </p>
      </div>
      <ol className="space-y-3">
        {simulation.steps.map((step, index) => (
          <li key={index}>
            <details className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-800/50">
              <summary className="flex cursor-pointer items-center gap-4">
                <span className="w-14 shrink-0 text-center text-lg font-bold text-blue-600 dark:text-blue-400">
                  {step.evaluation ? `${step.evaluation.score}/10` : "—"}
                </span>
                <span className="text-sm text-stone-700 dark:text-stone-300">{step.question}</span>
              </summary>
              <div className="mt-3 space-y-2 pl-18 text-sm text-stone-600 dark:text-stone-300">
                <p>
                  <strong>Ta réponse : </strong>
                  {step.answer || "non répondue"}
                </p>
                {step.evaluation && (
                  <>
                    <p>
                      <strong>Retour : </strong>
                      {step.evaluation.feedback}
                    </p>
                    {step.evaluation.improvedAnswer && (
                      <p className="italic">
                        <strong className="not-italic">Formulation suggérée : </strong>
                        {step.evaluation.improvedAnswer}
                      </p>
                    )}
                  </>
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SessionView({ simulation, onChange }: { simulation: Simulation; onChange: (simulation: Simulation) => void }) {
  const { toast } = useToast();
  const step = simulation.steps[simulation.currentStep];
  const [answer, setAnswer] = useState(step?.answer ?? "");
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const move = async (index: number) => {
    try {
      const finished = index >= simulation.steps.length;
      onChange(
        await api.simulations.update(simulation.id, {
          currentStep: index,
          ...(finished ? { status: "finished" } : {}),
        }),
      );
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "La progression n'a pas pu être enregistrée.", "error");
    }
  };

  const submit = async () => {
    if (!answer.trim()) return;
    const current = new AbortController();
    controller.current = current;
    setEvaluating(true);
    setError("");
    try {
      onChange(
        await api.simulations.answer(
          simulation.id,
          simulation.currentStep,
          answer.trim(),
          getPreferredModel(),
          current.signal,
        ),
      );
    } catch (cause) {
      // The server stored the answer before evaluating it.
      setError(
        current.signal.aborted
          ? "Évaluation annulée. Ta réponse est enregistrée."
          : `${cause instanceof Error ? cause.message : "L'évaluation a échoué."} Ta réponse est enregistrée.`,
      );
    } finally {
      setEvaluating(false);
    }
  };

  if (!step) return <Summary simulation={simulation} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">
          Question {simulation.currentStep + 1} / {simulation.steps.length}
        </span>
        <div className="flex gap-1.5" aria-hidden>
          {simulation.steps.map((item, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${item.evaluation ? "bg-blue-500" : i === simulation.currentStep ? "bg-blue-300" : "bg-stone-200 dark:bg-stone-700"}`}
            />
          ))}
        </div>
      </div>
      <h3 className="text-xl font-bold text-stone-900 dark:text-white">{step.question}</h3>

      {!step.evaluation ? (
        <>
          <label htmlFor="simulation-answer" className="sr-only">
            Ta réponse
          </label>
          <textarea
            id="simulation-answer"
            className="h-36 w-full resize-y rounded-xl border border-stone-200 bg-transparent p-4 outline-none focus:ring-2 focus:ring-blue-500 dark:border-stone-700 dark:text-white"
            placeholder="Réponds comme si tu étais devant le jury…"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={evaluating}
          />
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            {evaluating && (
              <button
                type="button"
                onClick={() => controller.current?.abort()}
                className="flex items-center gap-1 rounded-xl border border-stone-200 px-4 py-3 text-sm dark:border-stone-700 dark:text-stone-300"
              >
                <Square className="h-4 w-4" aria-hidden /> Annuler
              </button>
            )}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={evaluating || !answer.trim()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-medium text-white disabled:opacity-50"
            >
              {evaluating ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : error ? (
                <RefreshCw className="h-5 w-5" aria-hidden />
              ) : (
                <Send className="h-5 w-5" aria-hidden />
              )}
              {evaluating ? "Le jury délibère…" : error ? "Relancer l'évaluation" : "Valider ma réponse"}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-stone-50 p-5 dark:bg-stone-800/50">
            <p className="mb-2 text-xs font-bold text-stone-400 uppercase">Ta réponse</p>
            <p className="text-sm whitespace-pre-wrap text-stone-600 dark:text-stone-300">{step.answer}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold text-blue-600 uppercase dark:text-blue-400">Retour d'entraînement</p>
              <span className="text-lg font-bold text-blue-700 dark:text-blue-300" title="Note indicative">
                {step.evaluation.score}/10
              </span>
            </div>
            <p className="mb-4 text-sm text-stone-700 dark:text-stone-300">{step.evaluation.feedback}</p>
            {step.evaluation.improvedAnswer && (
              <>
                <p className="mb-2 text-xs font-bold text-stone-400 uppercase">Formulation suggérée</p>
                <p className="text-sm text-stone-600 italic dark:text-stone-400">{step.evaluation.improvedAnswer}</p>
              </>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          disabled={simulation.currentStep === 0 || evaluating}
          onClick={() => void move(simulation.currentStep - 1)}
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Précédente
        </button>
        <button
          type="button"
          disabled={evaluating}
          onClick={() => void move(simulation.currentStep + 1)}
          className="flex items-center gap-2 rounded-xl bg-stone-900 px-6 py-3 font-medium text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          {simulation.currentStep + 1 < simulation.steps.length
            ? step.evaluation
              ? "Question suivante"
              : "Passer cette question"
            : "Voir le bilan"}
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function SimulationPanel({ hasLogs }: { hasLogs: boolean }) {
  const { toast } = useToast();
  const [simulations, setSimulations] = useState<Simulation[] | null>(null);
  const [active, setActive] = useState<Simulation | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.simulations.list();
      setSimulations(list);
      return list;
    } catch {
      setSimulations([]);
      return [];
    }
  }, []);

  useEffect(() => {
    void load().then((list) => {
      const inProgress = list.find((simulation) => simulation.status === "in_progress");
      if (inProgress) setActive(inProgress);
    });
    return () => controller.current?.abort();
  }, [load]);

  const create = async () => {
    if (!hasLogs) {
      toast("Ajoute d'abord des notes de journal : le jury se base dessus.", "info");
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setCreating(true);
    setError("");
    try {
      const simulation = await api.simulations.create(getPreferredModel(), current.signal);
      setActive(simulation);
      void load();
    } catch (cause) {
      if (!current.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Impossible de lancer la simulation.");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (simulation: Simulation) => {
    if (!window.confirm(`Supprimer « ${simulation.title} » ?`)) return;
    try {
      await api.simulations.delete(simulation.id);
      if (active?.id === simulation.id) setActive(null);
      await load();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "La suppression a échoué.", "error");
    }
  };

  const update = (simulation: Simulation) => {
    setActive(simulation);
    setSimulations((list) => list?.map((item) => (item.id === simulation.id ? simulation : item)) ?? list);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
      <aside aria-label="Simulations" className="space-y-2">
        <button
          type="button"
          onClick={() => void create()}
          disabled={creating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}{" "}
          Nouvelle simulation
        </button>
        {creating && (
          <button
            type="button"
            onClick={() => controller.current?.abort()}
            className="w-full rounded-xl px-4 py-2 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Annuler la préparation
          </button>
        )}
        <ul className="max-h-72 space-y-1 overflow-y-auto lg:max-h-[60vh]">
          {simulations?.map((simulation) => {
            const average = averageScore(
              simulation.steps.flatMap((step) => (step.evaluation ? [step.evaluation.score] : [])),
            );
            return (
              <li
                key={simulation.id}
                className={`flex items-center gap-1 rounded-xl p-1 ${active?.id === simulation.id ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-stone-100 dark:hover:bg-stone-800"}`}
              >
                <button
                  type="button"
                  onClick={() => setActive(simulation)}
                  aria-current={active?.id === simulation.id ? "true" : undefined}
                  className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
                >
                  <span className="block truncate text-sm text-stone-700 dark:text-stone-300">{simulation.title}</span>
                  <span className="text-xs text-stone-400">
                    {simulation.status === "finished"
                      ? `Terminée${average !== null ? ` · ${average}/10` : ""}`
                      : `En cours · question ${Math.min(simulation.currentStep + 1, simulation.steps.length)}/${simulation.steps.length}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(simulation)}
                  aria-label={`Supprimer ${simulation.title}`}
                  className="rounded p-1 text-stone-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="space-y-4">
        <Criteria />
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
          >
            {error}
          </p>
        )}
        {active ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm md:p-10 dark:border-stone-800 dark:bg-stone-900">
            <SessionView key={`${active.id}-${active.currentStep}`} simulation={active} onChange={update} />
          </div>
        ) : (
          <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
              <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" aria-hidden />
            </div>
            <h3 className="mb-2 text-xl font-bold text-stone-900 dark:text-white">Entraîne-toi comme devant le jury</h3>
            <p className="mx-auto max-w-md text-stone-500 dark:text-stone-400">
              L'IA prépare des questions à partir de ton journal. Chaque réponse est enregistrée : tu peux arrêter et
              reprendre la session plus tard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
