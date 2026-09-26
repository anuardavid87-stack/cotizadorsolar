import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-6 text-slate-800 dark:text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-slate-800 dark:text-white">
              Algo inesperado ocurrió
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se presentó un inconveniente al cargar esta sección. Puedes recargar la vista o regresar al inicio.
            </p>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left font-mono text-[11px] text-rose-600 dark:text-rose-400 overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#2d8a58]/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recargar</span>
              </button>

              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer hover:bg-slate-300"
              >
                <Home className="w-4 h-4" />
                <span>Ir al Inicio</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
