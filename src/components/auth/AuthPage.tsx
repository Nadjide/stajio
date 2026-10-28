import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { Logo } from "../Logo";
import { api } from "../../services/api";
import type { User } from "../../types/models";

export function AuthPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        const res = await api.auth.login({ email, password });
        if (res.user) {
          onLogin(res.user);
        } else {
          setError(res.error || "Identifiants invalides");
        }
      } else {
        const res = await api.auth.register({ email, password, displayName });
        if (res.success) {
          const loginRes = await api.auth.login({ email, password });
          if (loginRes.user) onLogin(loginRes.user);
        } else {
          setError(res.error || "Erreur lors de l'inscription");
        }
      }
    } catch {
      setError("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4 dark:bg-stone-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-sm md:p-12 dark:border-stone-800 dark:bg-stone-900"
      >
        <div className="mb-6 flex justify-center">
          <Logo className="h-16 w-16" />
        </div>
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-stone-900 dark:text-white">Stajio</h1>
          <p className="text-stone-500 dark:text-stone-400">
            {isLogin ? "Ravi de vous revoir !" : "Commencez votre aventure."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label htmlFor="auth-name" className="ml-1 text-xs font-semibold text-stone-500 uppercase">
                Nom complet
              </label>
              <input
                id="auth-name"
                autoComplete="name"
                required
                type="text"
                className="w-full rounded-xl border border-stone-200 bg-transparent p-3 transition-all outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-800 dark:text-white"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="auth-email" className="ml-1 text-xs font-semibold text-stone-500 uppercase">
              Email
            </label>
            <input
              id="auth-email"
              autoComplete="email"
              required
              type="email"
              className="w-full rounded-xl border border-stone-200 bg-transparent p-3 transition-all outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-800 dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean@exemple.com"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="auth-password" className="ml-1 text-xs font-semibold text-stone-500 uppercase">
              Mot de passe
            </label>
            <input
              id="auth-password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              type="password"
              className="w-full rounded-xl border border-stone-200 bg-transparent p-3 transition-all outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-800 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm font-medium text-red-500"
            >
              {error}
            </motion.p>
          )}

          <button
            disabled={loading}
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-stone-900 py-4 font-medium text-white transition-all hover:bg-stone-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Chargement" />
            ) : isLogin ? (
              "Se connecter"
            ) : (
              "Créer un compte"
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-stone-500 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
          >
            {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
