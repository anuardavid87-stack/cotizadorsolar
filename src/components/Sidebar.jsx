import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  SunMedium,
  FileSpreadsheet,
  Users,
  Target,
  Package,
  ShieldCheck,
  History,
  Building2,
  Zap,
  PhoneCall,
  ClipboardCheck,
  Download,
  Smartphone,
  FileSignature,
  FileCheck2,
  Wrench
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePWA } from '../context/PWAContext';
import { getRoleBadgeInfo } from '../utils/formatters';

export default function Sidebar({ pendingCounts }) {
  const { user, isAdmin, hasPermission } = useAuth();
  const { isInstalled, installApp } = usePWA();
  const location = useLocation();

  const operationsNavItems = [
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
      to: '/cotizaciones',
      name: 'Cotizaciones',
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
      name: 'Legalizaciones',
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
    }
  ];

  const adminNavItems = [
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

  const filteredOperations = operationsNavItems.filter((item) => hasPermission(item.permission));
  const filteredAdmin = adminNavItems.filter((item) => hasPermission(item.permission));

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

  const renderNavGroup = (items) => (
    items.map((item) => {
      const Icon = item.icon;
      const active = isItemActive(item.to);
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={
            `flex items-center justify-between px-3 py-2 rounded-xl font-medium text-[13px] transition-all duration-150 ${
              active
                ? 'bg-[#2d8a58] text-white font-bold shadow-md shadow-[#2d8a58]/25'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
            <span className="truncate">{item.name}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {item.urgentBadge && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-600 text-white animate-pulse">
                {item.urgentBadge}
              </span>
            )}
            {item.badge && !active && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-[#2d8a58] text-white">
                {item.badge}
              </span>
            )}
          </div>
        </NavLink>
      );
    })
  );

  return (
    <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col shrink-0 border-r border-slate-800 select-none no-print">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2d8a58] to-[#48bb78] flex items-center justify-center text-white font-black shadow-lg shadow-[#2d8a58]/25 shrink-0">
          <Zap className="w-5 h-5 fill-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-white text-sm leading-tight tracking-tight flex items-center gap-1.5 truncate">
            Renova Energy <span className="text-[#48bb78] text-[9px] px-1 py-0.2 rounded bg-[#2d8a58]/20 font-mono font-black">PRO</span>
          </h1>
          <p className="text-[11px] text-slate-400 truncate">Energía Solar para Todos</p>
        </div>
      </div>

      {/* Navigation items - Everything in plain sight, NO dropdowns */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        {filteredOperations.length > 0 && (
          <div className="mb-2">
            <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Operaciones & Comercial
            </div>
            <div className="space-y-0.5 mt-0.5">
              {renderNavGroup(filteredOperations)}
            </div>
          </div>
        )}

        {filteredAdmin.length > 0 && (
          <div className="pt-2 mt-2 border-t border-slate-800/70">
            <div className="px-3 py-1 text-[10px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Administración & Sistema</span>
            </div>
            <div className="space-y-0.5 mt-0.5">
              {renderNavGroup(filteredAdmin)}
            </div>
          </div>
        )}
      </nav>

      {/* PWA & Android APK Download Section */}
      <div className="px-3 py-2 border-t border-slate-800/60 bg-slate-950/20 space-y-1.5">
        <a
          href="/renova-solar.apk"
          download="renova-solar.apk"
          className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-[#2d8a58] to-emerald-600 hover:from-[#237348] hover:to-emerald-500 text-white font-bold text-xs flex items-center justify-between transition-all shadow-sm group"
          title="Descargar instalador APK para teléfonos Android"
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-emerald-200 group-hover:scale-110 transition-transform" />
            <span>Descargar App (.APK)</span>
          </div>
          <Download className="w-3.5 h-3.5" />
        </a>

        {!isInstalled && (
          <button
            onClick={installApp}
            type="button"
            className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-[#2d8a58] text-slate-300 hover:text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer border border-slate-700/60"
            title="Instalar como aplicación en este dispositivo"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-[#48bb78]" />
              <span>Instalar PWA</span>
            </div>
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* User Status Card */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[#48bb78] text-xs shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate leading-tight">{user?.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-800 text-[#48bb78] border border-slate-700 truncate">
                {getRoleBadgeInfo(user?.role).name}
              </span>
              {user?.username && (
                <span className="text-[10px] text-slate-400 font-mono truncate">@{user.username}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
