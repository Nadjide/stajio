import React, { Component, ErrorInfo, ReactNode } from 'react';

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
    error: null
  };

  public static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Une erreur est survenue.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) {
          errorMessage = `Erreur Firestore: ${parsed.error} (${parsed.operationType} sur ${parsed.path})`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4">
          <div className="bg-white dark:bg-stone-900 p-8 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 max-w-md w-full text-center">
            <h2 className="text-2xl font-semibold text-stone-900 dark:text-white mb-4">Oups !</h2>
            <p className="text-stone-600 dark:text-stone-400 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-600 dark:bg-emerald-500 text-white px-6 py-2 rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors"
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
