import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Bell,
  PlusCircle,
  CalendarClock,
  PhoneCall,
  ClipboardCheck,
  Sun,
  Moon,
  Download,
  Smartphone,
  FileSignature,
  Menu,
  Zap,
  FileSpreadsheet,
  Database,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePWA } from '../context/PWAContext';

export default function Navbar({ pendingStats, onOpenMenu }) {
  const {
    user,
    isAdmin,
    hasPermission,
    canQuote,
    canViewVisits,
    canViewClients,
    canViewCRM,
    canViewContracts,
    canManageSettings,
    authFetch,
    logout
  } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { isInstallable, isInstalled, installApp } = usePWA();
  const navigate = useNavigate();
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  const handleDownloadBackupExcel = async () => {
    try {
      setDownloadingBackup(true);
      const res = await authFetch('/api/backup/export-excel');
      if (!res.ok) throw new Error('Error al generar la copia de seguridad');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nowStr = new Date().toISOString().slice(0, 10);
      a.download = `COPIA_SEGURIDAD_RENOVA_SOLARTECH_${nowStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al descargar la copia de seguridad: ' + err.message);
    } finally {
      setDownloadingBackup(false);
    }
  };

  const totalUrgent =
    (canViewVisits ? (pendingStats?.overdue_visits_count || 0) + (pendingStats?.today_visits_count || 0) : 0) +
    (canViewContracts ? (pendingStats?.pending_contracts_count || 0) : 0) +
    (canQuote ? (pendingStats?.pending_visits_to_quote_count || 0) : 0) +
    (canViewCRM ? (pendingStats?.overdue_count || 0) + (pendingStats?.today_count || 0) : 0);

  return (
    <header className="h-14 sm:h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs no-print transition-colors duration-200">
      {/* Left: Mobile Brand & Hamburger Button */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        <button
          type="button"
          onClick={onOpenMenu}
          className="p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden cursor-pointer active:scale-95 transition-all"
          title="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2d8a58] to-[#48bb78] flex items-center justify-center text-white font-black shadow-xs md:hidden shrink-0">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div>
            <h2 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5 leading-tight">
              <span>Renova Energy</span>
              <span className="text-[#48bb78] text-[9px] px-1 py-0.2 rounded bg-[#2d8a58]/20 font-mono font-black md:hidden">PRO</span>
              <span className="text-slate-400 dark:text-slate-500 font-normal hidden sm:inline">&bull; Cotizador & CRM Solar</span>
            </h2>
          </div>
        </div>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Mobile Urgent Badge Button */}
        {totalUrgent > 0 && (
          <button
            onClick={() => {
              if (canViewVisits && ((pendingStats?.overdue_visits_count || 0) > 0 || (pendingStats?.today_visits_count || 0) > 0)) navigate('/visitas?tab=scheduled');
              else if (canQuote && (pendingStats?.pending_visits_to_quote_count || 0) > 0) navigate('/visitas?tab=pending_quote');
              else if (canViewContracts && (pendingStats?.pending_contracts_count || 0) > 0) navigate('/contratos?tab=pending');
              else if (canViewCRM && (pendingStats?.today_count || 0) > 0) navigate('/seguimiento?filter=today');
              else if (canViewClients) navigate('/clientes');
            }}
            className="md:hidden flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] shadow-xs animate-pulse cursor-pointer"
            title="Tareas urgentes pendientes"
          >
            <Bell className="w-3.5 h-3.5 fill-slate-950" />
            <span>{totalUrgent}</span>
          </button>
        )}

        {/* Technician Overdue Visits alert indicator */}
        {canViewVisits && pendingStats?.overdue_visits_count > 0 && (
          <button
            onClick={() => navigate('/visitas?tab=scheduled')}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-black hover:bg-rose-500 transition-colors shadow-xs animate-pulse cursor-pointer"
            title="Visitas técnicas vencidas"
          >
            <ClipboardCheck className="w-4 h-4 text-white" />
            <span>{pendingStats.overdue_visits_count} visita{pendingStats.overdue_visits_count > 1 ? 's' : ''} vencida{pendingStats.overdue_visits_count > 1 ? 's' : ''}</span>
          </button>
        )}

        {/* Desktop Urgent won projects awaiting contract indicator */}
        {canViewContracts && pendingStats?.pending_contracts_count > 0 && (
          <button
            onClick={() => navigate('/contratos?tab=pending')}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 transition-colors shadow-xs animate-pulse cursor-pointer"
            title="Proyectos ganados pendientes por formalizar contrato"
          >
            <FileSignature className="w-4 h-4 text-slate-950" />
            <span>{pendingStats.pending_contracts_count} proyecto{pendingStats.pending_contracts_count > 1 ? 's' : ''} por contratar</span>
          </button>
        )}

        {/* Desktop Urgent visits alert indicator */}
        {canQuote && pendingStats?.pending_visits_to_quote_count > 0 && (
          <button
            onClick={() => navigate('/visitas?tab=pending_quote')}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 transition-colors shadow-xs animate-pulse cursor-pointer"
            title="Visitas técnicas pendientes por cotizar"
          >
            <ClipboardCheck className="w-4 h-4 text-slate-950" />
            <span>{pendingStats.pending_visits_to_quote_count} visita{pendingStats.pending_visits_to_quote_count > 1 ? 's' : ''} por cotizar</span>
          </button>
        )}

        {/* Desktop Urgent followups alert indicator */}
        {canViewCRM && pendingStats?.today_count > 0 && (
          <button
            onClick={() => navigate('/seguimiento?filter=today')}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors shadow-xs"
            title="Ver seguimientos para hoy"
          >
            <CalendarClock className="w-4 h-4 text-amber-600 animate-bounce" />
            <span>{pendingStats.today_count} para hoy</span>
          </button>
        )}

        {/* Desktop Quick Action Button */}
        {canQuote ? (
          <button
            onClick={() => navigate('/cotizador')}
            className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-md shadow-[#2d8a58]/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nueva Cotización</span>
          </button>
        ) : canViewClients ? (
          <button
            onClick={() => navigate('/clientes?action=new')}
            className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-md shadow-[#2d8a58]/20 transition-all cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>+ Nuevo Cliente & Visita</span>
          </button>
        ) : canViewVisits ? (
          <button
            onClick={() => navigate('/visitas?action=new')}
            className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-md shadow-[#2d8a58]/20 transition-all cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>+ Agendar Visita</span>
          </button>
        ) : null}

        {/* Desktop Backup Excel Button */}
        {(isAdmin || canManageSettings) && (
          <button
            onClick={handleDownloadBackupExcel}
            disabled={downloadingBackup}
            type="button"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Descargar Copia de Seguridad completa en Excel (.xlsx con 10 hojas de cálculo)"
          >
            {downloadingBackup ? (
              <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{downloadingBackup ? 'Generando...' : 'Copia de Seguridad'}</span>
          </button>
        )}

        {/* Desktop PWA Install Button */}
        {!isInstalled && (
          <button
            onClick={installApp}
            type="button"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-[#2d8a58] hover:from-emerald-500 hover:to-[#237348] text-white text-xs font-bold shadow-sm shadow-[#2d8a58]/25 transition-all cursor-pointer"
            title="Instalar Renova Energy como aplicación PWA en este dispositivo"
          >
            <Download className="w-4 h-4" />
            <span>Instalar App</span>
          </button>
        )}

        {/* Dark / Light Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          type="button"
          className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-xs"
          title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
              <span className="hidden sm:inline font-medium">Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline font-medium">Modo Oscuro</span>
            </>
          )}
        </button>

        {/* User avatar on mobile / Desktop Logout */}
        <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

        <button
          onClick={logout}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
          title="Cerrar Sesión"
        >
          <LogOut className="w-4 h-4" />
          <span>Salir</span>
        </button>
      </div>
    </header>
  );
}
