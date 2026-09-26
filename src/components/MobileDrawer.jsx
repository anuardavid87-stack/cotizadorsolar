import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  X,
  LayoutDashboard,
  SunMedium,
  FileSpreadsheet,
  Users,
  Target,
  Package,
  ShieldCheck,
  History,
  FileSignature,
  ClipboardCheck,
  Zap,
  Sun,
  Moon,
  LogOut,
  Download,
  Smartphone,
  FileCheck2,
  Wrench,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePWA } from '../context/PWAContext';

export default function MobileDrawer({ isOpen, onClose, pendingCounts }) {
  const { user, isAdmin, hasPermission, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { isInstallable, isInstalled, installApp } = usePWA();

  if (!isOpen) return null;

  const allNavItems = [
    {
      to: '/',
      name: 'Panel General',
      icon: LayoutDashboard,
      permission: 'dashboard',
      badge: null
    },
    {
      to: '/visitas',
      name: 'Visitas Técnicas',
      icon: ClipboardCheck,
      permission: 'visits',
      badge: pendingCounts?.overdue_visits_count > 0 ? `${pendingCounts.overdue_visits_count} Venc.` : (pendingCounts?.today_visits_count > 0 ? `${pendingCounts.today_visits_count} Hoy` : null),
      urgentBadge: pendingCounts?.overdue_visits_count > 0 ? 'Visita' : null
    },
    {
      to: '/cotizador',
      name: 'Nueva Cotización',
      icon: SunMedium,
      permission: 'quotes',
      badge: null
    },
    {
      to: '/cotizaciones',
      name: 'Historial Cotizaciones',
      icon: FileSpreadsheet,
      permission: 'quotes',
      badge: pendingCounts?.pending_visits_to_quote_count > 0 ? `${pendingCounts.pending_visits_to_quote_count} x Cotizar` : null,
      urgentBadge: pendingCounts?.pending_visits_to_quote_count > 0 ? 'Cotizar' : null
    },
    {
      to: '/clientes',
      name: 'Clientes',
      icon: Users,
      permission: 'clients',
      badge: null
    },
    {
      to: '/seguimiento',
      name: 'Seguimiento CRM',
      icon: Target,
      permission: 'crm',
      badge: pendingCounts?.today_count > 0 ? `${pendingCounts.today_count} Hoy` : null,
      urgentBadge: pendingCounts?.overdue_count > 0 ? `${pendingCounts.overdue_count} Venc` : null
    },
    {
      to: '/contratos',
      name: 'Contratos de Obra',
      icon: FileSignature,
      permission: 'contracts',
      badge: pendingCounts?.pending_contracts_count > 0 ? `${pendingCounts.pending_contracts_count} Pend.` : null,
      urgentBadge: pendingCounts?.pending_contracts_count > 0 ? 'Contratar' : null
    },
    {
      to: '/trabajos',
      name: 'Prog. Trabajos',
      icon: Wrench,
      permission: 'jobs',
      badge: pendingCounts?.overdue_jobs_count > 0 ? `${pendingCounts.overdue_jobs_count} No Realiz.` : (pendingCounts?.today_jobs_count > 0 ? `${pendingCounts.today_jobs_count} Hoy` : null),
      urgentBadge: pendingCounts?.overdue_jobs_count > 0 ? 'No Realiz.' : null
    },
    {
      to: '/legalizaciones',
      name: 'Legalizaciones Operador',
      icon: FileCheck2,
      permission: 'legalizations',
      badge: null
    },
    {
      to: '/productos',
      name: 'Productos y Precios',
      icon: Package,
      permission: 'products',
      badge: null
    },
    {
      to: '/usuarios?tab=users',
      name: 'Usuarios del Sistema',
      icon: Users,
      permission: 'users',
      badge: null
    },
    ...(isAdmin ? [
      {
        to: '/usuarios?tab=roles',
        name: 'Roles y Permisos',
        icon: ShieldCheck,
        permission: 'users',
        badge: null
      },
      {
        to: '/usuarios?tab=company',
        name: 'Empresas & Membrete',
        icon: Building2,
        permission: 'company_settings',
        badge: null
      },
      {
        to: '/usuarios?tab=logs',
        name: 'Logs & Auditoría',
        icon: History,
        permission: 'logs',
        badge: null
      }
    ] : [])
  ];

  const navItems = allNavItems.filter((item) => hasPermission(item.permission));

  const location = useLocation();
  const isItemActive = (itemTo) => {
    if (itemTo.includes('?')) {
      const [path, search] = itemTo.split('?');
      return location.pathname === path && location.search.includes(search);
    }
    if (itemTo === '/usuarios' || itemTo === '/usuarios?tab=users') {
      return location.pathname === '/usuarios' && (!location.search || location.search.includes('tab=users'));
    }
    return itemTo === '/' ? (location.pathname === '/' && !location.search) : location.pathname.startsWith(itemTo);
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden no-print">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-out drawer */}
      <div className="fixed inset-y-0 right-0 max-w-[310px] w-full bg-slate-900 text-slate-200 shadow-2xl flex flex-col z-10 border-l border-slate-800 animate-slide-in-right">
        {/* Header with User Info & Close Button */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2d8a58] to-[#48bb78] flex items-center justify-center text-white font-black shadow-md shadow-[#2d8a58]/30">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                <span>{user?.name || 'Usuario'}</span>
              </div>
              <p className="text-[11px] font-mono text-[#48bb78] capitalize">
                @{user?.username || 'usuario'} &bull; {user?.role || 'asesor'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Módulos del Sistema
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#2d8a58] text-white shadow-md shadow-[#2d8a58]/20 font-bold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    item.urgentBadge ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-700 text-slate-200'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 space-y-2.5 bg-slate-950/40">
          {/* Toggle Dark / Light Theme */}
          <button
            onClick={toggleTheme}
            type="button"
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
              <span>{isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
              {isDark ? 'Oscuro' : 'Claro'}
            </span>
          </button>

          {/* Install PWA Button */}
          {!isInstalled && (
            <button
              onClick={() => {
                onClose();
                installApp();
              }}
              type="button"
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Instalar Aplicación PWA</span>
            </button>
          )}

          {/* Logout button */}
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            type="button"
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white text-xs font-bold border border-rose-500/30 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
