import { inputClass, type StructuredFields } from "./noteFields";

/** Editable structured fields, used both for manual corrections and to review an AI proposal. */
export function StructuredFieldsForm({
  idPrefix,
  fields,
  onChange,
  disabled,
}: {
  idPrefix: string;
  fields: StructuredFields;
  onChange: (fields: StructuredFields) => void;
  disabled?: boolean;
}) {
  const set = (key: keyof StructuredFields, value: string) => onChange({ ...fields, [key]: value });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2">
        <label htmlFor={`${idPrefix}-summary`} className="text-xs font-semibold text-stone-500 dark:text-stone-400">
          Résumé
        </label>
        <textarea
          id={`${idPrefix}-summary`}
          className={`${inputClass} h-20 resize-y`}
          value={fields.summary}
          disabled={disabled}
          onChange={(event) => set("summary", event.target.value)}
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label htmlFor={`${idPrefix}-missions`} className="text-xs font-semibold text-stone-500 dark:text-stone-400">
          Missions (une par ligne)
        </label>
        <textarea
          id={`${idPrefix}-missions`}
          className={`${inputClass} h-20 resize-y`}
          value={fields.missions}
          disabled={disabled}
          onChange={(event) => set("missions", event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-technologies`}
          className="text-xs font-semibold text-stone-500 dark:text-stone-400"
        >
          Technologies (séparées par des virgules)
        </label>
        <input
          id={`${idPrefix}-technologies`}
          className={inputClass}
          value={fields.technologies}
          disabled={disabled}
          onChange={(event) => set("technologies", event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-skills`} className="text-xs font-semibold text-stone-500 dark:text-stone-400">
          Compétences repérées (séparées par des virgules)
        </label>
        <input
          id={`${idPrefix}-skills`}
          className={inputClass}
          value={fields.skills}
          disabled={disabled}
          onChange={(event) => set("skills", event.target.value)}
        />
      </div>
    </div>
  );
}
