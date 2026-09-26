import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Users,
  SunMedium,
  CalendarClock,
  PhoneCall,
  Flame,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  BatteryCharging,
  Droplets,
  Layers,
  ChevronRight,
  ClipboardCheck,
  FileSignature,
  AlertTriangle,
  UserPlus,
  Calendar,
  FileSpreadsheet,
  Wrench
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCOP, formatDate, formatKW, getSystemTypeName, getInterestBadgeInfo, getStatusBadgeInfo } from '../utils/formatters';

export default function Dashboard({ onStatsUpdate }) {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  const handleDownloadBackup = async () => {
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
      alert('Error al descargar copia de seguridad: ' + err.message);
    } finally {
      setDownloadingBackup(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const clientDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local format
      const res = await authFetch(`/api/settings/dashboard-stats?client_date=${clientDate}`);
      const data = await res.json();
      setStats(data);
      if (onStatsUpdate) {
        onStatsUpdate({
          today_count: data.pending_today_count || 0,
          overdue_count: data.overdue_count || 0,
          overdue_visits_count: data.overdue_visits_count || 0,
          today_visits_count: data.today_visits_count || 0,
          pending_visits_to_quote_count: data.pending_visits_to_quote_count || 0,
          scheduled_visits_count: data.scheduled_visits_count || 0,
          pending_contracts_count: data.pending_contracts_count || 0,
          overdue_jobs_count: data.overdue_jobs_count || 0,
          today_jobs_count: data.today_jobs_count || 0
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[#2d8a58]/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full bg-[#2d8a58]/20 text-[#48bb78] font-mono text-xs font-bold border border-[#2d8a58]/30">
                Renova Energy &bull; Panel Comercial
              </span>
              <span className="text-xs text-slate-400">
                {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Bienvenido, {user?.name || 'Asesor'}
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Monitorea tus cotizaciones solares, atiende los seguimientos de hoy y maximiza el cierre de proyectos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => navigate('/clientes?action=new')}
              className="px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all cursor-pointer"
              title="Registrar un nuevo cliente en el sistema"
            >
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
              <span>+ Nuevo Cliente</span>
            </button>
            <button
              onClick={() => navigate('/visitas?action=new')}
              className="px-4 py-3 rounded-2xl bg-[#2d8a58] hover:bg-[#237348] active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-[#2d8a58]/25 flex items-center gap-2 transition-all cursor-pointer"
              title="Agendar una nueva visita técnica"
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span>+ Agendar Visita</span>
            </button>
            <button
              onClick={() => navigate('/trabajos?action=new')}
              className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all cursor-pointer"
              title="Programar un nuevo trabajo o mantenimiento técnico"
            >
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span>+ Trabajos</span>
            </button>
            <button
              onClick={() => navigate('/cotizaciones')}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
            >
              <SunMedium className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              <span>Cotizaciones</span>
            </button>
            <button
              onClick={() => navigate('/seguimiento')}
              className="px-3.5 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs sm:text-sm border border-slate-700/80 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>CRM</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownloadBackup}
              disabled={downloadingBackup}
              className="px-3.5 py-3 rounded-2xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Descargar Copia de Seguridad completa en Excel con 11 hojas"
            >
              {downloadingBackup ? (
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              )}
              <span>{downloadingBackup ? 'Generando...' : 'Copia (.xlsx)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pending Contracts Alert Banner (Won Projects Awaiting Contract) */}
      {stats?.pending_contracts_count > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-emerald-600 to-[#2d8a58] text-white rounded-3xl p-6 shadow-xl shadow-amber-500/20 border-2 border-amber-300 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white text-amber-600 flex items-center justify-center font-bold shrink-0 shadow-md">
                <FileSignature className="w-7 h-7 animate-pulse text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-amber-200 font-black text-xs uppercase tracking-wider">
                    ¡Proyecto Ganado! Requiere Contrato
                  </span>
                  <span className="text-xs font-bold text-white/95">
                    {stats.pending_contracts_count} {stats.pending_contracts_count === 1 ? 'proyecto ganado pendiente' : 'proyectos ganados pendientes'} por formalizar contrato
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  ¡Cierre comercial exitoso! Falta formalizar el contrato de obra y acuerdo de pago.
                </h3>
                <p className="text-xs text-white/85 max-w-2xl">
                  Esta alerta permanecerá activa en el panel principal hasta que se redacte y genere el contrato para cada proyecto ganado.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/contratos?tab=pending')}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Ver Módulo de Contratos</span>
                <ArrowRight className="w-4 h-4 text-[#2d8a58]" />
              </button>
            </div>
          </div>

          {/* Quick Action List of Won Quotes Awaiting Contract */}
          {stats?.pending_contracts_quotes?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.pending_contracts_quotes.map((pq) => (
                <div key={pq.quote_id} className="p-3.5 rounded-2xl bg-white text-slate-800 border border-white/80 flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-mono text-[10px] font-black text-[#1c5c3a] bg-[#2d8a58]/15 px-1.5 py-0.5 rounded">
                        {pq.quote_code}
                      </span>
                      <span className="text-[11px] font-medium text-slate-600 truncate">{pq.client_city || 'Sitio'}</span>
                    </div>
                    <p className="text-xs font-black text-slate-900 truncate">{pq.client_name}</p>
                    <p className="text-[11px] text-[#2d8a58] font-black truncate">
                      {formatCOP(pq.total_price)} &bull; {pq.installed_power_kwp || 0} kWp
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/contrato/nuevo/${pq.quote_id}`)}
                    className="px-3.5 py-2 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-black text-xs shadow-xs shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <span>Elaborar Contrato</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overdue / Today Scheduled Visits Alert Banner (Visitas no realizadas en el tiempo acordado) */}
      {(stats?.overdue_visits_count > 0 || stats?.today_visits_count > 0) && (
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-white rounded-3xl p-6 shadow-xl shadow-rose-600/20 border-2 border-rose-300 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white text-rose-600 flex items-center justify-center font-bold shrink-0 shadow-md">
                <CalendarClock className="w-7 h-7 animate-pulse text-rose-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-rose-200 font-black text-xs uppercase tracking-wider">
                    Alerta de Visitas Técnicas
                  </span>
                  <span className="text-xs font-bold text-white/95">
                    {stats.overdue_visits_count > 0
                      ? `${stats.overdue_visits_count} ${stats.overdue_visits_count === 1 ? 'visita técnica vencida' : 'visitas técnicas vencidas'} sin realizar`
                      : `${stats.today_visits_count} ${stats.today_visits_count === 1 ? 'visita técnica programada' : 'visitas técnicas programadas'} para hoy`}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  {stats.overdue_visits_count > 0
                    ? '¡Atención! Visitas acordadas no realizadas en el tiempo establecido.'
                    : '¡Recordatorio! Visitas técnicas programadas para ejecutarse hoy.'}
                </h3>
                <p className="text-xs text-white/85 max-w-2xl">
                  {stats.overdue_visits_count > 0
                    ? 'El tiempo acordado para la visita ya venció. Por favor ingresa el levantamiento de campo o reprograma la fecha para dar continuidad a la cotización.'
                    : 'Ejecuta el levantamiento técnico en terreno para habilitar inmediatamente la emisión de la cotización.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/visitas?tab=scheduled')}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Ver Agenda de Visitas</span>
                <ArrowRight className="w-4 h-4 text-rose-600" />
              </button>
            </div>
          </div>

          {/* Quick Action List of Overdue / Today Visits */}
          {stats?.overdue_and_today_visits?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.overdue_and_today_visits.map((ov) => {
                const todayStr = new Date().toISOString().split('T')[0];
                const isOverdue = ov.scheduled_date < todayStr;
                return (
                  <div key={ov.visit_id} className="p-3.5 rounded-2xl bg-white text-slate-800 border border-white/80 flex items-center justify-between gap-3 shadow-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded ${isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                          {ov.visit_code} &bull; {isOverdue ? 'RETRASADA' : 'HOY'}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 truncate">{ov.client_city || 'Sitio'}</span>
                      </div>
                      <p className="text-xs font-black text-slate-900 truncate">{ov.client_name}</p>
                      <p className="text-[11px] text-slate-600 truncate">
                        Pactada: <span className="font-semibold text-slate-800">{formatDate(ov.scheduled_date)}</span> {ov.scheduled_time || ''}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/visitas?visitId=${ov.visit_id}`)}
                      className={`px-3 py-2 rounded-xl text-white font-black text-xs shadow-xs shrink-0 cursor-pointer flex items-center gap-1 ${isOverdue ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                    >
                      <span>Realizar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pending Visits Alert Banner */}
      {stats?.pending_visits_to_quote_count > 0 && (
        <div className="bg-gradient-to-r from-[#2d8a58] via-[#237348] to-[#2d8a58] text-white rounded-3xl p-6 shadow-xl shadow-[#2d8a58]/20 border-2 border-[#48bb78] relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white text-[#2a561c] flex items-center justify-center font-bold shrink-0 shadow-md">
                <ClipboardCheck className="w-7 h-7 animate-pulse text-[#2d8a58]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/30 text-white font-black text-xs uppercase tracking-wider">
                    Alerta de Operaciones
                  </span>
                  <span className="text-xs font-bold text-white/90">
                    {stats.pending_visits_to_quote_count} {stats.pending_visits_to_quote_count === 1 ? 'visita técnica pendiente' : 'visitas técnicas pendientes'} por cotizar
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  ¡Levantamiento técnico realizado! Requiere emitir la cotización.
                </h3>
                <p className="text-xs text-white/80 max-w-2xl">
                  Esta alerta permanecerá activa en el panel hasta que la cotización sea generada y vinculada a la visita.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/cotizaciones')}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-[#224817] font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Ver Módulo de Cotizaciones</span>
                <ArrowRight className="w-4 h-4 text-[#2d8a58]" />
              </button>
            </div>
          </div>

          {/* Quick Action List of Visits to Quote */}
          {stats?.pending_visits_to_quote?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.pending_visits_to_quote.map((pv) => (
                <div key={pv.visit_id} className="p-3.5 rounded-2xl bg-white text-slate-800 border border-white/60 flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-mono text-[10px] font-bold text-[#234a17] bg-[#2d8a58]/20 px-1.5 py-0.2 rounded">
                        {pv.visit_code}
                      </span>
                      <span className="text-[11px] font-medium text-slate-600 truncate">{pv.client_city || 'Sitio'}</span>
                    </div>
                    <p className="text-xs font-black text-slate-900 truncate">{pv.client_name}</p>
                    <p className="text-[11px] text-slate-600 truncate">
                      {pv.recommended_system_type ? `Sistema: ${getSystemTypeName(pv.recommended_system_type)}` : 'Levantamiento completado'}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/cotizador?visitId=${pv.visit_id}&clientId=${pv.client_id}`)}
                    className="px-3.5 py-2 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-xs shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <span>Cotizar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overdue / Today Technical Jobs Alert Banner (Trabajos técnicos no realizados a tiempo) */}
      {(stats?.overdue_jobs_count > 0 || stats?.today_jobs_count > 0) && (
        <div className="bg-gradient-to-r from-red-800 via-rose-800 to-amber-700 text-white rounded-3xl p-6 shadow-xl shadow-rose-900/20 border-2 border-red-400 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white text-rose-700 flex items-center justify-center font-bold shrink-0 shadow-md">
                <Wrench className="w-7 h-7 animate-pulse text-rose-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-rose-200 font-black text-xs uppercase tracking-wider">
                    Alerta de Trabajos Técnicos
                  </span>
                  <span className="text-xs font-bold text-white/95">
                    {stats.overdue_jobs_count > 0
                      ? `${stats.overdue_jobs_count} ${stats.overdue_jobs_count === 1 ? 'trabajo técnico vencido' : 'trabajos técnicos vencidos'} no realizados a tiempo`
                      : `${stats.today_jobs_count} ${stats.today_jobs_count === 1 ? 'trabajo técnico programado' : 'trabajos técnicos programados'} para hoy`}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  {stats.overdue_jobs_count > 0
                    ? '¡Atención! Trabajos técnicos no cumplidos por el técnico en la fecha estipulada.'
                    : '¡Recordatorio! Trabajos técnicos e instalaciones asignadas para ejecutarse hoy.'}
                </h3>
                <p className="text-xs text-white/85 max-w-2xl">
                  {stats.overdue_jobs_count > 0
                    ? 'El técnico asignado no ha reportado la culminación de la labor. Revisa el estado del trabajo, comunícate con el técnico o reprograma la fecha.'
                    : 'Asegúrate de que los técnicos cuenten con los materiales, herramientas y autorizaciones para las labores de hoy.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/trabajos')}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Ver Módulo de Trabajos</span>
                <ArrowRight className="w-4 h-4 text-rose-700" />
              </button>
            </div>
          </div>

          {/* Quick Action List of Urgent / Overdue Jobs */}
          {stats?.urgent_jobs?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.urgent_jobs.map((jb) => {
                const todayStr = new Date().toISOString().split('T')[0];
                const isOverdue = jb.scheduled_date < todayStr;
                return (
                  <div key={jb.id} className="p-3.5 rounded-2xl bg-white text-slate-800 border border-white/80 flex items-center justify-between gap-3 shadow-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded ${isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                          {jb.job_code} &bull; {isOverdue ? 'NO REALIZADO' : 'HOY'}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 truncate">{jb.priority || 'Media'}</span>
                      </div>
                      <p className="text-xs font-black text-slate-900 truncate">{jb.title}</p>
                      <p className="text-[11px] text-slate-600 truncate">
                        Cliente: <span className="font-semibold text-slate-800">{jb.client_name || 'Particular'}</span>
                      </p>
                      <p className="text-[11px] text-slate-700 truncate">
                        Técnico: <span className="font-bold text-rose-700">{jb.technician_name || 'Sin técnico asignado'}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        Pactado: {formatDate(jb.scheduled_date)} {jb.scheduled_time || ''}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/trabajos')}
                      className={`px-3 py-2 rounded-xl text-white font-black text-xs shadow-xs shrink-0 cursor-pointer flex items-center gap-1 ${isOverdue ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                    >
                      <span>Gestionar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        {/* Card 1: Total Cotizado */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor Cotizado</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCOP(stats?.total_quoted_money)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {stats?.total_quotes || 0} cotizaciones generadas
            </p>
          </div>
        </div>

        {/* Card 2: Seguimientos Hoy */}
        <div
          onClick={() => navigate('/seguimiento?filter=today')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-600 transition-colors">
              Pendientes Hoy
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <CalendarClock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-amber-600 tracking-tight flex items-center gap-2">
              {stats?.pending_today_count || 0}
              {stats?.pending_today_count > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold animate-pulse">
                  Acción requerida
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Programados para atender hoy</span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </p>
          </div>
        </div>

        {/* Card 3: Atrasados / Vencidos */}
        <div
          onClick={() => navigate('/seguimiento?filter=overdue')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-rose-600 transition-colors">
              Atrasados
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <PhoneCall className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-rose-600 tracking-tight flex items-center gap-2">
              {stats?.overdue_count || 0}
              {stats?.overdue_count > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                  Vencidos
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Requieren contacto urgente</span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </p>
          </div>
        </div>

        {/* Card 4: Clientes Probables (8-10) */}
        <div
          onClick={() => navigate('/seguimiento?filter=hot')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-red-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-red-600 transition-colors">
              Clientes Probables
            </span>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
              <Flame className="w-5 h-5 fill-red-500" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-red-600 tracking-tight flex items-center gap-2">
              {stats?.hot_leads_count || 0}
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
                Score 8-10 Probables
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Alta probabilidad de cierre</span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </p>
          </div>
        </div>

        {/* Card 5: Visitas por Cotizar */}
        <div
          onClick={() => navigate('/visitas?tab=pending_quote')}
          className={`p-5 rounded-2xl border shadow-xs transition-all cursor-pointer group ${
            (stats?.pending_visits_to_quote_count || 0) > 0
              ? 'bg-[#2d8a58]/10 border-[#2d8a58]/50 hover:bg-[#2d8a58]/20 hover:shadow-md'
              : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#1c5c3a] transition-colors">
              Visitas Pendientes
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              (stats?.pending_visits_to_quote_count || 0) > 0 ? 'bg-[#2d8a58] text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-black tracking-tight flex items-center gap-2 ${
              (stats?.pending_visits_to_quote_count || 0) > 0 ? 'text-[#234a17]' : 'text-slate-900'
            }`}>
              {stats?.pending_visits_to_quote_count || 0}
              {(stats?.pending_visits_to_quote_count || 0) > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#2d8a58] text-white font-bold animate-pulse">
                  Por Cotizar
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>{stats?.scheduled_visits_count || 0} agendadas a futuro</span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </p>
          </div>
        </div>

        {/* Card 6: Contratos Pendientes (Proyectos Ganados sin Contrato) */}
        <div
          onClick={() => navigate('/contratos?tab=pending')}
          className={`p-5 rounded-2xl border shadow-xs transition-all cursor-pointer group ${
            (stats?.pending_contracts_count || 0) > 0
              ? 'bg-amber-500/10 border-amber-500/50 hover:bg-amber-500/20 hover:shadow-md'
              : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-amber-700 transition-colors">
              Por Contratar
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              (stats?.pending_contracts_count || 0) > 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
            }`}>
              <FileSignature className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-black tracking-tight flex items-center gap-2 ${
              (stats?.pending_contracts_count || 0) > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}>
              {stats?.pending_contracts_count || 0}
              {(stats?.pending_contracts_count || 0) > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black animate-pulse">
                  Ganados
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Pendiente hacer contrato</span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </p>
          </div>
        </div>

        {/* Card 7: Trabajos Técnicos */}
        <div
          onClick={() => navigate('/trabajos')}
          className={`p-5 rounded-2xl border shadow-xs transition-all cursor-pointer group ${
            (stats?.overdue_jobs_count || 0) > 0
              ? 'bg-rose-500/10 border-rose-500/50 hover:bg-rose-500/20 hover:shadow-md'
              : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-rose-700 transition-colors">
              Prog. Trabajos
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              (stats?.overdue_jobs_count || 0) > 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-black tracking-tight flex items-center gap-2 ${
              (stats?.overdue_jobs_count || 0) > 0 ? 'text-rose-700' : 'text-slate-900'
            }`}>
              {(stats?.overdue_jobs_count || 0) > 0 ? stats.overdue_jobs_count : (stats?.today_jobs_count || 0)}
              {(stats?.overdue_jobs_count || 0) > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-600 text-white font-black animate-pulse">
                  Vencidos
                </span>
              ) : (stats?.today_jobs_count || 0) > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold">
                  Hoy
                </span>
              ) : null}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>{stats?.overdue_jobs_count > 0 ? 'No realizados a tiempo' : 'Agenda de operaciones'}</span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </p>
          </div>
        </div>
      </div>

      {/* Middle Section: Urgent Follow-ups & System Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Urgent Followups Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-amber-500" />
                Seguimientos Prioritarios Pendientes
              </h2>
              <p className="text-xs text-slate-500">
                Clientes que deben contactarse para avanzar en el proceso comercial
              </p>
            </div>
            <button
              onClick={() => navigate('/seguimiento')}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {stats?.urgent_followups?.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-700">¡Al día!</p>
              <p className="text-xs text-slate-400">No tienes seguimientos pendientes vencidos para hoy.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Cliente</th>
                    <th className="pb-3 font-semibold">Sistema / Código</th>
                    <th className="pb-3 font-semibold">Valor</th>
                    <th className="pb-3 font-semibold text-center">Interés</th>
                    <th className="pb-3 font-semibold">Fecha Límite</th>
                    <th className="pb-3 font-semibold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats?.urgent_followups?.map((item) => {
                    const badge = getInterestBadgeInfo(item.interest_score);
                    const isToday = item.followup_date === new Date().toISOString().split('T')[0];
                    const isOverdue = item.followup_date < new Date().toISOString().split('T')[0];

                    return (
                      <tr key={item.quote_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 pr-2">
                          <div className="font-bold text-slate-800">{item.client_name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <span>{item.client_phone || 'Sin tel'}</span>
                            {item.client_city && <span>&bull; {item.client_city}</span>}
                          </div>
                        </td>
                        <td className="py-3.5 pr-2">
                          <span className="font-mono text-xs font-bold text-slate-600 block">
                            {item.quote_code}
                          </span>
                          <span className="text-xs text-slate-500">
                            {getSystemTypeName(item.system_type)}
                          </span>
                        </td>
                        <td className="py-3.5 pr-2 font-bold text-slate-800">
                          {formatCOP(item.total_price)}
                        </td>
                        <td className="py-3.5 pr-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.color}`}>
                            {badge.shortLabel}
                          </span>
                        </td>
                        <td className="py-3.5 pr-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            isOverdue
                              ? 'bg-rose-100 text-rose-800'
                              : isToday
                              ? 'bg-amber-100 text-amber-800'
                              : 'text-slate-600'
                          }`}>
                            {formatDate(item.followup_date)}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => navigate(`/seguimiento?quoteId=${item.quote_id}`)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all cursor-pointer"
                          >
                            Gestionar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1 Col: Systems Breakdown & Commercial Metrics */}
        <div className="space-y-6">
          {/* Systems Breakdown */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-500" />
              Tipos de Sistemas Cotizados
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Participación por tipología solar
            </p>

            <div className="space-y-3">
              {[
                { type: 'ongrid', name: 'On-Grid (Interconectado)', icon: SunMedium, color: 'text-amber-500 bg-amber-50' },
                { type: 'hibrido', name: 'On-Grid con Baterías', icon: BatteryCharging, color: 'text-emerald-500 bg-emerald-50' },
                { type: 'offgrid', name: 'Off-Grid (Aislado)', icon: TrendingUp, color: 'text-blue-500 bg-blue-50' },
                { type: 'bombeo', name: 'Bombeo Solar', icon: Droplets, color: 'text-cyan-500 bg-cyan-50' }
              ].map((sys) => {
                const found = stats?.systems_breakdown?.find(s => s.system_type === sys.type) || { count: 0, total_amount: 0 };
                const Icon = sys.icon;
                return (
                  <div key={sys.type} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl ${sys.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{sys.name}</p>
                        <p className="text-[11px] text-slate-500 font-semibold">{found.count} cotizaciones</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-900">{formatCOP(found.total_amount)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
