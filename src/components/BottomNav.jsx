import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  SunMedium,
  ClipboardCheck,
  Users,
  Menu,
  PlusCircle,
  Wrench
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BottomNav({ pendingStats, onOpenMenu }) {
  const location = useLocation();
  const { hasPermission } = useAuth();

  const allBottomItems = [
    {
      to: '/',
      name: 'Inicio',
      icon: LayoutDashboard,
      permission: 'dashboard',
      badge: null
    },
    {
      to: '/cotizador',
      name: 'Cotizar',
      icon: PlusCircle,
      permission: 'quotes',
      badge: null,
      highlight: true
    },
    {
      to: '/visitas',
      name: 'Visitas',
      icon: ClipboardCheck,
      permission: 'visits',
      badge: (pendingStats?.overdue_visits_count || 0) + (pendingStats?.today_visits_count || 0) || null
    },
    {
      to: '/trabajos',
      name: 'Trabajos',
      icon: Wrench,
      permission: 'jobs',
      badge: (pendingStats?.overdue_jobs_count || 0) + (pendingStats?.today_jobs_count || 0) || null
    },
    {
      to: '/clientes',
      name: 'Clientes',
      icon: Users,
      permission: 'clients',
      badge: null
    }
  ];

  const navItems = allBottomItems.filter((item) => hasPermission(item.permission));
  const totalCols = navItems.length + 1;
  const gridClass = totalCols === 2 ? 'grid-cols-2' :
                    totalCols === 3 ? 'grid-cols-3' :
                    totalCols === 4 ? 'grid-cols-4' :
                    totalCols === 5 ? 'grid-cols-5' : 'grid-cols-6';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 md:hidden no-print shadow-lg transition-colors">
      <div className={`grid ${gridClass} h-16 items-center px-1`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          if (item.highlight) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center -mt-5 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#2d8a58] hover:bg-[#237348] active:scale-95 text-white flex items-center justify-center shadow-lg shadow-[#2d8a58]/35 transition-transform">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-[#2d8a58] dark:text-[#48bb78] mt-1">
                  {item.name}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center justify-center h-full py-1 text-center transition-colors active:scale-95 ${
                isActive
                  ? 'text-[#2d8a58] dark:text-[#48bb78]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 ${isActive ? 'font-black' : 'font-medium'}`}>
                {item.name}
              </span>
            </NavLink>
          );
        })}

        {/* Menu Button to trigger drawer */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="relative flex flex-col items-center justify-center h-full py-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95 transition-colors cursor-pointer"
        >
          <div className="relative">
            <Menu className="w-5 h-5 stroke-[1.8]" />
            {(pendingStats?.overdue_count > 0 || pendingStats?.today_count > 0 || pendingStats?.pending_contracts_count > 0) && (
              <span className="absolute -top-1 -right-1 bg-amber-500 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-medium mt-1">Más</span>
        </button>
      </div>
    </nav>
  );
}
