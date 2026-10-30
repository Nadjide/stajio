import React, { useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { api } from "../../services/api";
import { DRAFT_STATUS_LABELS, useDraft } from "../../hooks/useDraft";
import type { User } from "../../types/models";
import { addCalendarDays, getInternshipMidpoint, isCalendarDate } from "../../utils/internship";

type ProfileFields = {
  displayName: string;
  school: string;
  degree: string;
  company: string;
  tutorName: string;
  internshipStart: string;
  internshipEnd: string;
};

type ProposedDeadline = {
  key: string;
  title: string;
  date: string;
  type: "school" | "company";
  included: boolean;
  hint: string;
};

type SetupDraft = { step: 1 | 2; profile: ProfileFields; deadlines: ProposedDeadline[] | null; proposedFor?: string };

const isSetupEmpty = (draft: SetupDraft) =>
  draft.step === 1 &&
  !draft.deadlines &&
  Object.entries(draft.profile).every(([field, value]) => field === "displayName" || !value.trim());

/** Suggestions only: each one is optional and its date must be confirmed by the student. */
function proposeDeadlines(start: string, end: string): ProposedDeadline[] {
  return [
    {
      key: "midpoint",
      title: "Point mi-parcours avec le tuteur",
      date: getInternshipMidpoint(start, end),
      type: "company",
      included: true,
      hint: "Date calculée au milieu de la période.",
    },
    {
      key: "report",
      title: "Remise du rapport de stage",
      date: addCalendarDays(end, -14),
      type: "school",
      included: true,
      hint: "Proposition : deux semaines avant la fin. Vérifie la date imposée par ton école.",
    },
    {
      key: "defense",
      title: "Soutenance",
      date: "",
      type: "school",
      included: false,
      hint: "Renseigne la date communiquée par ton école, si elle est connue.",
    },
  ];
}

const FIELDS: Array<{
  key: keyof ProfileFields;
  label: string;
  placeholder?: string;
  type?: string;
  required: boolean;
}> = [
  { key: "displayName", label: "Nom affiché", placeholder: "Ex : Camille Martin", required: true },
  { key: "school", label: "École", placeholder: "Ex : Ynov, Epitech...", required: true },
  { key: "degree", label: "Diplôme", placeholder: "Ex : Master Expert Informatique", required: true },
  { key: "company", label: "Entreprise", placeholder: "Ex : Startup, PME...", required: true },
  { key: "tutorName", label: "Tuteur entreprise (facultatif)", placeholder: "Nom du tuteur", required: false },
  { key: "internshipStart", label: "Début du stage ou de l'alternance", type: "date", required: true },
  { key: "internshipEnd", label: "Fin du stage ou de l'alternance", type: "date", required: true },
];

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-transparent p-3 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-800 dark:text-white";

export function ProfileSetupPage({ user, onComplete }: { user: User; onComplete: () => Promise<void> }) {
  const draft = useDraft<SetupDraft>(
    "onboarding",
    {
      step: 1,
      profile: {
        displayName: user.displayName || "",
        school: "",
        degree: "",
        company: "",
        tutorName: "",
        internshipStart: "",
        internshipEnd: "",
      },
      deadlines: null,
    },
    isSetupEmpty,
  );
  const { step, profile, deadlines } = draft.value;
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateProfile = (field: keyof ProfileFields, value: string) =>
    draft.setValue((previous) => ({ ...previous, profile: { ...previous.profile, [field]: value } }));

  const updateDeadline = (key: string, changes: Partial<ProposedDeadline>) =>
    draft.setValue((previous) => ({
      ...previous,
      deadlines: (previous.deadlines ?? []).map((item) => (item.key === key ? { ...item, ...changes } : item)),
    }));

  const validateProfile = (): string[] => {
    const problems: string[] = [];
    for (const field of FIELDS) {
      if (field.required && !profile[field.key].trim()) problems.push(`${field.label} : champ obligatoire.`);
    }
    if (profile.internshipStart && !isCalendarDate(profile.internshipStart))
      problems.push("La date de début est invalide.");
    if (profile.internshipEnd && !isCalendarDate(profile.internshipEnd)) problems.push("La date de fin est invalide.");
    if (
      isCalendarDate(profile.internshipStart) &&
      isCalendarDate(profile.internshipEnd) &&
      profile.internshipEnd < profile.internshipStart
    ) {
      problems.push("La fin doit être postérieure ou égale au début.");
    }
    return problems;
  };

  const goToDeadlines = (event: React.FormEvent) => {
    event.preventDefault();
    const problems = validateProfile();
    setErrors(problems);
    if (problems.length) return;
    draft.setValue((previous) => {
      const period = `${previous.profile.internshipStart}|${previous.profile.internshipEnd}`;
      // Keep the student's adjustments unless the dates they were based on changed.
      const keep = previous.deadlines?.length && previous.proposedFor === period;
      return {
        ...previous,
        step: 2,
        proposedFor: period,
        deadlines: keep
          ? previous.deadlines
          : proposeDeadlines(previous.profile.internshipStart, previous.profile.internshipEnd),
      };
    });
  };

  const finish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const chosen = (deadlines ?? []).filter((item) => item.included);
    const problems = chosen
      .filter((item) => !item.title.trim() || !isCalendarDate(item.date))
      .map((item) => `« ${item.title || "Échéance sans titre"} » : renseigne une date valide ou décoche-la.`);
    setErrors(problems);
    if (problems.length) return;
    setSubmitting(true);
    try {
      await draft.flush();
      await api.onboarding.complete({
        profile: { ...profile, tutorName: profile.tutorName.trim() },
        deadlines: chosen.map(({ title, date, type }) => ({ title: title.trim(), date, type })),
      });
      await onComplete();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "La configuration n'a pas pu être enregistrée."]);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-12 dark:bg-stone-950">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
              Étape {step} sur 2
            </p>
            <h2 className="text-2xl font-bold text-stone-900 dark:text-white">Configure ton profil</h2>
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500" aria-live="polite">
            {DRAFT_STATUS_LABELS[draft.status]}
          </p>
        </div>
        {draft.restored && (
          <p className="mb-6 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            Ta configuration interrompue a été reprise là où tu l'avais laissée.
          </p>
        )}
        {errors.length > 0 && (
          <div
            role="alert"
            className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
          >
            <p className="mb-1 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" aria-hidden /> À corriger avant de continuer
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={goToDeadlines} noValidate className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <label
                  htmlFor={`setup-${field.key}`}
                  className="text-sm font-medium text-stone-700 dark:text-stone-300"
                >
                  {field.label}
                </label>
                <input
                  id={`setup-${field.key}`}
                  type={field.type || "text"}
                  required={field.required}
                  className={inputClass}
                  value={profile[field.key]}
                  onChange={(event) => updateProfile(field.key, event.target.value)}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
            <div className="pt-4 md:col-span-2">
              <button
                type="submit"
                disabled={draft.status === "loading"}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Continuer vers les échéances <ArrowRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={finish} noValidate className="space-y-6">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Voici des échéances proposées à partir de tes dates. Elles sont facultatives : vérifie chaque date,
              modifie-la ou décoche l'échéance. Tu pourras en ajouter d'autres plus tard.
            </p>
            <ul className="space-y-4">
              {(deadlines ?? []).map((item) => (
                <li key={item.key} className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
                  <label className="mb-3 flex items-center gap-3 text-sm font-medium text-stone-800 dark:text-stone-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={item.included}
                      onChange={(event) => updateDeadline(item.key, { included: event.target.checked })}
                    />
                    Ajouter « {item.title} »
                  </label>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <label htmlFor={`deadline-title-${item.key}`} className="sr-only">
                        Titre de l'échéance
                      </label>
                      <input
                        id={`deadline-title-${item.key}`}
                        className={inputClass}
                        value={item.title}
                        disabled={!item.included}
                        onChange={(event) => updateDeadline(item.key, { title: event.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor={`deadline-date-${item.key}`} className="sr-only">
                        Date de « {item.title} »
                      </label>
                      <input
                        id={`deadline-date-${item.key}`}
                        type="date"
                        className={inputClass}
                        value={item.date}
                        disabled={!item.included}
                        onChange={(event) => updateDeadline(item.key, { date: event.target.value })}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{item.hint}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => draft.setValue((previous) => ({ ...previous, step: 1 }))}
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 px-6 py-4 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden /> Modifier le profil
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                {submitting && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
                {submitting ? "Enregistrement…" : "Terminer la configuration"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
