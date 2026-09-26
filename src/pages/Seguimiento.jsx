import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Target,
  CalendarClock,
  PhoneCall,
  Flame,
  Calendar,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Archive,
  Search,
  Plus,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  UserX,
  RotateCcw,
  FileSignature
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCOP, formatDate, formatKW, getSystemTypeName, getInterestBadgeInfo } from '../utils/formatters';
import Modal from '../components/Modal';

export default function Seguimiento({ onNotify, onStatsUpdate }) {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active filter: 'today', 'overdue', 'hot', 'upcoming', 'all_pending', 'desist', 'won'
  const currentFilter = searchParams.get('filter') || 'all_pending';
  const paramQuoteId = searchParams.get('quoteId');

  const [followups, setFollowups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [interactionType, setInteractionType] = useState('llamada');
  const [score, setScore] = useState(8);
  const [comments, setComments] = useState('');
  const [actionTaken, setActionTaken] = useState('reprogramar'); // reprogramar, desiste, ganado
  const [nextDate, setNextDate] = useState('');
  const [desistReason, setDesistReason] = useState('Falta de presupuesto');
  const [saving, setSaving] = useState(false);

  // Fetch followups list
  const fetchFollowups = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      query.append('filter', currentFilter);
      if (searchTerm) query.append('search', searchTerm);

      const res = await authFetch(`/api/followups?${query.toString()}`);
      const data = await res.json();
      setFollowups(data.followups || []);
      setStats(data.stats || null);

      if (onStatsUpdate && data.stats) {
        onStatsUpdate({
          today_count: data.stats.today_count,
          overdue_count: data.stats.overdue_count
        });
      }

      // If quoteId was given in URL, auto-open modal
      if (paramQuoteId && data.followups) {
        const found = data.followups.find(f => f.quote_id.toString() === paramQuoteId.toString());
        if (found) {
          openManageModal(found);
        }
      }
    } catch (err) {
      console.error('Error loading followups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowups();
  }, [currentFilter]);

  const handleFilterChange = (filterName) => {
    setSearchParams({ filter: filterName });
  };

  const openManageModal = (item) => {
    setSelectedItem(item);
    setScore(item.interest_score || 7);
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setNextDate(item.followup_date || d.toISOString().split('T')[0]);
    setComments('');
    setActionTaken('reprogramar');
    setIsModalOpen(true);
  };

  const openReactivateModal = (item) => {
    setSelectedItem(item);
    setScore(8);
    const d = new Date();
    d.setDate(d.getDate() + 2);
    setNextDate(d.toISOString().split('T')[0]);
    setComments('Cliente reactivado: se retoma el contacto comercial para reevaluar la propuesta solar.');
    setActionTaken('reprogramar');
    setIsModalOpen(true);
  };

  const handleSaveFollowup = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!comments.trim()) {
      if (onNotify) onNotify({ type: 'warning', message: 'Por favor escribe el comentario del cliente.' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        quote_id: selectedItem.quote_id,
        client_id: selectedItem.client_id,
        interaction_type: interactionType,
        interest_score: score,
        comments: comments.trim(),
        action_taken: actionTaken,
        next_followup_date: actionTaken === 'reprogramar' ? nextDate : null,
        desist_reason: actionTaken === 'desiste' ? desistReason : null
      };

      const res = await authFetch('/api/followups', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar seguimiento');

      setIsModalOpen(false);
      fetchFollowups();

      if (actionTaken === 'ganado') {
        if (onNotify) onNotify({ type: 'success', message: '¡Felicitaciones! Proyecto Ganado. Pasando a elaborar el contrato de construcción...' });
        navigate(`/contrato/nuevo/${selectedQuote.quote_id}`);
      } else {
        if (onNotify) onNotify({ type: 'success', message: 'Seguimiento registrado con éxito.' });
      }
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const openWhatsApp = (phone, name, quoteCode, total) => {
    if (!phone) {
      alert('Este cliente no tiene teléfono registrado.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const text = encodeURIComponent(
      `Hola ${name}, te saludamos de Renova Energy. Estamos atentos para resolver cualquier duda sobre tu cotización ${quoteCode} por ${formatCOP(total)}. ¿Cómo ves el proyecto para iniciar esta semana?`
    );
    window.open(`https://wa.me/${phoneWithCode}?text=${text}`, '_blank');
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Target className="w-7 h-7 text-amber-500" />
            Módulo de Seguimiento de Clientes (CRM Didáctico)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestiona de forma amigable las llamadas, califica el interés (1-10) y programa nuevos contactos o archiva desistimientos
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{viewMode === 'cards' ? 'Ver como Tabla' : 'Ver como Tarjetas'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs / Semáforo de Gestión */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        {[
          { id: 'all_pending', label: 'Todos los Pendientes', count: stats?.total_pending, color: 'text-slate-700 hover:bg-slate-100', activeColor: 'bg-slate-900 text-white' },
          { id: 'today', label: '🔔 Pendientes Hoy', count: stats?.today_count, color: 'text-amber-800 hover:bg-amber-50', activeColor: 'bg-amber-500 text-slate-950 font-black' },
          { id: 'overdue', label: '⚠️ Atrasados / Vencidos', count: stats?.overdue_count, color: 'text-rose-700 hover:bg-rose-50', activeColor: 'bg-rose-600 text-white font-bold' },
          { id: 'hot', label: '🔥 Clientes Probables (8-10)', count: stats?.hot_count, color: 'text-red-700 hover:bg-red-50', activeColor: 'bg-red-600 text-white font-bold' },
          { id: 'upcoming', label: '⏳ Próximos 7 días', count: stats?.upcoming_count, color: 'text-emerald-700 hover:bg-emerald-50', activeColor: 'bg-emerald-600 text-white font-bold' },
          { id: 'won', label: '🏆 Ganados', count: stats?.won_count, color: 'text-emerald-800 hover:bg-emerald-50', activeColor: 'bg-emerald-700 text-white font-bold' },
          { id: 'desist', label: '📁 Clientes Desistidos (Histórico)', count: stats?.desist_count, color: 'text-slate-600 hover:bg-slate-100', activeColor: 'bg-slate-800 text-white font-bold' },
        ].map((tab) => {
          const isActive = currentFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleFilterChange(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive ? tab.activeColor : tab.color
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Informative banner for Desistidos */}
      {currentFilter === 'desist' && (
        <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Histórico de Clientes Desistidos</p>
              <p className="text-slate-600 text-xs">
                Consulta los prospectos que declinaron la propuesta y las razones de desistimiento. Puedes reabrir la oportunidad en cualquier momento pulsando <strong>"Reactivar Seguimiento"</strong>.
              </p>
            </div>
          </div>
          <span className="font-mono font-bold bg-white border border-slate-300 px-3 py-1 rounded-xl text-slate-700 text-xs shrink-0 self-start sm:self-auto">
            {stats?.desist_count || 0} registrados
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent mx-auto mb-3"></div>
          <p className="text-xs text-slate-400">Cargando seguimientos...</p>
        </div>
      ) : followups.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
          <h3 className="text-base font-bold text-slate-800">No hay seguimientos en esta categoría</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            ¡Excelente trabajo! Puedes consultar otras pestañas o crear nuevas cotizaciones para continuar alimentando tu embudo de ventas.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Didactic Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {followups.map((item) => {
            const badge = getInterestBadgeInfo(item.interest_score);
            const isToday = item.followup_date === todayStr;
            const isOverdue = item.followup_date < todayStr && item.quote_status === 'pendiente';

            return (
              <div
                key={item.quote_id}
                className={`bg-white rounded-3xl p-6 border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-lg ${
                  isOverdue ? 'border-rose-300 ring-1 ring-rose-200' : isToday ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Top Header Card */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-slate-400 block">
                        {item.quote_code} &bull; {getSystemTypeName(item.system_type)}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">
                        {item.client_name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {item.client_phone || 'Sin tel'} &bull; {item.client_city || 'Sin ciudad'}
                      </p>
                    </div>

                    {/* Interest Score Badge with Heat indication */}
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border shadow-xs ${badge.color}`}>
                        {badge.shortLabel}
                      </span>
                    </div>
                  </div>

                  {/* Project Specs & Price Pill */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between my-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Potencia</span>
                      <span className="font-bold text-slate-800">{formatKW(item.installed_power_kwp)} ({item.installed_panels} pan)</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Presupuesto</span>
                      <span className="font-black text-slate-900">{formatCOP(item.total_price)}</span>
                    </div>
                  </div>

                  {/* Date Status Banner */}
                  <div className="mb-3">
                    {item.quote_status === 'desistida' ? (
                      <div className="p-3 rounded-2xl bg-slate-100 text-slate-700 text-xs border border-slate-200 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <UserX className="w-4 h-4 text-slate-500" />
                          <span>Cliente Desistido / Histórico</span>
                        </div>
                        {item.desist_reason && (
                          <p className="text-[11px] text-slate-600">
                            Motivo: <strong className="text-rose-700 font-bold">{item.desist_reason}</strong>
                          </p>
                        )}
                      </div>
                    ) : item.quote_status === 'aprobada' ? (
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-1.5 border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>¡Proyecto Ganado / Cerrado!</span>
                      </div>
                    ) : isOverdue ? (
                      <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-bold flex items-center gap-1.5 border border-rose-200 animate-pulse">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Contacto Vencido: {formatDate(item.followup_date)}</span>
                      </div>
                    ) : isToday ? (
                      <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold flex items-center gap-1.5 border border-amber-300">
                        <CalendarClock className="w-4 h-4 text-amber-600" />
                        <span>¡Contactar Hoy! ({formatDate(item.followup_date)})</span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 text-xs font-medium flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>Próximo contacto: {formatDate(item.followup_date)}</span>
                      </div>
                    )}
                  </div>

                  {/* Last Log Comment */}
                  <div className="mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Última Nota / Comentario del Cliente:
                    </span>
                    <p className="text-xs text-slate-600 italic line-clamp-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      "{item.last_comment || 'Cotización emitida recientemente. Sin comentarios aún.'}"
                    </p>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openWhatsApp(item.client_phone, item.client_name, item.quote_code, item.total_price)}
                      title="Enviar WhatsApp"
                      className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => navigate(`/cotizacion/${item.quote_id}`)}
                      title="Ver Propuesta"
                      className="p-2 rounded-xl text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  {item.quote_status === 'desistida' ? (
                    <button
                      onClick={() => openReactivateModal(item)}
                      className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reactivar Seguimiento</span>
                    </button>
                  ) : item.quote_status === 'aprobada' ? (
                    <div className="flex-1 flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/contrato/nuevo/${item.quote_id}`)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shadow-[#2d8a58]/25"
                      >
                        <FileSignature className="w-3.5 h-3.5" />
                        <span>Contrato</span>
                      </button>
                      <button
                        onClick={() => openManageModal(item)}
                        className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                        title="Registrar nota / gestión"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openManageModal(item)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Registrar Gestión</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Cotización</th>
                  <th className="py-3.5 px-4">Valor Total</th>
                  <th className="py-3.5 px-4 text-center">Interés</th>
                  <th className="py-3.5 px-4">Fecha Contacto</th>
                  <th className="py-3.5 px-4">Último Comentario</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {followups.map((item) => {
                  const badge = getInterestBadgeInfo(item.interest_score);
                  const isToday = item.followup_date === todayStr;
                  const isOverdue = item.followup_date < todayStr && item.quote_status === 'pendiente';

                  return (
                    <tr key={item.quote_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{item.client_name}</div>
                        <div className="text-[11px] text-slate-400">{item.client_phone}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-700">{item.quote_code}</span>
                        <div className="text-[11px] text-slate-400">{getSystemTypeName(item.system_type)}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {formatCOP(item.total_price)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.color}`}>
                          {badge.shortLabel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.quote_status === 'desistida' ? (
                          <span className="font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 block">
                            Desistió: <span className="text-rose-700">{item.desist_reason || 'Sin motivo'}</span>
                          </span>
                        ) : (
                          <span className={`font-bold px-2 py-0.5 rounded-md ${
                            isOverdue ? 'bg-rose-100 text-rose-800' : isToday ? 'bg-amber-100 text-amber-800' : 'text-slate-600'
                          }`}>
                            {formatDate(item.followup_date)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 italic">
                        {item.last_comment || 'Sin comentarios registrados'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openWhatsApp(item.client_phone, item.client_name, item.quote_code, item.total_price)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          {item.quote_status === 'desistida' ? (
                            <button
                              onClick={() => openReactivateModal(item)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reactivar</span>
                            </button>
                          ) : item.quote_status === 'aprobada' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => navigate(`/contrato/nuevo/${item.quote_id}`)}
                                className="px-2.5 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                                title="Elaborar / Ver Contrato"
                              >
                                <FileSignature className="w-3.5 h-3.5" />
                                <span>Contrato</span>
                              </button>
                              <button
                                onClick={() => openManageModal(item)}
                                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                                title="Gestionar seguimiento"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openManageModal(item)}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                            >
                              Gestionar
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
        </div>
      )}

      {/* Modal: Friendly Followup Action */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedItem ? `Gestión de Seguimiento: ${selectedItem.client_name}` : 'Gestión de Seguimiento'}
        maxWidth="max-w-xl"
      >
        {selectedItem && (
          <form onSubmit={handleSaveFollowup} className="space-y-4">
            {/* Quick summary header */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-mono font-bold text-slate-500">{selectedItem.quote_code}</span>
                <p className="font-bold text-slate-800">{getSystemTypeName(selectedItem.system_type)} - {formatKW(selectedItem.installed_power_kwp)}</p>
              </div>
              <div className="text-right">
                <span className="font-black text-slate-900 text-sm">{formatCOP(selectedItem.total_price)}</span>
                <p className="text-slate-500">Tel: {selectedItem.client_phone}</p>
              </div>
            </div>

            {/* Interaction Channel */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ¿Por qué medio contactaste al cliente?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'llamada', label: '📞 Llamada' },
                  { id: 'whatsapp', label: '💬 WhatsApp' },
                  { id: 'visita', label: '🏠 Visita' },
                  { id: 'reunion', label: '🤝 Reunión' }
                ].map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setInteractionType(ch.id)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      interactionType === ch.id
                        ? 'border-amber-500 bg-amber-500/10 text-amber-800 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating 1 to 10 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Califica el interés del cliente (Escala del 1 al 10):</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                  score >= 8 ? 'bg-red-100 text-red-700 border-red-200' :
                  score >= 5 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                  'bg-blue-100 text-blue-800 border-blue-200'
                }`}>
                  {score} / 10 &bull; {score >= 8 ? '🔥 Probable (Alto interés)' : score >= 5 ? '☀️ Tibio (Interés medio)' : '❄️ Frío (Bajo interés)'}
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={score}
                onChange={(e) => setScore(parseInt(e.target.value))}
                className="w-full accent-amber-500 h-2.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-1 mt-1">
                <span>1 (Frío / Poco interés)</span>
                <span>5 (Evaluando propuesta)</span>
                <span>10 (Listo para firmar)</span>
              </div>
            </div>

            {/* Comments */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Comentarios del Cliente / Resumen de lo conversado <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="3"
                required
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Ej. El cliente indicó que le gustó la cotización con inversores Huawei, pero está esperando la respuesta de aprobación del crédito con Bancolombia..."
                className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* Big Action Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Resultado de esta gestión:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActionTaken('reprogramar')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                    actionTaken === 'reprogramar'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-900 ring-2 ring-amber-400/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="w-5 h-5 text-amber-600" />
                  <span>Programar Nueva Fecha</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionTaken('ganado')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                    actionTaken === 'ganado'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 ring-2 ring-emerald-400/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>¡Proyecto Ganado!</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActionTaken('desiste')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                    actionTaken === 'desiste'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-900 ring-2 ring-rose-400/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <UserX className="w-5 h-5 text-rose-600" />
                  <span>Cliente Desiste</span>
                </button>
              </div>
            </div>

            {/* Sub-inputs based on action */}
            {actionTaken === 'reprogramar' && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center gap-1">
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                  Selecciona la Nueva Fecha para volver a contactar al cliente:
                </label>
                <input
                  type="date"
                  required
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            {actionTaken === 'desiste' && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                <label className="block text-xs font-bold text-rose-900 mb-1">
                  Motivo de desistimiento (El cliente se archivará y ya NO aparecerá en pendientes):
                </label>
                <select
                  value={desistReason}
                  onChange={(e) => setDesistReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-rose-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Falta de presupuesto">Falta de presupuesto / Sin capacidad financiera</option>
                  <option value="Escogió otra empresa de energía solar">Compró a otra empresa de la competencia</option>
                  <option value="Aplazó el proyecto indefinidamente">Decidió aplazar el proyecto para el próximo año</option>
                  <option value="Problemas estructurales en el techo">El techo no resiste o no tiene espacio</option>
                  <option value="No responde llamadas ni mensajes">No volvió a contestar llamadas ni WhatsApp</option>
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-xl shadow cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar y Actualizar Estado'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
