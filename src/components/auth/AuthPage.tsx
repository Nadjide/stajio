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
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-stone-900 p-8 md:p-12 rounded-3xl shadow-sm border border-stone-200 dark:border-stone-800 max-w-md w-full"
      >
        <div className="flex justify-center mb-6">
          <Logo className="w-16 h-16" />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-900 dark:text-white mb-2 tracking-tight">Stajio</h1>
          <p className="text-stone-500 dark:text-stone-400">
            {isLogin ? "Ravi de vous revoir !" : "Commencez votre aventure."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-500 uppercase ml-1">Nom complet</label>
              <input
                required
                type="text"
                className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-500 uppercase ml-1">Email</label>
            <input
              required
              type="email"
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean@exemple.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-stone-500 uppercase ml-1">Mot de passe</label>
            <input
              required
              type="password"
              className="w-full p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-transparent dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-sm text-center font-medium">
              {error}
            </motion.p>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-stone-900 dark:bg-emerald-600 text-white py-4 rounded-2xl font-medium hover:bg-stone-800 dark:hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? "Se connecter" : "Créer un compte"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-stone-500 dark:text-stone-400 text-sm hover:text-stone-900 dark:hover:text-white transition-colors"
          >
            {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
