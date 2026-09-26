import React from 'react';
import { Download, Share, PlusSquare, X, WifiOff, CheckCircle } from 'lucide-react';
import { usePWA } from '../context/PWAContext';
import Modal from './Modal';

export default function PWAInstallBanner() {
  const { isOnline, isIOS, showIOSPrompt, setShowIOSPrompt, isInstallable, installApp, isInstalled } = usePWA();

  return (
    <>
      {/* Offline Status Warning Bar */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md sticky top-0 z-50 animate-pulse no-print">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              <strong>Modo Sin Conexión (Offline):</strong> Estás navegando con la caché local. Puedes seguir consultando información técnica en campo.
            </span>
          </div>
        </div>
      )}

      {/* iOS Installation Instructions Modal */}
      <Modal
        isOpen={showIOSPrompt}
        onClose={() => setShowIOSPrompt(false)}
        title="Instalar Renova Solar en iPhone / iPad"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-slate-700 dark:text-slate-300 text-sm">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-xl bg-[#2d8a58] flex items-center justify-center text-white shrink-0 shadow-md">
              <img src="/icons/icon-192x192.png" alt="Renova Solar" className="w-10 h-10 rounded-lg" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white">Renova Energy PRO</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Instala como app nativa sin App Store</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Sigue estos 3 sencillos pasos desde el navegador <strong>Safari</strong>:
          </p>

          <ol className="space-y-3">
            <li className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="w-6 h-6 rounded-full bg-[#2d8a58]/20 text-[#2d8a58] font-black text-xs flex items-center justify-center shrink-0">1</span>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  Toca el botón <strong>Compartir</strong> <Share className="w-4 h-4 text-blue-500 inline" />
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ubicado en la barra inferior de Safari.</p>
              </div>
            </li>

            <li className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="w-6 h-6 rounded-full bg-[#2d8a58]/20 text-[#2d8a58] font-black text-xs flex items-center justify-center shrink-0">2</span>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  Selecciona <strong>"Agregar a pantalla de inicio"</strong> <PlusSquare className="w-4 h-4 text-slate-700 dark:text-slate-300 inline" />
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Desplázate hacia abajo en el menú de opciones.</p>
              </div>
            </li>

            <li className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="w-6 h-6 rounded-full bg-[#2d8a58]/20 text-[#2d8a58] font-black text-xs flex items-center justify-center shrink-0">3</span>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Toca <strong>"Agregar"</strong> en la esquina superior
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">¡Listo! Tendrás el acceso directo con icono en tu pantalla.</p>
              </div>
            </li>
          </ol>

          <button
            onClick={() => setShowIOSPrompt(false)}
            className="w-full py-2.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-md shadow-[#2d8a58]/20 transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </Modal>
    </>
  );
}
