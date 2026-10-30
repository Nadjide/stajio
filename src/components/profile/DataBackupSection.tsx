import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { api } from "../../services/api";
import type { BackupPreview } from "../../types/backup";
import { useToast } from "../ui/Toast";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function DataBackupSection({ onRestored }: { onRestored: () => Promise<void> }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: unknown; name: string; preview: BackupPreview } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const busy = previewing || restoring;

  const chooseBackup = async (file: File) => {
    setPending(null);
    setConfirmed(false);
    setError("");
    setPreviewing(true);
    try {
      if (file.size > MAX_FILE_SIZE) throw new Error("La sauvegarde dépasse la limite de 20 Mio.");
      let backup: unknown;
      try {
        backup = JSON.parse(await file.text());
      } catch {
        throw new Error("Ce fichier ne contient pas un document JSON valide.");
      }
      const { preview } = await api.data.preview(backup);
      setPending({ backup, name: file.name, preview });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de lire cette sauvegarde.");
    } finally {
      setPreviewing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const refreshPreview = async () => {
    if (!pending) return;
    setPreviewing(true);
    setConfirmed(false);
    setError("");
    try {
      const { preview } = await api.data.preview(pending.backup);
      setPending({ ...pending, preview });
    } catch (cause) {
      setPending(null);
      setError(cause instanceof Error ? cause.message : "Impossible d'actualiser l'aperçu.");
    } finally {
      setPreviewing(false);
    }
  };

  const restore = async () => {
    if (!pending || !confirmed) return;
    setRestoring(true);
    setError("");
    try {
      await api.data.import(pending.backup, pending.preview);
      setPending(null);
      setConfirmed(false);
      toast("Sauvegarde restaurée. Les données du compte ont été remplacées.", "success");
      try {
        await onRestored();
      } catch {
        setError("La sauvegarde est restaurée. Recharge la page pour actualiser les données affichées.");
      }
    } catch (cause) {
      setConfirmed(false);
      setError(cause instanceof Error ? cause.message : "La restauration a échoué. Les données sont conservées.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <section aria-labelledby="backup-title" className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
          <Download className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 id="backup-title" className="font-bold text-stone-900 dark:text-white">
            Mes données
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Sauvegarde le profil, le journal, les compétences, les échéances, les rapports et leurs versions, les
            conversations, les simulations, les résultats IA et les brouillons de ce compte.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <a
          href={api.data.exportUrl}
          download
          className="flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          <Download className="h-4 w-4" /> Exporter tout (JSON)
        </a>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {previewing ? "Lecture de la sauvegarde…" : "Choisir une sauvegarde"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Choisir une sauvegarde JSON"
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void chooseBackup(file);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      {pending && (
        <div
          className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-800 dark:bg-amber-900/10"
          aria-labelledby="restore-title"
        >
          <div>
            <h4 id="restore-title" className="font-bold text-stone-900 dark:text-white">
              Restaurer une sauvegarde
            </h4>
            <p className="mt-1 text-sm break-all text-stone-600 dark:text-stone-300">
              {pending.name} · format {pending.preview.version}
            </p>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Exportée le {new Date(pending.preview.exportedAt).toLocaleString("fr-FR")}
            </p>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500 dark:text-stone-400">Nom restauré</dt>
              <dd className="font-medium text-stone-900 dark:text-white">
                {pending.preview.profile.displayName || "Non renseigné"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500 dark:text-stone-400">École</dt>
              <dd className="font-medium text-stone-900 dark:text-white">
                {pending.preview.profile.school || "Non renseignée"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500 dark:text-stone-400">Entreprise</dt>
              <dd className="font-medium text-stone-900 dark:text-white">
                {pending.preview.profile.company || "Non renseignée"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500 dark:text-stone-400">Période</dt>
              <dd className="font-medium text-stone-900 dark:text-white">
                {pending.preview.profile.internshipStart || "—"} → {pending.preview.profile.internshipEnd || "—"}
              </dd>
            </div>
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-700 dark:text-stone-300">
              <caption className="sr-only">Données actuelles et données de la sauvegarde</caption>
              <thead>
                <tr>
                  <th scope="col" className="py-2">
                    Contenu
                  </th>
                  <th scope="col" className="px-1 py-2 sm:px-2">
                    <span className="sm:hidden">Actuel</span>
                    <span className="hidden sm:inline">Actuellement</span>
                  </th>
                  <th scope="col" className="px-1 py-2 sm:px-2">
                    <span className="sm:hidden">Après</span>
                    <span className="hidden sm:inline">Après restauration</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["logs", "Notes du journal"],
                    ["deadlines", "Échéances"],
                    ["skills", "Compétences"],
                    ["skillEvidence", "Liens de preuve"],
                    ["reports", "Rapports"],
                    ["reportVersions", "Versions de rapport"],
                    ["conversations", "Conversations"],
                    ["conversationMessages", "Messages"],
                    ["simulations", "Simulations"],
                    ["aiOutputs", "Résultats IA"],
                    ["drafts", "Brouillons"],
                  ] as const
                ).map(([key, label]) => (
                  <tr key={key} className="border-t border-amber-200 dark:border-amber-800">
                    <th scope="row" className="py-2 pr-1 font-normal [overflow-wrap:anywhere]">
                      {label}
                    </th>
                    <td className="px-1 py-2 sm:px-2">{pending.preview.current[key]}</td>
                    <td className="px-1 py-2 sm:px-2">{pending.preview.incoming[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-stone-700 dark:text-stone-300">
            Cette opération remplace le profil et les contenus de ce compte. L'adresse de connexion et le mot de passe
            sont conservés.
          </p>
          <a
            href={api.data.exportUrl}
            download
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
          >
            <Download className="h-4 w-4" /> Sauvegarder les données actuelles avant remplacement
          </a>
          <label className="flex items-start gap-3 text-sm text-stone-800 dark:text-stone-200">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 accent-emerald-600"
            />
            Je confirme le remplacement des données de ce compte.
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setConfirmed(false);
                setError("");
              }}
              disabled={busy}
              className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void refreshPreview()}
              disabled={busy}
              className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300"
            >
              Actualiser l'aperçu
            </button>
            <button
              type="button"
              onClick={() => void restore()}
              disabled={!confirmed || busy}
              className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {restoring && <Loader2 className="h-4 w-4 animate-spin" />}
              {restoring ? "Restauration…" : "Restaurer les données"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
