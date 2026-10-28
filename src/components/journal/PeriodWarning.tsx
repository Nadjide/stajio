import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import type { UserProfile } from "../../types/models";
import { getPeriodPosition, isCalendarDate } from "../../utils/internship";

const formatDay = (date: string) =>
  isCalendarDate(date) ? format(parseISO(date), "dd MMMM yyyy", { locale: fr }) : date;

/** Returns whether the date needs an explicit confirmation before saving. */
export function needsPeriodConfirmation(date: string, profile: UserProfile) {
  const position = getPeriodPosition(date, profile.internshipStart, profile.internshipEnd);
  return position === "before" || position === "after";
}

export function PeriodWarning({
  id,
  date,
  profile,
  confirmed,
  onConfirm,
}: {
  id: string;
  date: string;
  profile: UserProfile;
  confirmed: boolean;
  onConfirm: (confirmed: boolean) => void;
}) {
  const position = getPeriodPosition(date, profile.internshipStart, profile.internshipEnd);
  if (position !== "before" && position !== "after") return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Cette date est {position === "before" ? "antérieure au début" : "postérieure à la fin"} de ton stage (du{" "}
        {formatDay(profile.internshipStart)} au {formatDay(profile.internshipEnd)}). La note sera classée «{" "}
        {position === "before" ? "Avant le stage" : "Après le stage"} ».
      </p>
      <label htmlFor={id} className="mt-2 flex items-center gap-2 font-medium">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 accent-amber-600"
          checked={confirmed}
          onChange={(event) => onConfirm(event.target.checked)}
        />
        Je confirme cette date
      </label>
    </div>
  );
}
