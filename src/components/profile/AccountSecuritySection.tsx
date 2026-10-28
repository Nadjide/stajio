import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { api } from "../../services/api";
import { useToast } from "../ui/Toast";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-transparent p-3 text-stone-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-700 dark:text-white";

export function AccountSecuritySection({
  onDataCleared,
  onAccountDeleted,
}: {
  onDataCleared: () => Promise<void>;
  onAccountDeleted: () => void;
}) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatedPassword, setRepeatedPassword] = useState("");
  const [action, setAction] = useState<"data" | "account" | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword !== repeatedPassword) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (new TextEncoder().encode(newPassword).byteLength > 72) {
      setError("Le nouveau mot de passe dépasse 72 octets. Utilise un mot de passe plus court.");
      return;
    }
    setBusy(true);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setRepeatedPassword("");
      setAction(null);
      setDeletePassword("");
      setConfirmation("");
      toast("Mot de passe modifié. Les autres sessions ont été déconnectées.", "success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de modifier le mot de passe.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (event: FormEvent) => {
    event.preventDefault();
    if (!action || confirmation !== "SUPPRIMER") return;
    setBusy(true);
    setError("");
    try {
      await api.account.remove({ currentPassword: deletePassword, confirmation: "SUPPRIMER", scope: action });
      const removedAccount = action === "account";
      setAction(null);
      setConfirmation("");
      setDeletePassword("");
      if (removedAccount) {
        onAccountDeleted();
        toast("Compte supprimé.", "success");
      } else {
        toast("Données effacées. Tu peux configurer une nouvelle période de stage.", "success");
        try {
          await onDataCleared();
        } catch {
          setError("Les données sont effacées. Recharge la page pour actualiser ton profil.");
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La suppression a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="account-security-title"
      className="mt-6 space-y-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8 dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <h3 id="account-security-title" className="font-bold text-stone-900 dark:text-white">
          Sécurité du compte
        </h3>
      </div>
      {error && !action && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      <form onSubmit={changePassword} className="space-y-4" aria-label="Modifier le mot de passe">
        <div className="space-y-2">
          <label htmlFor="current-password" className="text-sm font-medium text-stone-600 dark:text-stone-300">
            Mot de passe actuel
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            disabled={busy}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm font-medium text-stone-600 dark:text-stone-300">
            Nouveau mot de passe
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={busy}
            className={inputClass}
          />
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Au moins 8 caractères, au maximum 72 octets. Les autres sessions seront déconnectées.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="repeat-password" className="text-sm font-medium text-stone-600 dark:text-stone-300">
            Confirmer le nouveau mot de passe
          </label>
          <input
            id="repeat-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={repeatedPassword}
            onChange={(event) => setRepeatedPassword(event.target.value)}
            disabled={busy}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={busy || !currentPassword || !newPassword || !repeatedPassword}
          className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy && !action && <Loader2 className="h-4 w-4 animate-spin" />} Modifier le mot de passe
        </button>
      </form>
      <div className="space-y-4 border-t border-stone-200 pt-6 dark:border-stone-800">
        <h4 className="flex items-center gap-2 font-semibold text-stone-900 dark:text-white">
          <Trash2 className="h-4 w-4" /> Gestion des données et du compte
        </h4>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setAction("data");
              setConfirmation("");
              setDeletePassword("");
              setError("");
            }}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
          >
            Effacer mes données
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setAction("account");
              setConfirmation("");
              setDeletePassword("");
              setError("");
            }}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
          >
            Supprimer mon compte
          </button>
        </div>
        {action && (
          <form
            onSubmit={remove}
            className="space-y-4 rounded-2xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-900/10"
            aria-label="Confirmer la suppression"
          >
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
              >
                {error}
              </p>
            )}
            <h5 className="font-bold text-red-800 dark:text-red-300">
              {action === "account" ? "Supprimer le compte et ses données" : "Effacer les données du stage"}
            </h5>
            <p className="text-sm text-stone-700 dark:text-stone-300">
              {action === "account"
                ? "Le profil, les notes, les échéances, l'historique IA et l'accès à ce compte seront supprimés."
                : "Le profil de stage, les notes, les échéances et l'historique IA seront effacés. Le compte et son mot de passe seront conservés."}
            </p>
            <a
              href={api.data.exportUrl}
              download
              className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
            >
              Sauvegarder mes données avant suppression
            </a>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Les sauvegardes créées avant cette opération restent sur le poste.
            </p>
            <div className="space-y-2">
              <label htmlFor="delete-password" className="text-sm font-medium text-stone-600 dark:text-stone-300">
                Mot de passe pour confirmer
              </label>
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                required
                disabled={busy}
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="delete-confirmation" className="text-sm font-medium text-stone-600 dark:text-stone-300">
                Saisis SUPPRIMER pour confirmer
              </label>
              <input
                id="delete-confirmation"
                type="text"
                autoComplete="off"
                spellCheck={false}
                required
                disabled={busy}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setAction(null);
                  setConfirmation("");
                  setDeletePassword("");
                  setError("");
                }}
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50 dark:border-stone-600 dark:text-stone-300"
              >
                Annuler la suppression
              </button>
              <button
                type="submit"
                disabled={busy || !deletePassword || confirmation !== "SUPPRIMER"}
                className="flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {action === "account" ? "Confirmer la suppression du compte" : "Confirmer l'effacement des données"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
