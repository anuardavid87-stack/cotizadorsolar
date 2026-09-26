import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileSignature, Plus, Search, Eye, Edit2, Trash2,
  Calendar, DollarSign, CheckCircle2, Clock, AlertCircle,
  FileSpreadsheet, User, MapPin, Zap, ArrowRight, X, AlertTriangle,
  SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCOP, getSystemTypeName } from '../utils/formatters';
import Modal from '../components/Modal';

export default function ContratosList({ onNotify }) {
  const { authFetch, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [contracts, setContracts] = useState([]);
  const [pendingQuotes, setPendingQuotes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  
  const initialTab = searchParams.get('tab') || searchParams.get('status') || 'all';
  const [statusFilter, setStatusFilter] = useState(initialTab);

  // Modal for creating new contract from quote
  const [isSelectQuoteModalOpen, setIsSelectQuoteModalOpen] = useState(false);
  const [wonQuotes, setWonQuotes] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all' && statusFilter !== 'pending') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await authFetch(`/api/contracts?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar contratos');
      const data = await res.json();
      setContracts(data.contracts || []);
      setStats(data.stats || null);
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingQuotes = async () => {
    try {
      const res = await authFetch('/api/contracts/pending-quotes');
      if (res.ok) {
        const data = await res.json();
        setPendingQuotes(data.pendingQuotes || []);
      }
    } catch (err) {
      console.error('Error fetching pending quotes:', err);
    }
  };

  useEffect(() => {
    fetchContracts();
    fetchPendingQuotes();
  }, [statusFilter]);

  // Sync tab from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab') || searchParams.get('status');
    if (tabParam && tabParam !== statusFilter) {
      setStatusFilter(tabParam);
    }
  }, [searchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchContracts();
  };

  const handleDelete = async (contractId, code) => {
    if (!window.confirm(`¿Estás seguro de eliminar el contrato ${code}? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await authFetch(`/api/contracts/${contractId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      setContracts(prev => prev.filter(c => c.id !== contractId));
      if (onNotify) onNotify({ type: 'success', message: `Contrato ${code} eliminado.` });
      fetchContracts();
      fetchPendingQuotes();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  // Open modal to select won quote
  const handleOpenNewContractModal = async () => {
    setIsSelectQuoteModalOpen(true);
    setLoadingQuotes(true);
    try {
      const res = await authFetch('/api/quotes?status=all');
      if (res.ok) {
        const data = await res.json();
        setWonQuotes(data.quotes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuotes(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'firmado':
        return { label: 'Firmado', color: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
      case 'en_ejecucion':
        return { label: 'En Construcción', color: 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
      case 'finalizado':
        return { label: 'Finalizado', color: 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800' };
      case 'cancelado':
        return { label: 'Cancelado', color: 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800' };
      default:
        return { label: 'Borrador', color: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
    }
  };

  const pendingCount = stats?.pending_count !== undefined ? stats.pending_count : pendingQuotes.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <FileSignature className="w-7 h-7 text-[#2d8a58]" />
            Módulo de Contratos de Construcción Solar
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Formalización legal, formas de pago personalizadas, tabla de amortización (1 a 60 cuotas) e impresión oficial &bull; Renova Energy S.A.S.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span>{viewMode === 'cards' ? 'Ver como Tabla' : 'Ver como Tarjetas'}</span>
          </button>
          <button
            onClick={handleOpenNewContractModal}
            className="px-4 py-2.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-md shadow-[#2d8a58]/25 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Contrato</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 1: Por Contratar */}
        <div
          onClick={() => {
            setStatusFilter('pending');
            setSearchParams({ tab: 'pending' });
          }}
          className={`p-4 rounded-2xl border shadow-xs transition-all cursor-pointer group ${
            pendingCount > 0
              ? 'bg-amber-500/10 border-amber-400 dark:border-amber-700 hover:bg-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-amber-700 dark:group-hover:text-amber-300">
              Por Contratar
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              pendingCount > 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${pendingCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
              {pendingCount}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              {pendingCount === 1 ? 'proyecto ganado' : 'proyectos ganados'}
            </span>
          </div>
        </div>

        {/* Card 2: Total Contratos */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Contratos</span>
            <div className="w-8 h-8 rounded-xl bg-[#2d8a58]/10 text-[#2d8a58] flex items-center justify-center">
              <FileSignature className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800 dark:text-white">{stats?.total_count || 0}</span>
            <span className="text-[11px] font-semibold text-slate-400">emitidos</span>
          </div>
        </div>

        {/* Card 3: Firmados / En Obra */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Firmados / En Obra</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600">
              {(stats?.signed_count || 0) + (stats?.in_progress_count || 0)}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">activos</span>
          </div>
        </div>

        {/* Card 4: Valor Contratado */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Valor Contratado</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg font-black text-emerald-600">
              {formatCOP(stats?.total_value || 0)}
            </span>
          </div>
        </div>

        {/* Card 5: Saldo Financiado */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Saldo Financiado</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg font-black text-purple-600">
              {formatCOP(stats?.total_financed || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Alert Banner if won quotes are pending a contract (Soft Pastel) */}
      {pendingCount > 0 && statusFilter !== 'pending' && (
        <div className="p-4 rounded-2xl bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-200/60 dark:border-yellow-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 flex items-center justify-center font-bold shrink-0 border border-yellow-200/60">
              <AlertTriangle className="w-4 h-4 text-yellow-700 dark:text-yellow-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Tienes {pendingCount} {pendingCount === 1 ? 'proyecto ganado' : 'proyectos ganados'} en espera de elaborar contrato.
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Formaliza las condiciones y el cronograma de pago para iniciar la obra.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setStatusFilter('pending');
              setSearchParams({ tab: 'pending' });
            }}
            className="px-3.5 py-2 rounded-xl bg-yellow-100 hover:bg-yellow-200/80 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200 border border-yellow-200/80 font-bold text-xs shadow-xs transition-colors self-start sm:self-auto cursor-pointer flex items-center gap-1.5"
          >
            <span>Ver Proyectos Pendientes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'Todos los Contratos' },
            { id: 'pending', label: `🔔 Por Contratar (${pendingCount})`, isAlert: pendingCount > 0 },
            { id: 'borrador', label: '📝 Borradores' },
            { id: 'firmado', label: '✍️ Firmados' },
            { id: 'en_ejecucion', label: '⚡ En Construcción' },
            { id: 'finalizado', label: '✅ Finalizados' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setSearchParams({ tab: tab.id });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? tab.isAlert
                    ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                    : 'bg-[#2d8a58] text-white shadow-xs'
                  : tab.isAlert
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search & View Toggle */}
        {statusFilter !== 'pending' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>{viewMode === 'cards' ? 'Ver como Tabla' : 'Ver como Tarjetas'}</span>
            </button>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por cliente o contrato..."
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2d8a58] w-64"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Buscar
              </button>
            </form>
          </div>
        )}
      </div>

      {/* CONDITIONAL CONTENT: 1) Pending Won Quotes View OR 2) Contracts Table */}
      {statusFilter === 'pending' ? (
        /* PENDING WON QUOTES TABLE */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Proyectos Ganados en Espera de Formalizar Contrato ({pendingQuotes.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Genera el contrato para activar la obra y el cronograma financiero
            </span>
          </div>

          {pendingQuotes.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">¡Todo al día!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No hay proyectos ganados pendientes por contratar. Cuando ganes un proyecto en el CRM, aparecerá aquí inmediatamente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Cotización</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Sistema & Potencia</th>
                    <th className="py-3 px-4">Valor Proyecto</th>
                    <th className="py-3 px-4">Asesor</th>
                    <th className="py-3 px-4 text-right">Acción Requerida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendingQuotes.map((q) => (
                    <tr key={q.quote_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white">
                        <span className="text-[#2d8a58]">{q.quote_code}</span>
                        <span className="text-[10px] text-slate-400 font-sans block">{q.updated_at ? q.updated_at.split('T')[0] : 'Reciente'}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 dark:text-white">{q.client_name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>{q.client_doc_type}: {q.client_doc_number || 'N/A'}</span>
                          <span>&bull;</span>
                          <span>{q.client_city || 'Sitio'}</span>
                          <span>&bull;</span>
                          <span>{q.client_phone}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                          {getSystemTypeName(q.system_type)}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold">
                          {q.installed_power_kwp ? `${q.installed_power_kwp} kWp` : ''} ({q.installed_panels || 0} paneles)
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-black text-slate-900 dark:text-white text-xs block">
                          {formatCOP(q.total_price)}
                        </span>
                        <span className="text-[10px] text-amber-600 font-semibold">
                          Proyecto Ganado
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        {q.advisor_name || 'Comercial'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => navigate(`/contrato/nuevo/${q.quote_id}`)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1.5 ml-auto cursor-pointer transition-all"
                        >
                          <FileSignature className="w-4 h-4" />
                          <span>Elaborar Contrato</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CONTRACTS TABLE */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#2d8a58] border-t-transparent mx-auto"></div>
              <p className="text-xs text-slate-400 mt-3">Cargando contratos...</p>
            </div>
          ) : contracts.length === 0 ? (
            <div className="p-12 text-center">
              <FileSignature className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay contratos registrados en esta pestaña</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {pendingCount > 0
                  ? `Tienes ${pendingCount} proyecto(s) ganado(s) esperando contrato.`
                  : 'Crea tu primer contrato seleccionando una cotización ganada desde el CRM o con el botón superior.'}
              </p>
              {pendingCount > 0 ? (
                <button
                  onClick={() => {
                    setStatusFilter('pending');
                    setSearchParams({ tab: 'pending' });
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSignature className="w-4 h-4" />
                  <span>Ver Proyectos por Contratar ({pendingCount})</span>
                </button>
              ) : (
                <button
                  onClick={handleOpenNewContractModal}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#2d8a58] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Contrato</span>
                </button>
              )}
            </div>
          ) : viewMode === 'cards' ? (
            /* CARDS GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {contracts.map((ct) => {
                const statusBadge = getStatusBadge(ct.status);
                return (
                  <div
                    key={ct.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="font-mono font-black text-xs text-[#2d8a58] block">
                            {ct.contract_code}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Fecha: {ct.contract_date}
                          </span>
                        </div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-slate-800 dark:text-white mt-1 leading-snug">
                        {ct.client_name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {ct.client_city || 'Sitio'} &bull; {ct.client_phone || 'Sin tel'}
                      </p>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl my-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Valor Total:</span>
                          <span className="font-black text-slate-900 dark:text-white text-sm">
                            {formatCOP(ct.total_contract_value)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Anticipo:</span>
                          <span className="font-semibold text-emerald-600">
                            {formatCOP(ct.down_payment_amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Financiación:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {ct.installments_count} cuota{ct.installments_count > 1 ? 's' : ''} ({ct.has_interest ? `${(ct.monthly_interest_rate * 100).toFixed(1)}%` : '0%'})
                          </span>
                        </div>
                        {ct.quote_code && (
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            <span className="text-slate-500">Cotización:</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">
                              {ct.quote_code} ({ct.quote_power_kwp || 0} kWp)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => navigate(`/contrato/${ct.id}`)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Contrato</span>
                      </button>
                      <button
                        onClick={() => navigate(`/contrato/editar/${ct.id}`)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Editar Condiciones"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(ct.id, ct.contract_code)}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Eliminar Contrato"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* CONTRACTS TABLE */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Contrato</th>
                    <th className="py-3 px-4">Cliente & Predio</th>
                    <th className="py-3 px-4">Cotización & Potencia</th>
                    <th className="py-3 px-4">Valor Total</th>
                    <th className="py-3 px-4">Financiación</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {contracts.map((ct) => {
                    const statusBadge = getStatusBadge(ct.status);
                    return (
                      <tr key={ct.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="text-[#2d8a58]">{ct.contract_code}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-sans block">{ct.contract_date}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 dark:text-white">{ct.client_name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <span>{ct.client_doc_type}: {ct.client_doc_number || 'N/A'}</span>
                            <span>&bull;</span>
                            <span>{ct.client_city || 'Sitio'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                            {ct.quote_code || 'Sin cotización'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {ct.quote_power_kwp ? `${ct.quote_power_kwp} kWp` : ct.quote_system_type || 'Solar'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-black text-slate-900 dark:text-white text-xs block">
                            {formatCOP(ct.total_contract_value)}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            Anticipo: {formatCOP(ct.down_payment_amount)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {ct.installments_count} cuota{ct.installments_count > 1 ? 's' : ''}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {ct.has_interest ? `Interés: ${(ct.monthly_interest_rate * 100).toFixed(1)}% mes` : 'Sin interés (0%)'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => navigate(`/contrato/${ct.id}`)}
                              title="Ver Contrato Formal / Imprimir PDF"
                              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-[#2d8a58] hover:bg-[#2d8a58]/10 transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/contrato/editar/${ct.id}`)}
                              title="Editar Condiciones de Pago"
                              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-[#2d8a58] hover:bg-[#2d8a58]/10 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(ct.id, ct.contract_code)}
                                title="Eliminar Contrato"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
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
      )}

      {/* Modal to Select Quote for New Contract */}
      {isSelectQuoteModalOpen && (
        <Modal
          isOpen={isSelectQuoteModalOpen}
          onClose={() => setIsSelectQuoteModalOpen(false)}
          title="Seleccionar Cotización para Nuevo Contrato"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Selecciona el proyecto o cotización del cliente para extraer automáticamente los equipos y datos del predio:
            </p>

            {loadingQuotes ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#2d8a58] border-t-transparent mx-auto"></div>
                <p className="text-xs text-slate-400 mt-2">Cargando cotizaciones...</p>
              </div>
            ) : wonQuotes.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No hay cotizaciones registradas. Crea una cotización primero.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {wonQuotes.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => {
                      setIsSelectQuoteModalOpen(false);
                      navigate(`/contrato/nuevo/${q.id}`);
                    }}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-[#2d8a58]">{q.quote_code}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          q.status === 'aprobada' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {q.status === 'aprobada' ? 'Ganado' : q.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white mt-0.5">{q.client_name}</p>
                      <p className="text-[11px] text-slate-400">{q.client_city} &bull; {q.installed_power_kwp || 0} kWp</p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900 dark:text-white block">{formatCOP(q.total_price)}</span>
                      <span className="text-[10px] text-[#2d8a58] font-bold inline-flex items-center gap-1 mt-1">
                        <span>Seleccionar</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
