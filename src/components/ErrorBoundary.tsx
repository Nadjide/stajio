import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || "Une erreur est survenue.";

      return (
        <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4 dark:bg-stone-950">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <h2 className="mb-4 text-2xl font-semibold text-stone-900 dark:text-white">Oups !</h2>
            <p className="mb-6 text-stone-600 dark:text-stone-400">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-emerald-700 px-6 py-2 text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-800"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
