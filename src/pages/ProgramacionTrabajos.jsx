import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  User,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  Trash2,
  Edit2,
  Play,
  Check,
  CalendarCheck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronUp,
  Shield,
  Layers,
  SlidersHorizontal,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatCOP } from '../utils/formatters';
import Modal from '../components/Modal';

export default function ProgramacionTrabajos({ onNotify }) {
  const { authFetch, user, isAdmin, isTechnician } = useAuth();

  // State: Data
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [clients, setClients] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  // State: View Mode ('blocks' vs 'table')
  const [viewMode, setViewMode] = useState('blocks');

  // State: Filters & View
  // 'todos': Vista General en 3 bloques (Arriba: No realizados, Medio: Hoy, Abajo: Programados)
  // 'vencidos': Enfocar en No realizados
  // 'hoy': Enfocar en Trabajos de hoy
  // 'programados': Enfocar en Trabajos futuros
  // 'completados': Enfocar en Historial de realizados
  const [activeTab, setActiveTab] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [technicianFilter, setTechnicianFilter] = useState('all');
  const [showCompletedHistory, setShowCompletedHistory] = useState(false);

  // State: Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State for Create / Edit
  const initialFormData = {
    title: '',
    job_type: 'instalacion',
    client_id: '',
    client_name: '',
    client_phone: '',
    client_address: '',
    city: '',
    contract_id: '',
    technician_id: '',
    scheduled_date: new Date().toISOString().slice(0, 10),
    scheduled_time: '08:00 AM',
    priority: 'media',
    description: '',
    materials_needed: '',
    technician_notes: ''
  };
  const [formData, setFormData] = useState(initialFormData);

  // Form State for Completion
  const [completionNotes, setCompletionNotes] = useState('');

  // Fetch jobs list (retrieve full schedule to divide into 3 blocks)
  const fetchJobs = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      const today = new Date().toISOString().slice(0, 10);
      query.append('client_date', today);

      if (priorityFilter !== 'all') query.append('priority', priorityFilter);
      if (technicianFilter !== 'all') query.append('technician_id', technicianFilter);
      if (searchTerm.trim()) query.append('search', searchTerm.trim());

      // If user specifically clicks on a single dedicated tab, we can filter by query or fetch all
      if (activeTab === 'vencidos') {
        query.append('status', 'overdue');
      } else if (activeTab === 'hoy') {
        query.append('status', 'today');
      } else if (['pendiente', 'en_progreso', 'completado'].includes(activeTab)) {
        query.append('status', activeTab);
      }

      const res = await authFetch(`/api/jobs?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Error loading jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats & alerts
  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await authFetch(`/api/jobs/stats?client_date=${today}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading jobs stats:', err);
    }
  };

  // Fetch technicians, clients, contracts
  const fetchAuxiliaryData = async () => {
    try {
      const [resTechs, resClients, resContracts] = await Promise.all([
        authFetch('/api/jobs/technicians'),
        authFetch('/api/clients'),
        authFetch('/api/contracts')
      ]);

      if (resTechs.ok) {
        const d = await resTechs.json();
        setTechnicians(d.technicians || []);
      }
      if (resClients.ok) {
        const d = await resClients.json();
        setClients(d.clients || []);
      }
      if (resContracts.ok) {
        const d = await resContracts.json();
        setContracts(d.contracts || []);
      }
    } catch (err) {
      console.error('Error loading auxiliary data:', err);
    }
  };

  useEffect(() => {
    fetchAuxiliaryData();
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchStats();
  }, [activeTab, priorityFilter, technicianFilter]);

  // STRICT FILTER: Only 'tecnico' and 'ingeniero' roles are allowed for technical work assignment
  const eligibleTechnicians = useMemo(() => {
    return technicians.filter(t => {
      const r = (t.role || '').toLowerCase().trim();
      return r === 'tecnico' || r === 'ingeniero';
    });
  }, [technicians]);

  // Client Selection in form
  const handleClientSelect = (clientId) => {
    if (!clientId) {
      setFormData(prev => ({
        ...prev,
        client_id: '',
        client_name: '',
        client_phone: '',
        client_address: '',
        city: ''
      }));
      return;
    }
    const found = clients.find(c => c.id.toString() === clientId.toString());
    if (found) {
      setFormData(prev => ({
        ...prev,
        client_id: found.id,
        client_name: found.name,
        client_phone: found.phone || prev.client_phone || '',
        client_address: found.address || prev.client_address || '',
        city: found.city || prev.city || ''
      }));
    }
  };

  // Contract selection in form
  const handleContractSelect = (contractId) => {
    if (!contractId) {
      setFormData(prev => ({ ...prev, contract_id: '' }));
      return;
    }
    const found = contracts.find(c => c.id.toString() === contractId.toString());
    if (found) {
      setFormData(prev => ({
        ...prev,
        contract_id: found.id,
        client_id: found.client_id || prev.client_id,
        client_name: found.client_name || prev.client_name,
        client_phone: found.client_phone || prev.client_phone,
        client_address: found.client_address || prev.client_address,
        city: found.client_city || prev.city,
        title: prev.title || `Instalación Obra Contrato ${found.contract_code}`
      }));
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      ...initialFormData,
      scheduled_date: new Date().toISOString().slice(0, 10),
      technician_id: eligibleTechnicians.length > 0 ? eligibleTechnicians[0].id : ''
    });
    setIsNewModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (job) => {
    setSelectedJob(job);
    setFormData({
      title: job.title || '',
      job_type: job.job_type || 'instalacion',
      client_id: job.client_id || '',
      client_name: job.client_name || '',
      client_phone: job.client_phone || '',
      client_address: job.client_address || '',
      city: job.city || '',
      contract_id: job.contract_id || '',
      technician_id: job.technician_id || '',
      scheduled_date: job.scheduled_date || '',
      scheduled_time: job.scheduled_time || '08:00 AM',
      priority: job.priority || 'media',
      description: job.description || '',
      materials_needed: job.materials_needed || '',
      technician_notes: job.technician_notes || ''
    });
    setIsEditModalOpen(true);
  };

  // Submit Create Job (with strict validation: only tecnico or ingeniero)
  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!formData.technician_id) {
      if (onNotify) onNotify({ type: 'error', message: 'Debes asignar un técnico o ingeniero responsable.' });
      return;
    }
    const assignedTech = eligibleTechnicians.find(t => String(t.id) === String(formData.technician_id));
    if (!assignedTech) {
      if (onNotify) onNotify({ type: 'error', message: 'Solamente se pueden asignar trabajos a los roles de Técnico o Ingeniero.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await authFetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al programar trabajo');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: `Trabajo técnico ${data.job?.job_code || ''} asignado a ${assignedTech.name} exitosamente.`
        });
      }
      setIsNewModalOpen(false);
      fetchJobs();
      fetchStats();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit / Reschedule Job (with strict validation)
  const handleUpdateJob = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!formData.technician_id) {
      if (onNotify) onNotify({ type: 'error', message: 'Debes asignar un técnico o ingeniero responsable.' });
      return;
    }
    const assignedTech = eligibleTechnicians.find(t => String(t.id) === String(formData.technician_id));
    if (!assignedTech) {
      if (onNotify) onNotify({ type: 'error', message: 'Solamente se pueden asignar trabajos a los roles de Técnico o Ingeniero.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await authFetch(`/api/jobs/${selectedJob.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar trabajo');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: `Trabajo ${selectedJob.job_code} actualizado correctamente.`
        });
      }
      setIsEditModalOpen(false);
      setSelectedJob(null);
      fetchJobs();
      fetchStats();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Start Job (En Progreso)
  const handleStartJob = async (job) => {
    try {
      const res = await authFetch(`/api/jobs/${job.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'en_progreso' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar estado');

      if (onNotify) {
        onNotify({
          type: 'info',
          message: `Trabajo ${job.job_code} marcado en ejecución.`
        });
      }
      fetchJobs();
      fetchStats();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  // Open Complete Modal
  const handleOpenCompleteModal = (job) => {
    setSelectedJob(job);
    setCompletionNotes(job.technician_notes || '');
    setIsCompleteModalOpen(true);
  };

  // Confirm Complete Job
  const handleConfirmComplete = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;
    try {
      setSubmitting(true);
      const res = await authFetch(`/api/jobs/${selectedJob.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completado',
          technician_notes: completionNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al completar trabajo');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: `¡Excelente! Trabajo ${selectedJob.job_code} marcado como REALIZADO / COMPLETADO.`
        });
      }
      setIsCompleteModalOpen(false);
      setSelectedJob(null);
      fetchJobs();
      fetchStats();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Job
  const handleDeleteJob = async (job) => {
    if (!job) return;
    const confirm = window.confirm(`¿Estás seguro de eliminar la orden ${job.job_code} (${job.title})? Esta acción no se puede deshacer.`);
    if (!confirm) return;

    try {
      const res = await authFetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: `Trabajo ${job.job_code} eliminado del cronograma.`
        });
      }
      fetchJobs();
      fetchStats();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  // Helper: Format Priority Badge
  const renderPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgente':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs animate-pulse flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 stroke-[2.5]" /> Urgente
          </span>
        );
      case 'alta':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1">
            Alta Prioridad
          </span>
        );
      case 'media':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            Media
          </span>
        );
      case 'baja':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Baja
          </span>
        );
    }
  };

  // Helper: Format Status Badge
  const renderStatusBadge = (job) => {
    if (job.status === 'completado') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center gap-1">
          <Check className="w-3 h-3 stroke-[3]" /> Realizado
        </span>
      );
    }
    if (job.status === 'en_progreso') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 flex items-center gap-1">
          <Play className="w-3 h-3 fill-current" /> En Ejecución
        </span>
      );
    }
    if (job.is_overdue) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs animate-pulse flex items-center gap-1">
          <AlertCircle className="w-3 h-3 stroke-[2.5]" /> No Realizado ({job.days_overdue}d atrasado)
        </span>
      );
    }
    if (job.is_today) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs flex items-center gap-1">
          <Clock className="w-3 h-3" /> Para Hoy
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Programado
      </span>
    );
  };

  // Helper: Job Type label
  const getJobTypeLabel = (type) => {
    const types = {
      instalacion: 'Instalación Fotovoltaica',
      mantenimiento: 'Mantenimiento Preventivo / Correctivo',
      visita_tecnica: 'Levantamiento / Visita Técnica',
      cambio_medidor: 'Instalación Medidor Bidireccional',
      garantia: 'Revisión por Garantía',
      bombeo: 'Puesta en Marcha Bombeo Solar',
      otro: 'Trabajo General'
    };
    return types[type] || 'Servicio Técnico';
  };

  // Today Date string ISO
  const todayStr = new Date().toISOString().slice(0, 10);

  // Filtered jobs list based on client-side search/filters
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (priorityFilter !== 'all' && job.priority !== priorityFilter) return false;
      if (technicianFilter !== 'all' && String(job.technician_id) !== String(technicianFilter)) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = (job.title || '').toLowerCase().includes(term);
        const matchCode = (job.job_code || '').toLowerCase().includes(term);
        const matchClient = (job.client_name || job.real_client_name || '').toLowerCase().includes(term);
        const matchTech = (job.technician_full_name || job.technician_name || '').toLowerCase().includes(term);
        const matchCity = (job.city || '').toLowerCase().includes(term);
        const matchDesc = (job.description || '').toLowerCase().includes(term);
        if (!matchTitle && !matchCode && !matchClient && !matchTech && !matchCity && !matchDesc) return false;
      }
      return true;
    });
  }, [jobs, priorityFilter, technicianFilter, searchTerm]);

  // -------------------------------------------------------------
  // THE THREE REQUESTED SECTIONS (DIVIDED VERTICALLY IN THREE):
  // 1. ARRIBA: Trabajos que NO se realizaron y están pendientes (vencidos / fuera de fecha)
  // 2. EN EL MEDIO: Trabajos que son para hoy
  // 3. ABAJO: Trabajos programados a futuro
  // + SECCIÓN HISTORIAL: Trabajos realizados / completados
  // -------------------------------------------------------------
  const overdueJobs = useMemo(() => {
    return filteredJobs.filter(j => j.status !== 'completado' && (j.is_overdue || (j.scheduled_date && j.scheduled_date < todayStr)));
  }, [filteredJobs, todayStr]);

  const todayJobs = useMemo(() => {
    return filteredJobs.filter(j => j.status !== 'completado' && (j.is_today || j.scheduled_date === todayStr));
  }, [filteredJobs, todayStr]);

  const upcomingJobs = useMemo(() => {
    return filteredJobs.filter(j => j.status !== 'completado' && !j.is_overdue && !j.is_today && (!j.scheduled_date || j.scheduled_date > todayStr));
  }, [filteredJobs, todayStr]);

  const completedJobs = useMemo(() => {
    return filteredJobs.filter(j => j.status === 'completado');
  }, [filteredJobs]);

  // Unified list for table view respecting active tab
  const displayedTableJobs = useMemo(() => {
    if (activeTab === 'vencidos') return overdueJobs;
    if (activeTab === 'hoy') return todayJobs;
    if (activeTab === 'programados') return upcomingJobs;
    if (activeTab === 'completados') return completedJobs;
    return [...overdueJobs, ...todayJobs, ...upcomingJobs, ...completedJobs];
  }, [activeTab, overdueJobs, todayJobs, upcomingJobs, completedJobs]);

  // Card Renderer Component
  const renderJobCard = (job, variant = 'standard') => {
    const isOverdue = job.is_overdue || (job.status !== 'completado' && job.scheduled_date && job.scheduled_date < todayStr);
    const isToday = job.is_today || (job.status !== 'completado' && job.scheduled_date === todayStr);

    let borderClass = 'border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md';
    if (job.status === 'completado') {
      borderClass = 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10';
    } else if (isOverdue) {
      borderClass = 'border-rose-400 dark:border-rose-800/80 shadow-md shadow-rose-500/10 ring-1 ring-rose-400/40 bg-gradient-to-br from-rose-50/50 to-white dark:from-rose-950/20 dark:to-slate-900';
    } else if (isToday) {
      borderClass = 'border-amber-400 dark:border-amber-600/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/40 bg-gradient-to-br from-amber-50/40 to-white dark:from-amber-950/20 dark:to-slate-900';
    }

    return (
      <div
        key={job.id}
        className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border transition-all flex flex-col justify-between ${borderClass}`}
      >
        <div>
          {/* Top Badges & Time */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="font-mono font-black text-xs text-[#2d8a58] dark:text-[#48bb78] bg-[#2d8a58]/10 px-2.5 py-0.5 rounded-md border border-[#2d8a58]/20">
                  {job.job_code}
                </span>
                {renderPriorityBadge(job.priority)}
                {renderStatusBadge(job)}
              </div>
              <h3 className="font-black text-base text-slate-900 dark:text-white leading-snug">
                {job.title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                Tipo: <strong className="text-slate-700 dark:text-slate-300">{getJobTypeLabel(job.job_type)}</strong>
                {job.contract_code ? (
                  <span> &bull; Contrato: <strong className="font-mono text-slate-800 dark:text-slate-200">{job.contract_code}</strong></span>
                ) : null}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className={`px-2.5 py-1 rounded-xl font-bold text-xs inline-flex items-center gap-1 border ${
                isToday
                  ? 'bg-amber-400 text-slate-950 border-amber-500 font-black'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{job.scheduled_time || '08:00 AM'}</span>
              </span>
              <p className={`text-[11px] font-black mt-1 ${isOverdue ? 'text-rose-600 dark:text-rose-400' : isToday ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
                {formatDate(job.scheduled_date)}
              </p>
            </div>
          </div>

          {/* Overdue Warning Alert Box for pending jobs past deadline */}
          {isOverdue && (
            <div className="mb-3 px-3.5 py-2.5 rounded-2xl bg-rose-600 text-white shadow-sm flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-white shrink-0 animate-bounce" />
                <span className="text-xs font-bold leading-tight">
                  🚨 <strong>Trabajo NO Realizado:</strong> Venció hace <strong>{job.days_overdue || 1} {job.days_overdue === 1 ? 'día' : 'días'}</strong> ({formatDate(job.scheduled_date)}).
                </span>
              </div>
              <button
                onClick={() => handleOpenEditModal(job)}
                className="px-2.5 py-1 bg-white text-rose-900 rounded-lg font-black text-[10px] shrink-0 shadow hover:bg-rose-50 transition-colors cursor-pointer"
              >
                Reprogramar
              </button>
            </div>
          )}

          {/* Details card info */}
          <div className="my-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
            {/* Client Info */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente:</span>
                <strong className="text-slate-900 dark:text-white truncate block">
                  {job.client_name || job.real_client_name || 'Sin especificar'}
                </strong>
                {(job.city || job.real_client_city) && (
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate">
                    {job.city || job.real_client_city} {job.client_address || job.real_client_address ? `• ${job.client_address || job.real_client_address}` : ''}
                  </span>
                )}
              </div>

              {(job.client_phone || job.real_client_phone) && (
                <div className="flex items-center gap-1 shrink-0 pt-1">
                  <a
                    href={`tel:${job.client_phone || job.real_client_phone}`}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 hover:text-[#2d8a58] transition-colors"
                    title="Llamar al cliente"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`https://wa.me/57${(job.client_phone || job.real_client_phone).replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 hover:bg-emerald-200 transition-colors"
                    title="Enviar WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Assigned Technician or Engineer */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Responsable Asignado (Técnico / Ingeniero):
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-6 h-6 rounded-full bg-[#2d8a58] text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    {(job.technician_full_name || job.technician_name || 'T')[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="font-black text-slate-800 dark:text-slate-200 text-xs block leading-none">
                      {job.technician_full_name || job.technician_name || 'Sin Asignar'}
                    </span>
                    <span className="text-[10px] font-bold text-[#2d8a58] dark:text-[#48bb78]">
                      {job.technician_role === 'ingeniero' ? 'Ingeniero Solar' : 'Técnico Especialista'}
                    </span>
                  </div>
                </div>
              </div>

              {job.completed_at && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Finalizado el:</span>
                  <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                    {formatDate(job.completed_at)}
                  </span>
                </div>
              )}
            </div>

            {/* Description / Scope */}
            {job.description && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300">
                <strong>Alcance:</strong> {job.description}
              </div>
            )}

            {/* Materials */}
            {job.materials_needed && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                <strong>Materiales requeridos:</strong> {job.materials_needed}
              </div>
            )}

            {/* Technician Notes / Closure Report */}
            {job.technician_notes && (
              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 text-[11px] text-amber-900 dark:text-amber-200">
                <strong>Informe Técnico:</strong> {job.technician_notes}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleDeleteJob(job)}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Eliminar orden de trabajo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleOpenEditModal(job)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Editar detalles o reprogramar fecha"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {job.status === 'pendiente' && (
              <button
                onClick={() => handleStartJob(job)}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Iniciar</span>
              </button>
            )}

            {job.status !== 'completado' ? (
              <button
                onClick={() => handleOpenCompleteModal(job)}
                className="px-3.5 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Marcar Realizado</span>
              </button>
            ) : (
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Cumplido con Éxito
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-[#2d8a58]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full bg-[#2d8a58]/20 text-[#48bb78] font-mono text-xs font-bold border border-[#2d8a58]/30 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                <span>Programación Técnica & Cuadrillas</span>
              </span>
              <span className="text-xs text-slate-400">
                Restringido a Técnicos e Ingenieros
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <span>Programación de Trabajos Técnicos</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Control estructurado en 3 bloques de ejecución: seguimiento riguroso de trabajos no realizados, asignaciones para hoy y trabajos futuros programados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setViewMode(viewMode === 'blocks' ? 'table' : 'blocks')}
              className="px-3.5 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm border border-slate-200 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              title="Alternar entre vista en bloques y vista en tabla"
            >
              <SlidersHorizontal className="w-4 h-4 text-slate-500" />
              <span>{viewMode === 'blocks' ? 'Ver como Tabla' : 'Ver como Bloques'}</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-3 rounded-2xl bg-[#2d8a58] hover:bg-[#237348] active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-[#2d8a58]/30 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Programar Trabajo</span>
            </button>

            <button
              onClick={() => { fetchJobs(); fetchStats(); }}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700 transition-colors cursor-pointer"
              title="Refrescar cronograma técnico"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
              title="Imprimir cronograma"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Prominent Overdue Alert Banner if any jobs are not completed on time */}
      {stats?.overdue_count > 0 && (
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl border-2 border-rose-400 relative overflow-hidden animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-white shrink-0 shadow-inner">
                <AlertTriangle className="w-7 h-7 text-rose-100 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-[11px] uppercase tracking-wider bg-black/30 text-rose-100 px-2.5 py-0.5 rounded-full border border-white/20">
                    Alerta de Incumplimiento Técnico
                  </span>
                  <span className="font-black text-xs bg-white text-rose-900 px-2.5 py-0.5 rounded-full shadow-xs">
                    {stats.overdue_count} {stats.overdue_count === 1 ? 'trabajo vencido' : 'trabajos vencidos'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white mt-1">
                  Atención: Hay trabajos que NO se realizaron en la fecha pactada
                </h3>
                <p className="text-xs text-rose-100 mt-0.5 max-w-3xl">
                  Revisa el bloque superior de la programación técnica para reprogramar de inmediato o confirmar el estado en sitio con el técnico o ingeniero asignado.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('vencidos')}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-rose-950 font-black text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer shrink-0 self-start md:self-auto"
            >
              <span>Ver Bloque No Realizados</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Bloque Superior KPI: No Realizados */}
        <div
          onClick={() => setActiveTab(activeTab === 'vencidos' ? 'todos' : 'vencidos')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTab === 'vencidos'
              ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50 dark:bg-rose-950/40 shadow-md'
              : 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/60 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
              1. No Realizados
            </span>
            {stats?.overdue_count > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
            )}
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {stats?.overdue_count || 0}
          </p>
          <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold">
            🚨 Bloque Superior (Atrasados)
          </span>
        </div>

        {/* Bloque Medio KPI: Para Hoy */}
        <div
          onClick={() => setActiveTab(activeTab === 'hoy' ? 'todos' : 'hoy')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTab === 'hoy'
              ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50 dark:bg-amber-950/40'
              : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800/60 hover:border-amber-400'
          }`}
        >
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            2. Para Hoy
          </span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats?.today_count || 0}
          </p>
          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">
            ⚡ Bloque Central (Hoy)
          </span>
        </div>

        {/* Bloque Inferior KPI: Programados Futuros */}
        <div
          onClick={() => setActiveTab(activeTab === 'programados' ? 'todos' : 'programados')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTab === 'programados'
              ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 dark:bg-blue-950/40'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400'
          }`}
        >
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
            3. Programados Futuros
          </span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {upcomingJobs.length}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">
            📅 Bloque Inferior (Próximos)
          </span>
        </div>

        {/* Completados KPI */}
        <div
          onClick={() => {
            setActiveTab('completados');
            setShowCompletedHistory(true);
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTab === 'completados'
              ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            Realizados / Historial
          </span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats?.completed || 0}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">
            ✅ Cumplidos y cerrados
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        {/* Navigation Tabs & View Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 no-print">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'todos', label: 'Vista Completa en 3 Bloques', count: stats?.total, icon: Layers },
              { id: 'vencidos', label: '🚨 Bloque 1: No Realizados', count: stats?.overdue_count, alert: stats?.overdue_count > 0 },
              { id: 'hoy', label: '📅 Bloque 2: Para Hoy', count: stats?.today_count },
              { id: 'programados', label: '📋 Bloque 3: Programados', count: upcomingJobs.length },
              { id: 'completados', label: '✅ Historial Realizados', count: stats?.completed }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'completados') setShowCompletedHistory(true);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? tab.id === 'vencidos'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                      : 'bg-[#2d8a58] text-white shadow-md shadow-[#2d8a58]/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    activeTab === tab.id
                      ? 'bg-black/20 text-white'
                      : tab.alert
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'blocks' ? 'table' : 'blocks')}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0 ml-auto"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>{viewMode === 'blocks' ? 'Ver como Tabla' : 'Ver como Bloques'}</span>
          </button>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchJobs()}
              placeholder="Buscar por cliente, técnico, código TRB o descripción..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2d8a58]"
            />
          </div>

          {/* Technician / Engineer Filter */}
          <div className="sm:col-span-3">
            <select
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="all">Todos los Técnicos e Ingenieros</option>
              {eligibleTechnicians.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.role === 'ingeniero' ? 'Ingeniero Solar' : 'Técnico Especialista'})
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="sm:col-span-3">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="all">Todas las Prioridades</option>
              <option value="urgente">🚨 Urgente</option>
              <option value="alta">Alta Prioridad</option>
              <option value="media">Media Prioridad</option>
              <option value="baja">Baja Prioridad</option>
            </select>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {loading ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#2d8a58] border-t-transparent mx-auto"></div>
          <p className="text-xs text-slate-500 mt-3 font-semibold">Cargando cronograma técnico...</p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW OF TECHNICAL JOBS */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {displayedTableJobs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Wrench className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No hay trabajos técnicos para mostrar</h3>
              <p className="text-xs text-slate-400 mt-1">Programa una nueva orden con el botón superior.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Código & Estado</th>
                    <th className="py-3.5 px-4">Fecha & Hora</th>
                    <th className="py-3.5 px-4">Trabajo Técnico</th>
                    <th className="py-3.5 px-4">Cliente & Contacto</th>
                    <th className="py-3.5 px-4">Responsable</th>
                    <th className="py-3.5 px-4 text-center">Prioridad</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedTableJobs.map((job) => {
                    const isOverdue = job.is_overdue || (job.status !== 'completado' && job.scheduled_date && job.scheduled_date < todayStr);
                    const isToday = job.is_today || (job.status !== 'completado' && job.scheduled_date === todayStr);
                    const isCompleted = job.status === 'completado';

                    return (
                      <tr
                        key={job.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                          isOverdue ? 'bg-rose-50/30 dark:bg-rose-950/20' : isToday ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                        }`}
                      >
                        {/* Código & Estado */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-black text-slate-900 dark:text-white block">
                            {job.job_code}
                          </span>
                          <div className="mt-1">
                            {renderStatusBadge(job)}
                          </div>
                        </td>

                        {/* Fecha & Hora */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{job.scheduled_time || '08:00 AM'}</span>
                          </div>
                          <span className={`text-[11px] block mt-0.5 ${
                            isOverdue ? 'text-rose-600 font-black' : isToday ? 'text-amber-600 font-bold' : 'text-slate-500'
                          }`}>
                            {formatDate(job.scheduled_date)}
                          </span>
                          {isOverdue && (
                            <span className="inline-block mt-0.5 text-[9px] font-black uppercase text-rose-600 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.2 rounded">
                              {job.days_overdue || 1}d atrasado
                            </span>
                          )}
                        </td>

                        {/* Trabajo / Título */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 dark:text-white block leading-snug">
                            {job.title}
                          </span>
                          <span className="text-[10px] text-[#2d8a58] font-bold block mt-0.5">
                            {getJobTypeLabel(job.job_type)}
                          </span>
                          {job.contract_code && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Contrato: {job.contract_code}
                            </span>
                          )}
                        </td>

                        {/* Cliente & Contacto */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {job.client_name || job.real_client_name || 'Sin especificar'}
                          </span>
                          {(job.client_phone || job.real_client_phone) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              <span>{job.client_phone || job.real_client_phone}</span>
                              <a
                                href={`https://wa.me/57${(job.client_phone || job.real_client_phone).replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-700"
                                title="Enviar WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5 inline" />
                              </a>
                            </div>
                          )}
                          {(job.city || job.real_client_city) && (
                            <span className="text-[10px] text-slate-400 block truncate">
                              {job.city || job.real_client_city}
                            </span>
                          )}
                        </td>

                        {/* Técnico Responsable */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {job.technician_full_name || job.technician_name}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {job.technician_role === 'ingeniero' ? 'Ingeniero Solar' : 'Técnico Especialista'}
                          </span>
                        </td>

                        {/* Prioridad */}
                        <td className="py-3.5 px-4 text-center">
                          {renderPriorityBadge(job.priority)}
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                            {!isCompleted && job.status === 'pendiente' && (
                              <button
                                onClick={() => handleStartJob(job)}
                                title="Iniciar trabajo"
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!isCompleted && (
                              <button
                                onClick={() => handleOpenCompleteModal(job)}
                                title="Marcar como realizado"
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            )}

                            {!isCompleted && (
                              <button
                                onClick={() => handleOpenEditModal(job)}
                                title="Editar / Reprogramar"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteJob(job)}
                              title="Eliminar trabajo"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      ) : (
        <div className="space-y-8">
          {/* ========================================================= */}
          {/* BLOQUE 1 (ARRIBA): TRABAJOS NO REALIZADOS Y PENDIENTES    */}
          {/* ========================================================= */}
          {(activeTab === 'todos' || activeTab === 'vencidos') && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-rose-200 dark:border-rose-900/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-md shadow-rose-600/20">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-400 flex items-center gap-2">
                      <span>1. Trabajos Pendientes No Realizados</span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-600 text-white">
                        {overdueJobs.length}
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Órdenes cuya fecha programada ya venció sin reporte de cierre. Requieren reprogramación inmediata o seguimiento.
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900">
                  Bloque Superior
                </span>
              </div>

              {overdueJobs.length === 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold">
                    ¡Excelente noticia! No hay trabajos técnicos atrasados ni pendientes fuera de fecha.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {overdueJobs.map(job => renderJobCard(job, 'overdue'))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* BLOQUE 2 (EN EL MEDIO): TRABAJOS QUE SON PARA HOY         */}
          {/* ========================================================= */}
          {(activeTab === 'todos' || activeTab === 'hoy') && (
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200 dark:border-amber-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
                    <Clock className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <span>2. Trabajos Programados Para Hoy</span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                        {todayJobs.length}
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Órdenes de ejecución del día {formatDate(todayStr)}. Prioridad de despacho y cuadrilla en sitio.
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900">
                  Bloque Central
                </span>
              </div>

              {todayJobs.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="text-xs font-bold">
                    No hay trabajos técnicos asignados para el día de hoy.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {todayJobs.map(job => renderJobCard(job, 'today'))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* BLOQUE 3 (ABAJO): TRABAJOS PROGRAMADOS FUTUROS            */}
          {/* ========================================================= */}
          {(activeTab === 'todos' || activeTab === 'programados') && (
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <span>3. Trabajos Programados (Próximos / Futuros)</span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-600 text-white">
                        {upcomingJobs.length}
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Órdenes técnicas agendadas para próximos días. Ordenadas cronológicamente para planeación y preparación de suministros.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900">
                    Bloque Inferior
                  </span>
                  <button
                    onClick={handleOpenCreateModal}
                    className="px-3 py-1 bg-[#2d8a58] hover:bg-[#237348] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo Trabajo</span>
                  </button>
                </div>
              </div>

              {upcomingJobs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <CalendarCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No hay trabajos técnicos programados para fechas futuras.
                  </p>
                  <button
                    onClick={handleOpenCreateModal}
                    className="mt-3 px-4 py-2 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white text-xs font-black cursor-pointer inline-flex items-center gap-1.5 shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Programar Trabajo Ahora</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingJobs.map(job => renderJobCard(job, 'upcoming'))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SECCIÓN ADICIONAL: HISTORIAL DE TRABAJOS REALIZADOS       */}
          {/* ========================================================= */}
          {(activeTab === 'todos' || activeTab === 'completados') && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div
                onClick={() => setShowCompletedHistory(prev => !prev)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                    Historial de Trabajos Realizados y Cerrados ({completedJobs.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>{showCompletedHistory ? 'Ocultar historial' : 'Ver historial'}</span>
                  {showCompletedHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {showCompletedHistory && (
                <div className="mt-4 space-y-3 animate-in fade-in">
                  {completedJobs.length === 0 ? (
                    <p className="text-xs text-slate-400 p-4 text-center">
                      Aún no hay trabajos técnicos completados registrados en el historial.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {completedJobs.map(job => renderJobCard(job, 'completed'))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PROGRAMAR NUEVO TRABAJO TÉCNICO                    */}
      {/* ========================================================= */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Programar Trabajo Técnico / Cuadrilla"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Restricción de Rol:</strong> Solo es posible asignar órdenes de trabajo a usuarios con rol de <strong>Técnico</strong> o <strong>Ingeniero</strong>.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Título de la Tarea / Trabajo *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej. Instalación de estructura y paneles solares 10 kWp"
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              />
            </div>

            {/* Job Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Trabajo *
              </label>
              <select
                value={formData.job_type}
                onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              >
                <option value="instalacion">Instalación Fotovoltaica</option>
                <option value="mantenimiento">Mantenimiento Preventivo / Correctivo</option>
                <option value="visita_tecnica">Levantamiento / Visita Técnica</option>
                <option value="cambio_medidor">Instalación Medidor Bidireccional</option>
                <option value="garantia">Revisión por Garantía</option>
                <option value="bombeo">Puesta en Marcha Bombeo Solar</option>
                <option value="otro">Otro Trabajo General</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Prioridad / Importancia *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              >
                <option value="urgente">🚨 URGENTE (Atención Inmediata)</option>
                <option value="alta">Alta Prioridad</option>
                <option value="media">Media Prioridad</option>
                <option value="baja">Baja Prioridad</option>
              </select>
            </div>

            {/* Assigned Technician or Engineer STRICT */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>Responsable Asignado (Solo Técnicos o Ingenieros) *</span>
                <span className="text-[10px] text-[#2d8a58] font-bold">
                  {eligibleTechnicians.length} profesionales calificados
                </span>
              </label>
              <select
                required
                value={formData.technician_id}
                onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              >
                <option value="">-- Seleccionar Técnico o Ingeniero --</option>
                {eligibleTechnicians.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.role === 'ingeniero' ? 'Ingeniero Solar' : 'Técnico Especialista'})
                  </option>
                ))}
              </select>
              {eligibleTechnicians.length === 0 && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1">
                  No hay usuarios registrados con rol de 'tecnico' o 'ingeniero'. Asígnales ese rol en el módulo de Usuarios.
                </p>
              )}
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>Fecha Programada *</span>
              </label>
              <input
                type="date"
                required
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              />
            </div>

            {/* Scheduled Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>Hora Programada *</span>
              </label>
              <input
                type="text"
                required
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                placeholder="Ej. 08:00 AM"
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              />
            </div>

            {/* Client Picker */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cliente Registrado en el Sistema (Opcional)
              </label>
              <select
                value={formData.client_id}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-medium bg-white dark:bg-slate-800"
              >
                <option value="">-- Seleccionar cliente o ingresar datos manualmente abajo --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.city ? `(${c.city})` : ''} - {c.phone || 'Sin tel.'}
                  </option>
                ))}
              </select>
            </div>

            {/* Manual Client Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nombre del Cliente
              </label>
              <input
                type="text"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Nombre completo..."
                className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800"
              />
            </div>

            {/* Client Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                value={formData.client_phone}
                onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                placeholder="Ej. 3001234567"
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-mono bg-white dark:bg-slate-800"
              />
            </div>

            {/* Client City */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ciudad / Municipio
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Ej. Magangué"
                className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800"
              />
            </div>

            {/* Client Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Dirección / Lugar
              </label>
              <input
                type="text"
                value={formData.client_address}
                onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                placeholder="Ej. Calle 14 # 16A-49"
                className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800"
              />
            </div>

            {/* Associated Contract */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vincular a Contrato Formalizado (Opcional)
              </label>
              <select
                value={formData.contract_id}
                onChange={(e) => handleContractSelect(e.target.value)}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-medium bg-white dark:bg-slate-800"
              >
                <option value="">-- Ninguno / Trabajo Independiente --</option>
                {contracts.map(ctr => (
                  <option key={ctr.id} value={ctr.id}>
                    {ctr.contract_code} &bull; {ctr.client_name} - {formatCOP(ctr.total_contract_value)}
                  </option>
                ))}
              </select>
            </div>

            {/* Description / Scope */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Descripción / Alcance del Trabajo
              </label>
              <textarea
                rows="2"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalla las actividades a realizar en sitio..."
                className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800"
              />
            </div>

            {/* Materials */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Materiales, Equipos y Herramientas Requeridas
              </label>
              <input
                type="text"
                value={formData.materials_needed}
                onChange={(e) => setFormData({ ...formData, materials_needed: e.target.value })}
                placeholder="Ej. Inversor 5kW, 10 paneles 720W, cable solar 6mm, multímetro, arnés..."
                className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="px-4 py-2 rounded-xl border text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#2d8a58] hover:bg-[#237348] text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>{submitting ? 'Programando...' : 'Confirmar y Programar Trabajo'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: EDITAR / REPROGRAMAR TRABAJO                       */}
      {/* ========================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={selectedJob ? `Editar / Reprogramar: ${selectedJob.job_code}` : 'Editar Trabajo'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleUpdateJob} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Título del Trabajo *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Responsable Asignado (Solo Técnico / Ingeniero) *
              </label>
              <select
                required
                value={formData.technician_id}
                onChange={(e) => setFormData({ ...formData, technician_id: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              >
                <option value="">-- Seleccionar Técnico o Ingeniero --</option>
                {eligibleTechnicians.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.role === 'ingeniero' ? 'Ingeniero Solar' : 'Técnico Especialista'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Prioridad *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              >
                <option value="urgente">🚨 URGENTE</option>
                <option value="alta">Alta Prioridad</option>
                <option value="media">Media Prioridad</option>
                <option value="baja">Baja Prioridad</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nueva Fecha Programada *
              </label>
              <input
                type="date"
                required
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Hora Programada *
              </label>
              <input
                type="text"
                required
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Descripción / Alcance
              </label>
              <textarea
                rows="2"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notas y Reporte del Técnico
              </label>
              <textarea
                rows="2"
                value={formData.technician_notes}
                onChange={(e) => setFormData({ ...formData, technician_notes: e.target.value })}
                placeholder="Observaciones de avance o motivos de reprogramación..."
                className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl border text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#2d8a58] hover:bg-[#237348] text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{submitting ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: MARCAR COMO REALIZADO & INFORME DE CIERRE          */}
      {/* ========================================================= */}
      <Modal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        title={selectedJob ? `Finalizar Trabajo: ${selectedJob.job_code}` : 'Marcar Realizado'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmComplete} className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
            <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Cierre de Orden Técnica</span>
            </h4>
            <p className="text-emerald-700 dark:text-emerald-300 mt-1">
              Al marcar este trabajo como realizado, se registrará la fecha y hora de finalización y se levantará cualquier alerta de incumplimiento.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Informe Técnico / Observaciones de Cierre *
            </label>
            <textarea
              rows="4"
              required
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Describe los resultados del trabajo realizado, pruebas de encendido, voltajes, entrega al cliente..."
              className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCompleteModalOpen(false)}
              className="px-4 py-2 rounded-xl border text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{submitting ? 'Guardando...' : 'Confirmar Trabajo Realizado'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
