import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileSpreadsheet,
  Calendar,
  MessageSquare,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  ClipboardCheck,
  SlidersHorizontal,
  LayoutGrid,
  Table
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCOP, formatDate, formatKW, getSystemTypeName, getInterestBadgeInfo } from '../utils/formatters';
import Modal from '../components/Modal';

export default function Clientes({ onNotify }) {
  const { authFetch, isAdmin, isTechnician, isComercial, canQuote, canViewVisits, canViewCRM, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('clientes_view_mode_v2') || 'table';
  });

  useEffect(() => {
    localStorage.setItem('clientes_view_mode_v2', viewMode);
  }, [viewMode]);

  // Modal: Add / Edit Client
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    doc_type: 'CC',
    doc_number: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    department: '',
    operator: 'Afinia',
    client_type: 'Residencial',
    voltage_level: 'Monofásico 120/240V',
    stratum: '4',
    notes: '',
    schedule_visit: false,
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: '09:00 AM',
    visit_user_id: '',
    visit_notes: '',
    client_consumption_kwh: ''
  });

  // Modal: View Client 360° Profile
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (typeFilter !== 'all') query.append('type', typeFilter);
      if (searchTerm) query.append('search', searchTerm);

      const res = await authFetch(`/api/clients?${query.toString()}`);
      const data = await res.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const res = await authFetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setTechnicians(data.users || []);
      }
    } catch (e) {
      console.warn('Error fetching technicians in Clientes:', e);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [typeFilter]);

  useEffect(() => {
    fetchTechnicians();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openNewModal();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchClients();
  };

  const openNewModal = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      doc_type: 'CC',
      doc_number: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      department: '',
      operator: 'Afinia',
      client_type: 'Residencial',
      voltage_level: 'Monofásico 120/240V',
      stratum: '4',
      notes: '',
      schedule_visit: isTechnician || isComercial ? true : false,
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: '09:00 AM',
      visit_user_id: isTechnician && user?.id ? user.id.toString() : (technicians[0] ? technicians[0].id.toString() : ''),
      visit_notes: isTechnician || isComercial ? 'Visita técnica de campo programada al registrar cliente' : '',
      client_consumption_kwh: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (c) => {
    setEditingClient(c);
    setFormData({
      name: c.name || '',
      doc_type: c.doc_type || 'CC',
      doc_number: c.doc_number || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      city: c.city || '',
      department: c.department || '',
      operator: c.operator || 'Afinia',
      client_type: c.client_type || 'Residencial',
      voltage_level: c.voltage_level || 'Monofásico 120/240V',
      stratum: c.stratum || '4',
      notes: c.notes || ''
    });
    setIsModalOpen(true);
  };

  const openProfileModal = async (clientId) => {
    try {
      setLoadingProfile(true);
      setProfileData(null);
      setIsProfileOpen(true);
      const res = await authFetch(`/api/clients/${clientId}`);
      const data = await res.json();
      if (!res.ok || !data.client) {
        throw new Error(data.error || 'Error al cargar perfil del cliente');
      }
      setProfileData(data);
    } catch (err) {
      console.error('Error loading client profile:', err);
      if (onNotify) onNotify({ type: 'error', message: err.message || 'Error al cargar perfil del cliente' });
      setProfileData(null);
      setIsProfileOpen(false);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients';
      const method = editingClient ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar cliente');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: data.message || (editingClient ? 'Cliente actualizado exitosamente' : 'Cliente registrado exitosamente')
        });
      }
      setIsModalOpen(false);
      fetchClients();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  const handleDeleteClient = async (clientId, name) => {
    if (!window.confirm(`¿Seguro que deseas eliminar al cliente "${name}"?`)) return;
    try {
      let res = await authFetch(`/api/clients/${clientId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.requiresForce) {
          if (window.confirm(`${data.error}\n\n¿Estás completamente seguro de proceder con el borrado definitivo?`)) {
            res = await authFetch(`/api/clients/${clientId}?force=true`, { method: 'DELETE' });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || 'Error al eliminar cliente');
            }
          } else {
            return;
          }
        } else {
          throw new Error(data.error || 'Error al eliminar cliente');
        }
      }
      setClients(clients.filter(c => c.id !== clientId));
      if (onNotify) onNotify({ type: 'success', message: `Cliente ${name} eliminado con éxito.` });
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  const openWhatsApp = (phone, name) => {
    if (!phone) {
      alert('Sin teléfono registrado');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const text = encodeURIComponent(`Hola ${name}, te saludamos de Solar Energy. ¿Cómo estás?`);
    window.open(`https://wa.me/${phoneWithCode}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-amber-500" />
            Módulo de Clientes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Directorio completo, historial comercial y ficha de predios solares
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Segmented control: Tarjetas | Tabla */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tarjetas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tabla</span>
            </button>
          </div>

          <button
            onClick={openNewModal}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isTechnician || isComercial ? '+ Nuevo Cliente & Visita' : '+ Nuevo Cliente'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por nombre, cédula/NIT, teléfono o ciudad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            Buscar
          </button>
        </form>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Tipo:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none"
          >
            <option value="all">Todos los clientes</option>
            <option value="Residencial">Residencial</option>
            <option value="Comercial">Comercial</option>
            <option value="Industrial">Industrial</option>
            <option value="Rural/Finca">Rural / Finca</option>
          </select>

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

      {/* Clients Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-amber-500 border-t-transparent mx-auto mb-2"></div>
          <p className="text-xs text-slate-400">Cargando clientes...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-sm font-bold text-slate-700">No se encontraron clientes</h3>
          <p className="text-xs text-slate-400 mt-1">Registra nuevos clientes para asociarles cotizaciones solares.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.map((c) => {
            return (
              <div
                key={c.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {c.client_type || 'Residencial'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {c.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {c.doc_type} {c.doc_number || 'Sin documento'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {c.quote_count || 0} cotiz.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 my-3">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{c.phone || 'Sin teléfono'}</span>
                    </div>
                    {c.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{c.city ? `${c.city}, ${c.department || ''}` : 'Ubicación no registrada'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Operador: <strong className="text-slate-800">{c.operator || 'Afinia'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        title={`Llamar a ${c.name}`}
                        className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => openWhatsApp(c.phone, c.name)}
                      title="WhatsApp"
                      className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(c)}
                      title="Editar"
                      className="p-2 rounded-xl text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteClient(c.id, c.name)}
                        title="Eliminar"
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {canViewVisits && (
                      <button
                        onClick={() => navigate(`/visitas?action=new&clientId=${c.id}`)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                        title="Agendar visita técnica a este cliente"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>+ Visita</span>
                      </button>
                    )}
                    {canQuote && (
                      <button
                        onClick={() => navigate(`/cotizador?clientId=${c.id}`)}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                      >
                        Cotizar
                      </button>
                    )}
                    <button
                      onClick={() => openProfileModal(c.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Ficha
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View for Clientes */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Documento</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Contacto</th>
                  <th className="py-3.5 px-4">Ubicación</th>
                  <th className="py-3.5 px-4">Operador / Tensión</th>
                  <th className="py-3.5 px-4 text-center">Cotizaciones</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => {
                  const phoneClean = (c.phone || '').replace(/\D/g, '');
                  const waPhone = phoneClean.startsWith('57') ? phoneClean : `57${phoneClean}`;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{c.name}</div>
                        {c.notes && (
                          <div className="text-[11px] text-slate-400 italic truncate max-w-[200px]" title={c.notes}>
                            {c.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-slate-700 font-medium">
                          {c.doc_type} {c.doc_number || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {c.client_type || 'Residencial'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">{c.phone || 'Sin tel'}</span>
                          {c.phone && (
                            <a
                              href={`https://wa.me/${waPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700"
                              title="Abrir WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5 inline" />
                            </a>
                          )}
                        </div>
                        {c.email && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            {c.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">{c.city || 'Sin ciudad'}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                          {c.address || c.department || ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">{c.operator || 'Afinia'}</div>
                        <div className="text-[11px] text-slate-400">
                          {c.voltage_level || 'Monofásico'} {c.stratum ? `• Est. ${c.stratum}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          {c.quote_count || 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(c)}
                            title="Editar Cliente"
                            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteClient(c.id, c.name)}
                              title="Eliminar Cliente"
                              className="p-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canViewVisits && (
                            <button
                              onClick={() => navigate(`/visitas?action=new&clientId=${c.id}`)}
                              className="px-2.5 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Agendar visita"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" />
                              <span>Visita</span>
                            </button>
                          )}
                          {canQuote && (
                            <button
                              onClick={() => navigate(`/cotizador?clientId=${c.id}`)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
                            >
                              Cotizar
                            </button>
                          )}
                          <button
                            onClick={() => openProfileModal(c.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer"
                          >
                            Ficha
                          </button>
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

      {/* Modal: New / Edit Client */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClient ? `Editar Cliente: ${editingClient.name}` : 'Registrar Nuevo Cliente'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre Completo o Razón Social <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
                placeholder="Ej. Carlos Andrés Restrepo"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Documento</label>
              <select
                value={formData.doc_type}
                onChange={(e) => setFormData({ ...formData, doc_type: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
              >
                <option value="CC">Cédula de Ciudadanía (CC)</option>
                <option value="NIT">Número de Identificación Tributaria (NIT)</option>
                <option value="CE">Cédula de Extranjería (CE)</option>
                <option value="Pasaporte">Pasaporte</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Número de Documento</label>
              <input
                type="text"
                value={formData.doc_number}
                onChange={(e) => setFormData({ ...formData, doc_number: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
                placeholder="Ej. 71.234.567"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
                placeholder="Ej. 3124567890"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
                placeholder="cliente@solar.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ciudad / Municipio</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
                placeholder="Ej. Medellín"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Departamento</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
                placeholder="Ej. Antioquia"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Dirección del Predio / Proyecto</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
                placeholder="Calle 10 # 40-50 / Km 5 Vía..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Operador de Red</label>
              <input
                type="text"
                value={formData.operator}
                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
                placeholder="Afinia, Air-e, Celsia, EPM, ESSA, etc."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Cliente</label>
              <select
                value={formData.client_type}
                onChange={(e) => setFormData({ ...formData, client_type: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
              >
                <option value="Residencial">Residencial</option>
                <option value="Comercial">Comercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Rural/Finca">Rural / Finca</option>
              </select>
            </div>

            {!editingClient && (
              <div className="sm:col-span-2 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/40 to-slate-50 border border-emerald-200/80 shadow-xs">
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setFormData({ ...formData, schedule_visit: !formData.schedule_visit })}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#2d8a58] text-white flex items-center justify-center font-bold shadow-xs">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                        <span>Programar Visita Técnica para este Cliente</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2d8a58]/10 text-[#1c5c3a]">
                          Opcional
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Agenda el levantamiento técnico de inmediato para iniciar la secuencia comercial
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.schedule_visit}
                    onChange={(e) => setFormData({ ...formData, schedule_visit: e.target.checked })}
                    className="w-5 h-5 rounded accent-[#2d8a58] cursor-pointer"
                  />
                </div>

                {formData.schedule_visit && (
                  <div className="mt-3.5 pt-3.5 border-t border-emerald-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Fecha Programada de Visita *
                      </label>
                      <input
                        type="date"
                        required={formData.schedule_visit}
                        value={formData.visit_date}
                        onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Hora Estimada de la Visita *
                      </label>
                      <select
                        value={formData.visit_time}
                        onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-semibold"
                      >
                        {['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Técnico o Asesor Asignado
                      </label>
                      <select
                        value={formData.visit_user_id}
                        onChange={(e) => setFormData({ ...formData, visit_user_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-semibold"
                      >
                        <option value="">Seleccionar técnico...</option>
                        {technicians.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Consumo Aprox. Mensual (kWh)
                      </label>
                      <input
                        type="number"
                        value={formData.client_consumption_kwh}
                        onChange={(e) => setFormData({ ...formData, client_consumption_kwh: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-semibold"
                        placeholder="Ej. 650"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Notas / Instrucciones del Levantamiento
                      </label>
                      <input
                        type="text"
                        value={formData.visit_notes}
                        onChange={(e) => setFormData({ ...formData, visit_notes: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                        placeholder="Ej. Inspección de cubierta para 16 paneles y revisión de tablero general"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Notas Técnicas / Observaciones</label>
              <textarea
                rows="2"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
                placeholder="Tipo de techo, orientación, transformador propio..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-xl shadow"
            >
              {editingClient ? 'Actualizar Cliente' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Client 360° Profile */}
      <Modal
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          setProfileData(null);
        }}
        title={profileData?.client?.name ? `Ficha Integral 360°: ${profileData.client.name}` : 'Ficha de Cliente'}
        maxWidth="max-w-3xl"
      >
        {loadingProfile || !profileData?.client ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-amber-500 border-t-transparent mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Contact details */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Identificación:</span>
                <p className="font-bold text-slate-800 dark:text-slate-100">{profileData.client.doc_type || 'CC'} {profileData.client.doc_number || 'S/N'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Teléfono / WhatsApp:</span>
                <p className="font-bold text-slate-800 dark:text-slate-100">{profileData.client.phone || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Ubicación:</span>
                <p className="font-bold text-slate-800 dark:text-slate-100">{profileData.client.address || 'Sin dirección'}, {profileData.client.city || 'Sin ciudad'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px]">Operador Eléctrico:</span>
                <p className="font-bold text-slate-800 dark:text-slate-100">{profileData.client.operator || 'Afinia'} ({profileData.client.client_type || 'Residencial'})</p>
              </div>
            </div>

            {/* Technical Visits list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-[#2d8a58]" />
                  Visitas Técnicas Agendadas ({profileData.visits?.length || 0})
                </h4>
                {canViewVisits && (
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate(`/visitas?action=new&clientId=${profileData.client.id}`);
                    }}
                    className="text-xs font-bold text-[#2d8a58] hover:text-[#237348] cursor-pointer"
                  >
                    + Agendar Visita
                  </button>
                )}
              </div>

              {!profileData.visits || profileData.visits.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No tiene visitas técnicas registradas.</p>
              ) : (
                <div className="space-y-2">
                  {profileData.visits.map((v) => (
                    <div key={v.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs bg-white dark:bg-slate-900">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{v.visit_code}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            v.status === 'realizada' ? 'bg-emerald-100 text-emerald-800' :
                            v.status === 'agendada' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {v.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {formatDate(v.scheduled_date)} &bull; {v.scheduled_time} {v.user_name ? `• Técnico: ${v.user_name}` : ''}
                        </div>
                      </div>
                      {canViewVisits && (
                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            navigate(`/visitas?visitId=${v.id}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Ver Levantamiento &rarr;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quotes list */}
            {canQuote && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                    Cotizaciones Emitidas ({profileData.quotes?.length || 0})
                  </h4>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate(`/cotizador?clientId=${profileData.client.id}`);
                    }}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                  >
                    + Nueva Cotización
                  </button>
                </div>

                {!profileData.quotes || profileData.quotes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No tiene cotizaciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {profileData.quotes.map((q) => (
                      <div key={q.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs bg-white dark:bg-slate-900">
                        <div>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{q.quote_code}</span>
                          <div className="text-[11px] text-slate-500">{getSystemTypeName(q.system_type)} &bull; {formatKW(q.installed_power_kwp)}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-900 dark:text-slate-100 block">{formatCOP(q.total_price)}</span>
                          <button
                            onClick={() => {
                              setIsProfileOpen(false);
                              navigate(`/cotizacion/${q.id}`);
                            }}
                            className="text-[11px] font-bold text-amber-600 hover:underline cursor-pointer"
                          >
                            Ver Propuesta &rarr;
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Follow-up history */}
            {canViewCRM && (
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Historial de Seguimientos ({profileData.followups?.length || 0})
                </h4>
                {!profileData.followups || profileData.followups.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No hay seguimientos registrados.</p>
                ) : (
                  <div className="space-y-2">
                    {profileData.followups.map((f) => (
                      <div key={f.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold capitalize">{f.interaction_type} &bull; {formatDate(f.created_at)}</span>
                          <span className="font-bold text-amber-700 dark:text-amber-400">{f.interest_score}/10 Interés</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{f.comments}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
