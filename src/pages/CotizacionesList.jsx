import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Eye,
  Calendar,
  Trash2,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Edit2,
  ClipboardCheck,
  Zap,
  ArrowRight,
  SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCOP, formatDate, formatKW, getSystemTypeName, getInterestBadgeInfo, getStatusBadgeInfo } from '../utils/formatters';

export default function CotizacionesList({ onNotify }) {
  const { authFetch, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [pendingVisitsToQuote, setPendingVisitsToQuote] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [systemFilter, setSystemFilter] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  const fetchPendingVisits = async () => {
    try {
      const res = await authFetch('/api/visits?status=realizada_pendiente_cotizar');
      if (res.ok) {
        const data = await res.json();
        setPendingVisitsToQuote(data.visits || []);
      }
    } catch (e) {
      console.warn('Error fetching pending visits to quote:', e);
    }
  };

  useEffect(() => {
    fetchPendingVisits();
  }, []);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (statusFilter !== 'all') query.append('status', statusFilter);
      if (systemFilter !== 'all') query.append('system_type', systemFilter);
      if (searchTerm) query.append('search', searchTerm);

      const res = await authFetch(`/api/quotes?${query.toString()}`);
      const data = await res.json();
      setQuotes(data.quotes || []);
    } catch (err) {
      console.error('Error fetching quotes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, [statusFilter, systemFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchQuotes();
  };

  const handleDelete = async (quoteId, code) => {
    if (!window.confirm(`¿Estás seguro de eliminar la cotización ${code}?`)) return;
    try {
      let res = await authFetch(`/api/quotes/${quoteId}`, { method: 'DELETE' });
      let data = await res.json();
      if (!res.ok) {
        if (data.requiresForce) {
          if (window.confirm(`${data.error}\n\n¿Deseas forzar la eliminación definitiva de esta cotización?`)) {
            res = await authFetch(`/api/quotes/${quoteId}?force=true`, { method: 'DELETE' });
            data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al eliminar cotización');
          } else {
            return;
          }
        } else {
          throw new Error(data.error || 'Error al eliminar la cotización');
        }
      }
      setQuotes(quotes.filter(q => q.id !== quoteId));
      if (onNotify) onNotify({ type: 'success', message: data.message || `Cotización ${code} eliminada con éxito.` });
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-[#2d8a58]" />
            Historial de Cotizaciones
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Revisa, filtra, edita y gestiona todas las propuestas solares emitidas &bull; Renova Energy
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span>{viewMode === 'cards' ? 'Ver como Tabla' : 'Ver como Tarjetas'}</span>
          </button>
          <button
            onClick={() => navigate('/cotizador')}
            className="px-4 py-2.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-md shadow-[#2d8a58]/25 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Cotización</span>
          </button>
        </div>
      </div>

      {/* Alert / Section: Technical Visits with Completed Survey Ready to Quote */}
      {pendingVisitsToQuote.length > 0 && (
        <div className="bg-gradient-to-r from-[#2d8a58] via-[#237348] to-[#2d8a58] text-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-[#2d8a58]/20 border-2 border-[#48bb78]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white text-[#2d8a58] flex items-center justify-center font-bold shrink-0 shadow-md">
                <ClipboardCheck className="w-6 h-6 text-[#2d8a58]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/30 text-white font-black text-[10px] uppercase tracking-wider">
                    Levantamientos Listos para Cotizar
                  </span>
                  <span className="text-xs font-bold text-white/90">
                    {pendingVisitsToQuote.length} {pendingVisitsToQuote.length === 1 ? 'visita realizada pendiente' : 'visitas realizadas pendientes'}
                  </span>
                </div>
                <h3 className="text-base font-black text-white mt-0.5">
                  Levantamientos técnicos completados listos para elaborar propuesta solar
                </h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingVisitsToQuote.map((v) => (
              <div key={v.id} className="p-3.5 rounded-2xl bg-white text-slate-800 shadow-sm flex items-center justify-between gap-3 border border-white/80">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-mono text-[10px] font-black text-[#1c5c3a] bg-[#2d8a58]/15 px-1.5 py-0.5 rounded">
                      {v.visit_code}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 truncate">{v.client_city || 'Sitio'}</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">{v.client_name}</p>
                  <p className="text-[11px] text-[#2d8a58] font-bold truncate">
                    {v.recommended_system_type ? getSystemTypeName(v.recommended_system_type) : 'Sistema Solar'} &bull; {v.available_area_m2 || 0} m²
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/cotizador?visitId=${v.id}&clientId=${v.client_id}`)}
                  className="px-3.5 py-2 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-black text-xs shadow-sm shrink-0 cursor-pointer flex items-center gap-1 transition-all"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Cotizar</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por código, cliente, teléfono o ciudad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2d8a58]"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Buscar
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-xs">
            <span className="font-semibold text-slate-500">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobada">Aprobada</option>
              <option value="desistida">Desistida</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="font-semibold text-slate-500">Sistema:</span>
            <select
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none"
            >
              <option value="all">Todos los sistemas</option>
              <option value="ongrid">On-Grid</option>
              <option value="hibrido">On-Grid Baterías</option>
              <option value="offgrid">Off-Grid</option>
              <option value="bombeo">Bombeo Solar</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>{viewMode === 'cards' ? 'Ver como Tabla' : 'Ver como Tarjetas'}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-amber-500 border-t-transparent mx-auto mb-2"></div>
            <p className="text-xs text-slate-400">Cargando cotizaciones...</p>
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron cotizaciones</p>
            <p className="text-xs text-slate-400 mt-1">Crea tu primera cotización con el botón de arriba</p>
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {quotes.map((q) => {
              const interestBadge = getInterestBadgeInfo(q.interest_score);
              const statusBadge = getStatusBadgeInfo(q.status);
              const isToday = q.followup_date === new Date().toISOString().split('T')[0];
              const isOverdue = q.followup_date < new Date().toISOString().split('T')[0] && q.status === 'pendiente';

              return (
                <div
                  key={q.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {q.quote_code}
                          </span>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 leading-snug truncate">
                          {q.client_name}
                        </h3>
                        <p className="text-[11px] text-slate-500 truncate">
                          {q.client_phone || 'Sin teléfono'} &bull; {q.client_city || 'Sitio'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                        <span className="text-sm font-black text-[#2d8a58] dark:text-[#48bb78]">
                          {formatCOP(q.total_price)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-[#2d8a58]/10 text-[#2d8a58] dark:text-[#48bb78] px-2 py-0.5 rounded-md text-[10px] font-bold">
                          {getSystemTypeName(q.system_type)}
                        </span>
                        <span className="font-semibold text-[11px]">
                          {formatKW(q.installed_power_kwp)} ({q.installed_panels} pan)
                        </span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        isOverdue ? 'bg-rose-100 text-rose-800' : isToday ? 'bg-amber-100 text-amber-800' : 'text-slate-500'
                      }`}>
                        Seguim: {formatDate(q.followup_date)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => navigate(`/cotizacion/${q.id}`)}
                      className="flex items-center justify-center gap-1 py-2 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white text-xs font-bold active:scale-95 transition-all shadow-xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver PDF</span>
                    </button>
                    <button
                      onClick={() => navigate(`/cotizador?editQuoteId=${q.id}`)}
                      className="flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#2d8a58]" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => navigate(`/seguimiento?quoteId=${q.id}`)}
                      className="flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>CRM</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Sistema</th>
                  <th className="py-3 px-4">Potencia</th>
                  <th className="py-3 px-4">Valor Total</th>
                  <th className="py-3 px-4 text-center">Interés</th>
                  <th className="py-3 px-4">Próx. Seguimiento</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((q) => {
                  const interestBadge = getInterestBadgeInfo(q.interest_score);
                  const statusBadge = getStatusBadgeInfo(q.status);
                  const isToday = q.followup_date === new Date().toISOString().split('T')[0];
                  const isOverdue = q.followup_date < new Date().toISOString().split('T')[0] && q.status === 'pendiente';

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {q.quote_code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{q.client_name}</div>
                        <div className="text-[11px] text-slate-400">{q.client_phone} &bull; {q.client_city}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {getSystemTypeName(q.system_type)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {formatKW(q.installed_power_kwp)} ({q.installed_panels} pan)
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        {formatCOP(q.total_price)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${interestBadge.color}`}>
                          {interestBadge.shortLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-semibold px-2 py-0.5 rounded-md ${
                          isOverdue ? 'bg-rose-100 text-rose-800' : isToday ? 'bg-amber-100 text-amber-800' : 'text-slate-600'
                        }`}>
                          {formatDate(q.followup_date)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/cotizacion/${q.id}`)}
                            title="Ver Propuesta / Imprimir"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-[#2d8a58] hover:bg-[#2d8a58]/10 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/cotizador?editQuoteId=${q.id}`)}
                            title="Editar Cotización"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-[#2d8a58] hover:bg-[#2d8a58]/10 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4 text-[#2d8a58]" />
                          </button>
                          <button
                            onClick={() => navigate(`/seguimiento?quoteId=${q.id}`)}
                            title="Seguimiento CRM"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(q.id, q.quote_code)}
                              title="Eliminar"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
