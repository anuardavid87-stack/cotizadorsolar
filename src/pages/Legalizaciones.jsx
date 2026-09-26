import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileCheck2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Building2,
  Calendar,
  FileText,
  User,
  Zap,
  Check,
  ChevronRight,
  Printer,
  Sparkles,
  BarChart3,
  BellRing,
  AlertCircle,
  HelpCircle,
  Eye,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
  Square,
  Trash2,
  SlidersHorizontal,
  X,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatCOP, formatKW } from '../utils/formatters';
import Modal from '../components/Modal';

export default function Legalizaciones({ onNotify }) {
  const { authFetch, user, isAdmin, isTechnician } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab: 'panel' | 'expedientes' | 'alertas' | 'informe'
  const activeTab = searchParams.get('tab') || 'panel';
  const [panelFilter, setPanelFilter] = useState('all'); // 'all' | 'stagnant' | 'en_tramite' | 'finalizado_agpe'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  const [dossiers, setDossiers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal: Expediente Detail & Edit (The 9 Steps)
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [savingDossier, setSavingDossier] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // Modal: Open New Expediente (From Eligible Contract or Direct Client Name)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newDossierMode, setNewDossierMode] = useState('client'); // 'client' | 'contract'
  const [clients, setClients] = useState([]);
  const [eligibleContracts, setEligibleContracts] = useState([]);
  const [modalContracts, setModalContracts] = useState([]);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [dismissingAlert, setDismissingAlert] = useState(false);
  const [newDossierData, setNewDossierData] = useState({
    contract_id: '',
    client_id: '',
    client_name: '',
    client_phone: '',
    client_city: '',
    operator: 'Afinia',
    nic_number: '',
    radicado_number: '',
    transformer_code: '',
    installed_power_kwp: '',
    system_type: 'ongrid',
    general_notes: ''
  });

  const fetchDossiers = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (operatorFilter !== 'all') query.append('operator', operatorFilter);
      if (statusFilter !== 'all') query.append('status', statusFilter);
      if (searchTerm) query.append('search', searchTerm);

      const res = await authFetch(`/api/legalizations?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDossiers(data.dossiers || []);
      }
    } catch (err) {
      console.error('Error fetching legalizations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await authFetch('/api/legalizations/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching legalization stats:', err);
    }
  };

  const DISMISSED_ALERTS_KEY = 'renova_dismissed_legalization_alerts';

  const getLocalDismissedIds = () => {
    try {
      const raw = localStorage.getItem(DISMISSED_ALERTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const addLocalDismissedIds = (ids) => {
    try {
      const current = getLocalDismissedIds();
      const updated = Array.from(new Set([...current, ...ids]));
      localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const clearLocalDismissedIds = () => {
    try {
      localStorage.removeItem(DISMISSED_ALERTS_KEY);
    } catch (e) {}
  };

  const fetchEligibleContracts = async () => {
    try {
      setLoadingEligible(true);
      const res = await authFetch('/api/legalizations/eligible-contracts');
      if (res.ok) {
        const data = await res.json();
        const localDismissed = getLocalDismissedIds();
        const filtered = (data.eligible_contracts || []).filter(
          c => !localDismissed.includes(c.contract_id)
        );
        setEligibleContracts(filtered);
        if (data.dismissed_count !== undefined) {
          setDismissedCount(Math.max(data.dismissed_count, localDismissed.length));
        }
      }
    } catch (err) {
      console.error('Error fetching eligible contracts:', err);
    } finally {
      setLoadingEligible(false);
    }
  };

  const fetchModalContracts = async () => {
    try {
      const res = await authFetch('/api/legalizations/eligible-contracts?include_dismissed=true');
      if (res.ok) {
        const data = await res.json();
        setModalContracts(data.eligible_contracts || []);
      }
    } catch (err) {
      console.error('Error fetching modal contracts:', err);
    }
  };

  const handleDismissAllBanner = async () => {
    if (!isAdmin) return;
    if (!window.confirm('¿Estás seguro de que deseas quitar este aviso de contratos sin expediente para que no aparezca más?')) {
      return;
    }
    try {
      setDismissingAlert(true);
      const ids = eligibleContracts.map(c => c.contract_id);
      addLocalDismissedIds(ids);
      setEligibleContracts([]);
      setDismissedCount(prev => prev + ids.length);

      const res = await authFetch('/api/legalizations/dismiss-eligible-contract', {
        method: 'POST',
        body: JSON.stringify({ dismiss_all: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al quitar el aviso');
      if (onNotify) onNotify({ type: 'success', message: data.message || 'Aviso de contratos sin expediente quitado exitosamente.' });
      fetchEligibleContracts();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setDismissingAlert(false);
    }
  };

  const handleDismissSingleContract = async (contractId, contractCode) => {
    if (!isAdmin) return;
    if (!window.confirm(`¿Deseas quitar el aviso para el contrato ${contractCode}?`)) {
      return;
    }
    try {
      addLocalDismissedIds([contractId]);
      setEligibleContracts(prev => prev.filter(c => c.contract_id !== contractId));
      setDismissedCount(prev => prev + 1);

      const res = await authFetch('/api/legalizations/dismiss-eligible-contract', {
        method: 'POST',
        body: JSON.stringify({ contract_id: contractId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al quitar el aviso');
      if (onNotify) onNotify({ type: 'success', message: data.message || `Aviso del contrato ${contractCode} quitado exitosamente.` });
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  const handleRestoreAlerts = async () => {
    if (!isAdmin) return;
    if (!window.confirm('¿Deseas restaurar los avisos de contratos sin expediente que fueron descartados?')) {
      return;
    }
    try {
      clearLocalDismissedIds();
      const res = await authFetch('/api/legalizations/restore-eligible-contracts', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al restaurar avisos');
      if (onNotify) onNotify({ type: 'success', message: data.message || 'Avisos restaurados con éxito.' });
      fetchEligibleContracts();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  const fetchClients = async () => {
    try {
      const res = await authFetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  useEffect(() => {
    fetchDossiers();
    fetchStats();
    fetchEligibleContracts();
  }, [operatorFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDossiers();
  };

  const handleTabChange = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  const openDossierDetail = (dossier) => {
    setSelectedDossier(dossier);
    setEditFormData({
      client_name: dossier.client_name || '',
      client_phone: dossier.client_phone || '',
      client_city: dossier.client_city || '',
      installed_power_kwp: dossier.installed_power_kwp || '',
      system_type: dossier.system_type || 'ongrid',
      operator: dossier.operator || 'Afinia',
      status: dossier.status || 'en_tramite',
      nic_number: dossier.nic_number || '',
      radicado_number: dossier.radicado_number || '',
      transformer_code: dossier.transformer_code || '',
      step1_docs_ok: Boolean(dossier.step1_docs_ok),
      step1_docs_comments: dossier.step1_docs_comments || '',
      step1_docs_date: dossier.step1_docs_date || '',
      step_renova_ok: Boolean(dossier.step_renova_ok),
      step_renova_comments: dossier.step_renova_comments || '',
      step_renova_date: dossier.step_renova_date || '',
      step2_designs_ok: Boolean(dossier.step2_designs_ok),
      step2_designs_comments: dossier.step2_designs_comments || '',
      step2_designs_date: dossier.step2_designs_date || '',
      step3_retie_ok: Boolean(dossier.step3_retie_ok),
      step3_retie_comments: dossier.step3_retie_comments || '',
      step3_retie_date: dossier.step3_retie_date || '',
      step4_radication_ok: Boolean(dossier.step4_radication_ok),
      step4_radication_comments: dossier.step4_radication_comments || '',
      step4_radication_date: dossier.step4_radication_date || '',
      step5_approval_ok: Boolean(dossier.step5_approval_ok),
      step5_approval_comments: dossier.step5_approval_comments || '',
      step5_approval_date: dossier.step5_approval_date || '',
      step6_visit_ok: Boolean(dossier.step6_visit_ok),
      step6_visit_comments: dossier.step6_visit_comments || '',
      step6_visit_date: dossier.step6_visit_date || '',
      step7_meter_ok: Boolean(dossier.step7_meter_ok),
      step7_meter_comments: dossier.step7_meter_comments || '',
      step7_meter_date: dossier.step7_meter_date || '',
      step8_agpe_ok: Boolean(dossier.step8_agpe_ok),
      step8_agpe_comments: dossier.step8_agpe_comments || '',
      step8_agpe_date: dossier.step8_agpe_date || '',
      general_notes: dossier.general_notes || ''
    });
    setIsDetailModalOpen(true);
  };

  const handleDeleteDossier = async (dossier) => {
    if (!dossier) return;
    const confirmMsg = `¿Estás seguro de eliminar el expediente ${dossier.expediente_code} (${dossier.client_name || 'este cliente'})? Esta acción no se puede deshacer.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await authFetch(`/api/legalizations/${dossier.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar expediente');

      if (onNotify) {
        onNotify({ type: 'success', message: data.message || `Expediente ${dossier.expediente_code} eliminado exitosamente.` });
      }
      if (isDetailModalOpen && selectedDossier?.id === dossier.id) {
        setIsDetailModalOpen(false);
        setSelectedDossier(null);
      }
      fetchDossiers();
      fetchStats();
      fetchEligibleContracts();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  const handleSaveDossier = async (e) => {
    e.preventDefault();
    if (!selectedDossier) return;
    try {
      setSavingDossier(true);
      const res = await authFetch(`/api/legalizations/${selectedDossier.id}`, {
        method: 'PUT',
        body: JSON.stringify(editFormData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar expediente');

      if (onNotify) {
        onNotify({ type: 'success', message: `Expediente ${selectedDossier.expediente_code} actualizado exitosamente.` });
      }
      setIsDetailModalOpen(false);
      fetchDossiers();
      fetchStats();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setSavingDossier(false);
    }
  };

  const openNewDossierModal = () => {
    fetchModalContracts();
    fetchClients();
    setNewDossierMode('client');
    setNewDossierData({
      contract_id: '',
      client_id: '',
      client_name: '',
      client_phone: '',
      client_city: '',
      operator: 'Afinia',
      nic_number: '',
      radicado_number: '',
      transformer_code: '',
      installed_power_kwp: '',
      system_type: 'ongrid',
      general_notes: ''
    });
    setIsNewModalOpen(true);
  };

  const openNewDossierWithContract = (contract) => {
    fetchModalContracts();
    fetchClients();
    setNewDossierMode('contract');
    setNewDossierData({
      contract_id: contract.contract_id,
      client_id: contract.client_id || '',
      client_name: contract.client_name || '',
      client_phone: contract.client_phone || '',
      client_city: contract.client_city || '',
      operator: contract.client_operator || 'Afinia',
      nic_number: contract.nic_number || '',
      radicado_number: '',
      transformer_code: '',
      installed_power_kwp: contract.installed_power_kwp || '',
      system_type: contract.system_type || 'ongrid',
      general_notes: `Legalización iniciada desde Contrato ${contract.contract_code}.`
    });
    setIsNewModalOpen(true);
  };

  const handleStartDossierDirectlyFromContract = async (contract) => {
    try {
      // 1. Immediately remove from banner & persist in localStorage so it never reappears
      addLocalDismissedIds([contract.contract_id]);
      setEligibleContracts(prev => prev.filter(c => c.contract_id !== contract.contract_id));

      // 2. Call API to open dossier linked to this contract
      const payload = {
        contract_id: contract.contract_id,
        client_id: contract.client_id,
        client_name: contract.client_name,
        client_phone: contract.client_phone || '',
        client_city: contract.client_city || '',
        operator: contract.client_operator || 'Afinia',
        installed_power_kwp: contract.installed_power_kwp || '',
        system_type: contract.system_type || 'ongrid',
        general_notes: `Legalización iniciada desde Contrato ${contract.contract_code}.`
      };

      const res = await authFetch('/api/legalizations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar expediente');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: `¡Expediente ${data.dossier?.expediente_code || ''} iniciado exitosamente! El contrato ${contract.contract_code} ha sido vinculado y el aviso retirado.`
        });
      }

      fetchDossiers();
      fetchStats();
      fetchEligibleContracts();

      // Open the new dossier detail modal right away so the user can start filling the 9 steps
      if (data.dossier) {
        openDossierDetail(data.dossier);
      }
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
      fetchEligibleContracts();
    }
  };

  const handleContractSelect = (contractId) => {
    const list = modalContracts.length > 0 ? modalContracts : eligibleContracts;
    const found = list.find(c => c.contract_id.toString() === contractId.toString());
    if (found) {
      setNewDossierData({
        ...newDossierData,
        contract_id: found.contract_id,
        client_id: found.client_id,
        client_name: found.client_name,
        client_phone: found.client_phone || '',
        client_city: found.client_city || '',
        operator: found.client_operator || 'Afinia',
        installed_power_kwp: found.installed_power_kwp || '',
        system_type: found.system_type || 'ongrid',
        nic_number: found.nic_number || newDossierData.nic_number || '',
        general_notes: `Legalización iniciada desde Contrato ${found.contract_code}.`
      });
    } else {
      setNewDossierData({
        ...newDossierData,
        contract_id: '',
        client_id: ''
      });
    }
  };

  const handleClientSelect = (selectedClientNameOrId) => {
    if (!selectedClientNameOrId) {
      setNewDossierData(prev => ({
        ...prev,
        client_name: '',
        client_id: ''
      }));
      return;
    }
    const foundClient = clients.find(c =>
      c.id.toString() === selectedClientNameOrId.toString() ||
      c.name.toLowerCase().trim() === selectedClientNameOrId.toLowerCase().trim()
    );
    if (foundClient) {
      setNewDossierData(prev => ({
        ...prev,
        client_name: foundClient.name,
        client_id: foundClient.id,
        client_phone: foundClient.phone || prev.client_phone || '',
        client_city: foundClient.city || prev.client_city || '',
        operator: foundClient.operator || prev.operator || 'Afinia',
        installed_power_kwp: foundClient.latest_installed_power_kwp ? String(foundClient.latest_installed_power_kwp) : prev.installed_power_kwp
      }));
    } else {
      setNewDossierData(prev => ({
        ...prev,
        client_name: selectedClientNameOrId,
        client_id: ''
      }));
    }
  };

  const handleCreateDossier = async (e) => {
    e.preventDefault();
    if (newDossierMode === 'contract' && !newDossierData.contract_id) {
      if (onNotify) onNotify({ type: 'warning', message: 'Por favor selecciona un contrato formalizado.' });
      return;
    }
    if (newDossierMode === 'client' && !newDossierData.client_name?.trim()) {
      if (onNotify) onNotify({ type: 'warning', message: 'Por favor ingresa el nombre del cliente.' });
      return;
    }

    try {
      const payload = { ...newDossierData };
      if (newDossierMode === 'client') {
        payload.contract_id = null;
      }

      if (payload.contract_id) {
        addLocalDismissedIds([parseInt(payload.contract_id, 10)]);
        setEligibleContracts(prev => prev.filter(c => c.contract_id !== parseInt(payload.contract_id, 10)));
      }

      const res = await authFetch('/api/legalizations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al abrir expediente');

      if (onNotify) {
        onNotify({ type: 'success', message: data.message || 'Expediente creado exitosamente' });
      }
      setIsNewModalOpen(false);
      fetchDossiers();
      fetchStats();
      fetchEligibleContracts();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  // 9 steps configuration (incorporating step 2: Diseño e Información Renova)
  const stepsConfig = [
    {
      num: 1,
      key: 'docs',
      fieldOk: 'step1_docs_ok',
      fieldComments: 'step1_docs_comments',
      fieldDate: 'step1_docs_date',
      title: '1. Documentos Básicos del Cliente',
      desc: 'Cédula, Certificado de Tradición y Libertad reciente y última factura de energía.',
      tag: 'Requisito Inicial'
    },
    {
      num: 2,
      key: 'renova',
      fieldOk: 'step_renova_ok',
      fieldComments: 'step_renova_comments',
      fieldDate: 'step_renova_date',
      title: '2. Diseño e Información Renova',
      desc: 'Levantamiento técnico Renova, dimensionamiento fotovoltaico, fichas técnicas de equipos y propuesta aprobada.',
      tag: 'Ingeniería Renova'
    },
    {
      num: 3,
      key: 'designs',
      fieldOk: 'step2_designs_ok',
      fieldComments: 'step2_designs_comments',
      fieldDate: 'step2_designs_date',
      title: '3. Diseños de Ingeniería',
      desc: 'Diagrama unifilar oficial, plano de localización, cuadro de cargas y memorias de cálculo ante el OR.',
      tag: 'Ingeniería Operador'
    },
    {
      num: 4,
      key: 'retie',
      fieldOk: 'step3_retie_ok',
      fieldComments: 'step3_retie_comments',
      fieldDate: 'step3_retie_date',
      title: '4. Certificación RETIE',
      desc: 'Dictamen de inspección técnica RETIE emitido por organismo acreditado ONAC.',
      tag: 'Seguridad Eléctrica'
    },
    {
      num: 5,
      key: 'radication',
      fieldOk: 'step4_radication_ok',
      fieldComments: 'step4_radication_comments',
      fieldDate: 'step4_radication_date',
      title: '5. Radicación ante el Operador',
      desc: 'Solicitud formal de conexión simplificada (AGPE) radicada ante la empresa distribuidora.',
      tag: 'Trámite Oficial'
    },
    {
      num: 6,
      key: 'approval',
      fieldOk: 'step5_approval_ok',
      fieldComments: 'step5_approval_comments',
      fieldDate: 'step5_approval_date',
      title: '6. Aprobación del Operador de Red',
      desc: 'Concepto técnico de conexión favorable y asignación de capacidad de inyección.',
      tag: 'Aprobación Técnica'
    },
    {
      num: 7,
      key: 'visit',
      fieldOk: 'step6_visit_ok',
      fieldComments: 'step6_visit_comments',
      fieldDate: 'step6_visit_date',
      title: '7. Visita Técnica del Operador',
      desc: 'Inspección en sitio y recibo de obra por parte de la cuadrilla técnica del operador.',
      tag: 'Inspección en Sitio'
    },
    {
      num: 8,
      key: 'meter',
      fieldOk: 'step7_meter_ok',
      fieldComments: 'step7_meter_comments',
      fieldDate: 'step7_meter_date',
      title: '8. Instalación del Medidor Bidireccional',
      desc: 'Calibración, cambio e instalación del equipo de medida bidireccional homologado.',
      tag: 'Medición'
    },
    {
      num: 9,
      key: 'agpe',
      fieldOk: 'step8_agpe_ok',
      fieldComments: 'step8_agpe_comments',
      fieldDate: 'step8_agpe_date',
      title: '9. Carta AGPE Final',
      desc: 'Constancia oficial de puesta en operación como Autogenerador a Pequeña Escala.',
      tag: 'Cierre Regulatorio'
    }
  ];

  // Helper: Get step completion count from edit form (out of 9)
  const getFormCompletedCount = () => {
    let count = 0;
    for (const s of stepsConfig) {
      if (editFormData[s.fieldOk]) count++;
    }
    return count;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-[#2d8a58]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full bg-[#2d8a58]/20 text-[#48bb78] font-mono text-xs font-bold border border-[#2d8a58]/30 flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Trámites Regulatorios de Red</span>
              </span>
              <span className="text-xs text-slate-400">
                Fase Post-Contrato &bull; 9 Hitos Oficiales
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <span>Legalizaciones ante el Operador de Red</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Control de expedientes, cumplimiento de los 9 pasos regulatorios (documentos, Renova, ingeniería, RETIE, operador y medidor) hasta la emisión de la <strong>Carta AGPE</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isAdmin && dismissedCount > 0 && (
              <button
                onClick={handleRestoreAlerts}
                title="Restaurar los avisos de contratos sin expediente que fueron descartados"
                className="px-3.5 py-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs sm:text-sm border border-amber-500/30 flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Restaurar Avisos ({dismissedCount})</span>
              </button>
            )}
            <button
              onClick={openNewDossierModal}
              className="px-4 py-3 rounded-2xl bg-[#2d8a58] hover:bg-[#237348] active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-[#2d8a58]/30 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Abrir Expediente</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
              title="Imprimir informe de trámites"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Imprimir Informe</span>
            </button>
          </div>
        </div>
      </div>

      {/* Eligible Signed Contracts Proactive Banner (Renova Brand Green) */}
      {eligibleContracts.length > 0 && (
        <div className="bg-gradient-to-r from-[#1c5c3a] via-[#2d8a58] to-[#237348] text-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-[#2d8a58]/20 border-2 border-[#48bb78]/50 relative overflow-hidden animate-in fade-in duration-300">
          {/* Top-Right Dismiss 'X' Button for Super Administrator */}
          {isAdmin && (
            <button
              onClick={handleDismissAllBanner}
              disabled={dismissingAlert}
              title="Quitar este aviso para que no aparezca más (Solo Super Administrador)"
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/25 hover:bg-black/50 text-white/90 hover:text-white transition-all cursor-pointer border border-white/20 shadow-md flex items-center justify-center group"
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-12">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-white shrink-0 shadow-sm border border-white/20">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-[11px] uppercase tracking-wider bg-black/30 text-emerald-100 px-2.5 py-0.5 rounded-full border border-white/15">
                    Contratos Firmados Pendientes
                  </span>
                  <span className="font-bold text-xs bg-white text-[#2d8a58] px-2.5 py-0.5 rounded-full shadow-sm">
                    {eligibleContracts.length} {eligibleContracts.length === 1 ? 'contrato por radicar' : 'contratos por radicar'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white mt-1">
                  Existen contratos formalizados con legalización incluida que no han iniciado expediente
                </h3>
                <p className="text-xs text-emerald-100/90 mt-0.5 max-w-2xl">
                  Inicia de inmediato el trámite ante el operador de red (Afinia, Air-e, etc.) con 1 solo clic para evitar retrasos y cumplir los plazos de entrega.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {eligibleContracts.map((c) => (
              <div
                key={c.contract_id}
                className="bg-black/15 hover:bg-black/25 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20 shadow-xs flex flex-col justify-between gap-3 transition-all relative group/card"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono font-bold text-xs text-white bg-white/20 px-2 py-0.5 rounded-md border border-white/10">
                      {c.contract_code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/10">
                        {c.client_operator || 'Afinia'}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissSingleContract(c.contract_id, c.contract_code);
                          }}
                          title={`Quitar aviso del contrato ${c.contract_code}`}
                          className="p-1 rounded-md bg-white/15 hover:bg-rose-600 text-white/90 hover:text-white transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate">{c.client_name}</h4>
                  <p className="text-[11px] text-emerald-100/80 flex items-center justify-between mt-1">
                    <span>{c.client_city || 'Sin ciudad'}</span>
                    <span className="font-bold text-white">{c.installed_power_kwp ? `${c.installed_power_kwp} kWp` : 'N/D'}</span>
                  </p>
                </div>

                <button
                  onClick={() => handleStartDossierDirectlyFromContract(c)}
                  className="w-full py-2 px-3 rounded-xl bg-white hover:bg-emerald-50 active:scale-95 text-[#2d8a58] font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#2d8a58]" />
                  <span>Iniciar Expediente</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#2d8a58]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal Module Tabs (Alerts stay strictly inside this module!) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-print">
        <button
          onClick={() => handleTabChange('panel')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'panel'
              ? 'bg-[#2d8a58] text-white shadow-md shadow-[#2d8a58]/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Panel Principal</span>
          {stats?.stagnant_count > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
              {stats.stagnant_count} en alerta
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('expedientes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'expedientes'
              ? 'bg-[#2d8a58] text-white shadow-md shadow-[#2d8a58]/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Tarjetas de Expedientes ({dossiers.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('alertas')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'alertas'
              ? 'bg-[#2d8a58] text-white shadow-md shadow-[#2d8a58]/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BellRing className="w-4 h-4" />
          <span>Alertas del Trámite</span>
          {stats?.internal_alerts?.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
              {stats.internal_alerts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('informe')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'informe'
              ? 'bg-[#2d8a58] text-white shadow-md shadow-[#2d8a58]/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Informe General & Estadísticas</span>
        </button>
      </div>

      {/* TAB 0: PANEL PRINCIPAL (CENTRO DE CONTROL INTERACTIVO Y ÁGIL) */}
      {activeTab === 'panel' && (
        <div className="space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div
              onClick={() => setPanelFilter('all')}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${
                panelFilter === 'all' ? 'ring-2 ring-[#2d8a58] border-[#2d8a58]' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Expedientes</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats?.total || dossiers.length}</p>
              <span className="text-[10px] text-slate-500 font-medium">Trámites en sistema</span>
            </div>

            <div
              onClick={() => setPanelFilter('en_tramite')}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${
                panelFilter === 'en_tramite' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300'
              }`}
            >
              <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider block">En Trámite Activo</span>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats?.en_tramite || 0}</p>
              <span className="text-[10px] text-slate-500 font-medium">Pasos 1 al 8</span>
            </div>

            {/* Inactivity Alert KPI (>15 days without progress) */}
            <div
              onClick={() => setPanelFilter(panelFilter === 'stagnant' ? 'all' : 'stagnant')}
              className={`p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/40 dark:to-slate-900 border transition-all cursor-pointer shadow-xs relative overflow-hidden ${
                panelFilter === 'stagnant'
                  ? 'ring-2 ring-rose-500 border-rose-500 shadow-md shadow-rose-500/10'
                  : 'border-rose-200 dark:border-rose-900/60 hover:border-rose-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                  🚨 &gt;15 Días Sin Avance
                </span>
                {stats?.stagnant_count > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                )}
              </div>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {stats?.stagnant_count || 0}
              </p>
              <span className="text-[10px] text-rose-600/80 dark:text-rose-300/80 font-bold block">
                {panelFilter === 'stagnant' ? '✓ Filtro activo' : 'Clic para filtrar en riesgo'}
              </span>
            </div>

            <div
              onClick={() => setPanelFilter('finalizado_agpe')}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer shadow-xs ${
                panelFilter === 'finalizado_agpe' ? 'ring-2 ring-[#2d8a58] border-[#2d8a58]' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'
              }`}
            >
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Concluidos (AGPE)</span>
              <p className="text-2xl font-black text-[#2d8a58] dark:text-[#48bb78] mt-1">{stats?.finalizados_agpe || 0}</p>
              <span className="text-[10px] text-slate-500 font-medium">100% legalizados</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block">Potencia en Trámite</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {formatKW(dossiers.reduce((acc, d) => acc + (parseFloat(d.installed_power_kwp) || 0), 0))}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">Capacidad solar instalada</span>
            </div>
          </div>

          {/* Stagnant Alert Banner if any */}
          {stats?.stagnant_count > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-300 dark:border-rose-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 shadow-sm animate-pulse">
                  <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-rose-950 dark:text-rose-200 flex items-center gap-2">
                    <span>Atención: {stats.stagnant_count} expediente(s) con más de 15 días sin avance regulatorio</span>
                  </h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300/80 mt-0.5">
                    Se requiere gestión inmediata ante el operador de red o el cliente para destrabar el proceso.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPanelFilter(panelFilter === 'stagnant' ? 'all' : 'stagnant')}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                {panelFilter === 'stagnant' ? 'Mostrar Todos los Trámites' : `Ver Trámites Estancados (${stats.stagnant_count})`}
              </button>
            </div>
          )}

          {/* Interactive Fast Filter Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar en el panel por cliente, radicado, NIC, contrato o ciudad..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2d8a58]"
                />
              </div>

              {/* Operator Quick Select */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={operatorFilter}
                    onChange={(e) => setOperatorFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
                  >
                    <option value="all">Todos los Operadores</option>
                    <option value="Enel">Enel Colombia</option>
                    <option value="Celsia">Celsia</option>
                    <option value="EPM">EPM</option>
                    <option value="Afinia">Afinia</option>
                    <option value="Air-e">Air-e</option>
                    <option value="ESSA">ESSA</option>
                    <option value="EMCALI">EMCALI</option>
                    <option value="CHEC">CHEC</option>
                  </select>
                </div>

                <button
                  onClick={openNewDossierModal}
                  className="px-3.5 py-2 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Nuevo Expediente</span>
                </button>
              </div>
            </div>

            {/* Quick Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
              {[
                { key: 'all', label: 'Todos los Trámites', count: dossiers.length },
                { key: 'stagnant', label: '🚨 En Riesgo (>15d)', count: dossiers.filter(d => d.is_stagnant).length, isRisk: true },
                { key: 'en_tramite', label: 'En Trámite Activo', count: dossiers.filter(d => d.status === 'en_tramite').length },
                { key: 'finalizado_agpe', label: '✓ Carta AGPE', count: dossiers.filter(d => d.status === 'finalizado_agpe').length },
                { key: 'detenido', label: 'Detenidos / Observación', count: dossiers.filter(d => d.status === 'detenido').length }
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setPanelFilter(filter.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    panelFilter === filter.key
                      ? filter.isRisk
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : filter.isRisk
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    panelFilter === filter.key
                      ? 'bg-white/20 text-white'
                      : filter.isRisk
                      ? 'bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* HIGH-SPEED INTERACTIVE TABLE FOR COMPLETE VISIBILITY */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#2d8a58]" />
                  <span>Tablero Central de Trámites Regulatorios (9 Pasos)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Monitoreo ágil e interactivo con detección automática de cuellos de botella e inactividad.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Mostrando {dossiers.filter(d => {
                  if (panelFilter === 'stagnant' && !d.is_stagnant) return false;
                  if (panelFilter === 'en_tramite' && d.status !== 'en_tramite') return false;
                  if (panelFilter === 'finalizado_agpe' && d.status !== 'finalizado_agpe') return false;
                  if (panelFilter === 'detenido' && d.status !== 'detenido') return false;
                  if (operatorFilter !== 'all' && d.operator !== operatorFilter) return false;
                  if (searchTerm.trim() !== '') {
                    const term = searchTerm.toLowerCase().trim();
                    return (
                      d.client_name?.toLowerCase().includes(term) ||
                      d.expediente_code?.toLowerCase().includes(term) ||
                      d.radicado_number?.toLowerCase().includes(term) ||
                      d.nic_number?.toLowerCase().includes(term) ||
                      d.contract_code?.toLowerCase().includes(term) ||
                      d.client_city?.toLowerCase().includes(term)
                    );
                  }
                  return true;
                }).length} de {dossiers.length} expedientes
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Expediente & Contrato</th>
                    <th className="p-3.5">Cliente & Ubicación</th>
                    <th className="p-3.5">Operador & Cuentas</th>
                    <th className="p-3.5">Potencia</th>
                    <th className="p-3.5">Avance (9 Pasos)</th>
                    <th className="p-3.5">Inactividad & Estado</th>
                    <th className="p-3.5 text-center">Acciones Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dossiers
                    .filter(d => {
                      if (panelFilter === 'stagnant' && !d.is_stagnant) return false;
                      if (panelFilter === 'en_tramite' && d.status !== 'en_tramite') return false;
                      if (panelFilter === 'finalizado_agpe' && d.status !== 'finalizado_agpe') return false;
                      if (panelFilter === 'detenido' && d.status !== 'detenido') return false;
                      if (operatorFilter !== 'all' && d.operator !== operatorFilter) return false;
                      if (searchTerm.trim() !== '') {
                        const term = searchTerm.toLowerCase().trim();
                        return (
                          d.client_name?.toLowerCase().includes(term) ||
                          d.expediente_code?.toLowerCase().includes(term) ||
                          d.radicado_number?.toLowerCase().includes(term) ||
                          d.nic_number?.toLowerCase().includes(term) ||
                          d.contract_code?.toLowerCase().includes(term) ||
                          d.client_city?.toLowerCase().includes(term)
                        );
                      }
                      return true;
                    })
                    .map((d) => {
                      const isFinished = d.status === 'finalizado_agpe' || d.completed_steps === 9;
                      return (
                        <tr
                          key={d.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                            d.is_stagnant ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                          }`}
                        >
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <button
                                type="button"
                                onClick={() => openDossierDetail(d)}
                                className="font-mono font-black text-xs text-[#2d8a58] dark:text-[#48bb78] bg-[#2d8a58]/10 hover:bg-[#2d8a58]/25 px-2 py-0.5 rounded border border-[#2d8a58]/20 transition-all cursor-pointer text-left flex items-center gap-1"
                                title="Ver detalle del trámite"
                              >
                                <Eye className="w-3 h-3 inline-block" />
                                <span>{d.expediente_code}</span>
                              </button>
                              {d.is_stagnant && (
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {d.contract_code ? (
                                <span>Contrato: <strong className="text-slate-700 dark:text-slate-300">{d.contract_code}</strong></span>
                              ) : (
                                <span className="text-amber-600 font-semibold">Directo</span>
                              )}
                            </p>
                          </td>

                          <td className="p-3.5">
                            <button
                              type="button"
                              onClick={() => openDossierDetail(d)}
                              className="text-left font-bold text-slate-900 dark:text-white hover:text-[#2d8a58] dark:hover:text-[#48bb78] text-xs transition-colors cursor-pointer block"
                              title="Ver trámite de este cliente"
                            >
                              {d.client_name}
                            </button>
                            <p className="text-[11px] text-slate-500">
                              {d.client_city || 'Sin ciudad'} {d.client_phone ? `• ${d.client_phone}` : ''}
                            </p>
                          </td>

                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px] inline-block mb-1">
                              {d.operator || 'Afinia'}
                            </span>
                            <div className="text-[10px] font-mono text-slate-500">
                              {d.radicado_number ? `Rad: ${d.radicado_number}` : d.nic_number ? `NIC: ${d.nic_number}` : 'Sin radicado'}
                            </div>
                          </td>

                          <td className="p-3.5 font-bold font-mono text-slate-800 dark:text-slate-200 text-xs">
                            {formatKW(d.installed_power_kwp || 0)}
                          </td>

                          <td className="p-3.5 min-w-[170px]">
                            <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                              <span className="text-slate-700 dark:text-slate-300">{d.completed_steps} de 9 pasos</span>
                              <span className="font-mono text-[#2d8a58]">{d.progress_percentage}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-[#2d8a58] to-[#48bb78] h-full rounded-full transition-all duration-300"
                                style={{ width: `${d.progress_percentage}%` }}
                              />
                            </div>
                            <div className="mt-1 flex items-center gap-0.5">
                              {stepsConfig.map(s => {
                                const ok = Boolean(d[s.fieldOk]);
                                return (
                                  <span
                                    key={s.num}
                                    title={`${s.title}: ${ok ? 'Cumplido' : 'Pendiente'}`}
                                    className={`w-3.5 h-3.5 text-[9px] font-bold rounded flex items-center justify-center ${
                                      ok ? 'bg-[#2d8a58] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {s.num}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          <td className="p-3.5">
                            {d.is_stagnant ? (
                              <div className="space-y-1">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white flex items-center gap-1 shadow-xs animate-pulse w-max">
                                  <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                                  &gt;15d sin avance ({d.days_inactive}d)
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  Último: {formatDate(d.last_activity_date || d.updated_at || d.created_at)}
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block mb-0.5 ${
                                  isFinished
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                    : d.status === 'detenido'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                                }`}>
                                  {isFinished ? '✓ Carta AGPE' : d.status === 'detenido' ? 'Detenido' : 'En Trámite'}
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  {d.days_inactive > 0 ? `Activo hace ${d.days_inactive}d` : 'Actualizado hoy'}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap sm:flex-nowrap">
                              <button
                                type="button"
                                onClick={() => openDossierDetail(d)}
                                className="px-3 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                                title="Ver y examinar el trámite"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ver Trámite</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openDossierDetail(d)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                                title="Gestionar los 9 pasos regulatorios"
                              >
                                <span>9 Pasos</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDossier(d)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Eliminar expediente"
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

              {dossiers.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-xs text-slate-400">No hay expedientes registrados aún.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: TARJETAS DE EXPEDIENTES */}
      {activeTab === 'expedientes' && (
        <div className="space-y-6">
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Expedientes</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats?.total || 0}</p>
              <span className="text-[11px] text-slate-500">Aperturados en sistema</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider block">En Trámite Activo</span>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats?.en_tramite || 0}</p>
              <span className="text-[11px] text-slate-500">Pasos 1 al 8 en ejecución</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Concluidos (Carta AGPE)</span>
              <p className="text-2xl font-black text-[#2d8a58] dark:text-[#48bb78] mt-1">{stats?.finalizados_agpe || 0}</p>
              <span className="text-[11px] text-slate-500">100% legalizados e inyectando</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Avance Promedio</span>
              <p className="text-2xl font-black text-amber-500 mt-1">
                {dossiers.length > 0
                  ? Math.round(dossiers.reduce((acc, d) => acc + (d.progress_percentage || 0), 0) / dossiers.length)
                  : 0}%
              </p>
              <span className="text-[11px] text-slate-500">Completitud de los 9 hitos</span>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por cliente, radicado, NIC, contrato o ciudad..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2d8a58]"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Buscar
              </button>
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Operator filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={operatorFilter}
                  onChange={(e) => setOperatorFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
                >
                  <option value="all">Todos los Operadores</option>
                  <option value="Enel">Enel Colombia</option>
                  <option value="Celsia">Celsia</option>
                  <option value="EPM">EPM</option>
                  <option value="Afinia">Afinia</option>
                  <option value="Air-e">Air-e</option>
                  <option value="ESSA">ESSA (Santander)</option>
                  <option value="EMCALI">EMCALI</option>
                  <option value="CHEC">CHEC</option>
                </select>
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
              >
                <option value="all">Todos los Estados</option>
                <option value="en_tramite">En Trámite</option>
                <option value="finalizado_agpe">Finalizado (Carta AGPE)</option>
                <option value="detenido">Detenido / En Espera</option>
              </select>

              {/* View mode toggle */}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>{viewMode === 'cards' ? 'Ver como Tabla' : 'Ver como Tarjetas'}</span>
              </button>
            </div>
          </div>

          {/* Dossiers Grid */}
          {loading ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#2d8a58] border-t-transparent mx-auto"></div>
              <p className="text-xs text-slate-500 mt-3 font-semibold">Cargando expedientes de legalización...</p>
            </div>
          ) : dossiers.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-[#2d8a58] flex items-center justify-center mx-auto mb-3">
                <FileCheck2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">No hay expedientes registrados</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Puedes abrir expedientes para clientes con contrato formalizado o directamente con su nombre.
              </p>
              <button
                onClick={openNewDossierModal}
                className="mt-4 px-4 py-2 bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Abrir Primer Expediente</span>
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dossiers.map((d) => {
                const isFinished = d.status === 'finalizado_agpe' || d.completed_steps === 9;
                return (
                  <div
                    key={d.id}
                    className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border transition-all flex flex-col justify-between ${
                      d.is_stagnant
                        ? 'border-rose-400 dark:border-rose-800/80 shadow-md shadow-rose-500/5 ring-1 ring-rose-400/20'
                        : 'border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="font-mono font-black text-xs text-[#2d8a58] dark:text-[#48bb78] bg-[#2d8a58]/10 px-2.5 py-0.5 rounded-md border border-[#2d8a58]/20">
                              {d.expediente_code}
                            </span>
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              isFinished
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : d.status === 'detenido'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                            }`}>
                              {isFinished ? '✓ Carta AGPE' : d.status === 'detenido' ? 'Detenido' : 'En Trámite'}
                            </span>

                            {/* 15-day Inactivity Red Alert Tag (as requested in user image) */}
                            {d.is_stagnant && (
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-600 text-white shadow-xs animate-pulse flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                                &gt;15 días sin avance ({d.days_inactive}d)
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                            {d.client_name}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {d.client_city || 'Sin ciudad'} &bull; {d.contract_code ? (
                              <span>Contrato: <strong className="text-slate-700 dark:text-slate-300">{d.contract_code}</strong></span>
                            ) : (
                              <span className="font-semibold text-amber-600 dark:text-amber-400">Trámite Directo</span>
                            )}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs inline-block border border-slate-200/80 dark:border-slate-700">
                            {d.operator || 'Afinia'}
                          </span>
                          {d.radicado_number && (
                            <p className="text-[10px] font-mono text-slate-500 mt-1">Rad: {d.radicado_number}</p>
                          )}
                        </div>
                      </div>

                      {/* Stagnant Warning Alert Box if inactive > 15 days */}
                      {d.is_stagnant && (
                        <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Alerta: Trámite sin avance en los últimos {d.days_inactive} días. Requiere gestión ante el operador o el cliente.</span>
                        </div>
                      )}

                      {/* Progress Bar (9 steps) */}
                      <div className="my-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <span>Avance Regulatorio:</span>
                            <strong className="text-[#2d8a58] dark:text-[#48bb78]">{d.completed_steps} de 9 pasos</strong>
                          </span>
                          <span className="font-mono text-[#2d8a58] dark:text-[#48bb78]">{d.progress_percentage}%</span>
                        </div>

                        {/* Progress meter bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-[#2d8a58] to-[#48bb78] h-full transition-all duration-300"
                            style={{ width: `${d.progress_percentage}%` }}
                          />
                        </div>

                        {/* 9-step mini visual icons */}
                        <div className="grid grid-cols-9 gap-1 mt-2 text-center text-[10px]">
                          {stepsConfig.map((s) => {
                            const isStepOk = Boolean(d[s.fieldOk]);
                            return (
                              <div
                                key={s.num}
                                className={`py-1 rounded-lg font-bold truncate transition-colors ${
                                  isStepOk
                                    ? 'bg-[#2d8a58] text-white shadow-xs'
                                    : 'bg-slate-200 dark:bg-slate-700/60 text-slate-400'
                                }`}
                                title={`${s.title}: ${isStepOk ? 'Cumplido' : 'Pendiente'}`}
                              >
                                {s.num}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Metadata row */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">NIC / Cuenta Operador:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {d.nic_number || 'Pendiente por registrar'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Ingeniero Responsable:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {d.engineer_name || 'Sin asignar'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDossier(d);
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title={`Eliminar expediente ${d.expediente_code}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          {d.updated_at ? `Actualizado: ${formatDate(d.updated_at)}` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => openDossierDetail(d)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-[#2d8a58] dark:hover:bg-[#2d8a58] text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <span>Gestionar 9 Pasos</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View for Expedientes */
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Expediente</th>
                      <th className="py-3.5 px-4">Cliente / Ciudad</th>
                      <th className="py-3.5 px-4">Operador & Radicado</th>
                      <th className="py-3.5 px-4">Avance Regulatorio</th>
                      <th className="py-3.5 px-4 text-center">Inactividad</th>
                      <th className="py-3.5 px-4 text-center">Estado</th>
                      <th className="py-3.5 px-4">Ingeniero</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dossiers.map((d) => {
                      const isFinished = d.status === 'finalizado_agpe' || d.completed_steps === 9;
                      return (
                        <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-xs text-[#2d8a58] dark:text-[#48bb78] bg-[#2d8a58]/10 px-2.5 py-1 rounded-md border border-[#2d8a58]/20 block w-fit">
                              {d.expediente_code}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{d.client_name}</div>
                            <div className="text-[11px] text-slate-400">
                              {d.client_city || 'Sin ciudad'} &bull; {d.contract_code ? `Contrato: ${d.contract_code}` : 'Directo'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{d.operator || 'Afinia'}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {d.radicado_number ? `Rad: ${d.radicado_number}` : `NIC: ${d.nic_number || 'S/N'}`}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 min-w-[170px]">
                            <div className="flex items-center justify-between text-[11px] mb-1 font-bold">
                              <span className="text-slate-700 dark:text-slate-300">{d.completed_steps} de 9</span>
                              <span className="text-[#2d8a58] dark:text-[#48bb78]">{d.progress_percentage}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-[#2d8a58] to-[#48bb78] h-full"
                                style={{ width: `${d.progress_percentage}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {d.is_stagnant ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                                <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                                &gt;15 días ({d.days_inactive}d)
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                Al día
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className={`inline-block text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                              isFinished
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : d.status === 'detenido'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                            }`}>
                              {isFinished ? '✓ Carta AGPE' : d.status === 'detenido' ? 'Detenido' : 'En Trámite'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              {d.engineer_name || 'Sin asignar'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openDossierDetail(d)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-[#2d8a58] text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                              >
                                <span>Pasos</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDossier(d);
                                }}
                                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title={`Eliminar expediente ${d.expediente_code}`}
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
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALERTAS INTERNAS DEL TRÁMITE */}
      {activeTab === 'alertas' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h4 className="font-bold text-amber-950 dark:text-amber-200">
                Centro de Alertas de Trámites Regulatorios
              </h4>
              <p className="text-amber-800 dark:text-amber-300/80 mt-0.5">
                Estas alertas son exclusivas de este módulo y no saturan el panel general. Aquí se señalan los cuellos de botella para que la ingeniería y administración agilicen el proceso de legalización.
              </p>
            </div>
          </div>

          {!stats?.internal_alerts || stats.internal_alerts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-12 h-12 text-[#2d8a58] mx-auto mb-2" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">¡Al día! No hay trámites pendientes de atención inmediata</h3>
              <p className="text-xs text-slate-500 mt-1">Todos los expedientes están al día o han culminado con Carta AGPE.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.internal_alerts.map((al) => (
                <div
                  key={al.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    al.type === 'urgent'
                      ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
                      : al.type === 'warning'
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                      : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                      al.type === 'urgent'
                        ? 'bg-rose-600 text-white'
                        : al.type === 'warning'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-blue-600 text-white'
                    }`}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">{al.code}</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">&bull; {al.client_name}</span>
                        <span className="px-2 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {al.step}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{al.message}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const found = dossiers.find(d => d.id === al.dossier_id);
                      if (found) openDossierDetail(found);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-[#2d8a58] text-white font-bold text-xs transition-colors shrink-0 cursor-pointer self-end sm:self-auto"
                  >
                    Atender Hito &rarr;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INFORME DE AVANCE DE LEGALIZACIONES (ALTAMENTE VISUAL E INTUITIVO) */}
      {activeTab === 'informe' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* 3-Phase Regulatory Pipeline Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-4 mb-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#48bb78] bg-[#2d8a58]/20 px-2.5 py-0.5 rounded-full border border-[#2d8a58]/30">
                  Ruta Regulatoria CREG 174 / 030
                </span>
                <h3 className="text-xl font-black text-white mt-1">Informe Ejecutivo de Avance de Trámites</h3>
                <p className="text-xs text-slate-300">
                  Monitoreo integral de los 9 hitos regulatorios divididos en 3 fases clave para entrega formal de autogeneración.
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-black text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
              >
                <Printer className="w-4 h-4 text-slate-700" />
                <span>Imprimir Informe Oficial</span>
              </button>
            </div>

            {/* 3 Phases Visual Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Fase 1 */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                      Fase 1 &bull; Pasos 1, 2 y 3
                    </span>
                    <FileText className="w-4 h-4 text-amber-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Recolección & Ingeniería Interna</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Cédula, RUT, factura de energía, validación técnica Renova, memorias y plano unifilar.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Completitud promedio:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {dossiers.length > 0 ? Math.round((dossiers.reduce((acc, d) => acc + (d.step1_docs_ok ? 1 : 0) + (d.step_renova_ok ? 1 : 0) + (d.step2_designs_ok ? 1 : 0), 0) / (dossiers.length * 3)) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Fase 2 */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                      Fase 2 &bull; Pasos 4, 5 y 6
                    </span>
                    <Building2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Certificación RETIE & Radicación Operador</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Dictamen ONAC, radicado formal ante empresa distribuidora y concepto técnico de conexión favorable.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Completitud promedio:</span>
                  <span className="font-mono font-bold text-blue-300">
                    {dossiers.length > 0 ? Math.round((dossiers.reduce((acc, d) => acc + (d.step3_retie_ok ? 1 : 0) + (d.step4_radication_ok ? 1 : 0) + (d.step5_approval_ok ? 1 : 0), 0) / (dossiers.length * 3)) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Fase 3 */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      Fase 3 &bull; Pasos 7, 8 y 9
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Visita, Medición & Carta AGPE Final</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Recibo de obra en sitio por operador, medidor bidireccional y entrega de acta oficial de energización AGPE.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Completitud promedio:</span>
                  <span className="font-mono font-bold text-emerald-300">
                    {dossiers.length > 0 ? Math.round((dossiers.reduce((acc, d) => acc + (d.step6_visit_ok ? 1 : 0) + (d.step7_meter_ok ? 1 : 0) + (d.step8_agpe_ok ? 1 : 0), 0) / (dossiers.length * 3)) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Progress Tracker Cards (Client by Client) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#2d8a58]" />
                  <span>Seguimiento Rápido e Individual por Expediente ({dossiers.length})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Semáforo de avance, alertas de inactividad de más de 15 días y acceso directo al detalle de cada cliente.
                </p>
              </div>

              {/* Status and search indicators */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">
                  Mostrando <strong>{dossiers.length}</strong> trámites
                </span>
              </div>
            </div>

            {dossiers.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                <FileCheck2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">No hay trámites para mostrar</h4>
                <p className="text-xs text-slate-400 mt-1">Crea un expediente desde la pestaña principal para ver el informe de avance.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {dossiers.map((d) => {
                  const isFinished = d.status === 'finalizado_agpe' || d.completed_steps === 9;
                  const f1Ok = Boolean(d.step1_docs_ok && d.step_renova_ok && d.step2_designs_ok);
                  const f2Ok = Boolean(d.step3_retie_ok && d.step4_radication_ok && d.step5_approval_ok);
                  const f3Ok = Boolean(d.step6_visit_ok && d.step7_meter_ok && d.step8_agpe_ok);

                  return (
                    <div
                      key={d.id}
                      className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border transition-all hover:shadow-md ${
                        d.is_stagnant
                          ? 'border-rose-300 dark:border-rose-900/80 shadow-xs ring-1 ring-rose-300/40 bg-rose-50/20'
                          : 'border-slate-200 dark:border-slate-800 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left: Client & Core Dossier Info */}
                        <div className="lg:w-1/3 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono font-black text-xs text-[#2d8a58] bg-[#2d8a58]/10 px-2 py-0.5 rounded-md border border-[#2d8a58]/20">
                              {d.expediente_code}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                              {d.operator || 'Afinia'}
                            </span>
                            {isFinished ? (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" /> AGPE Emitida
                              </span>
                            ) : d.is_stagnant ? (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 stroke-[2.5]" /> Inactivo {d.days_inactive} días
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                                En Trámite Activo
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                            {d.client_name}
                          </h4>

                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {d.client_city || 'Sin ciudad'} &bull; {d.installed_power_kwp ? `${d.installed_power_kwp} kWp` : 'Potencia N/D'}
                            {d.nic_number ? <span> &bull; NIC: <strong className="font-mono text-slate-700 dark:text-slate-300">{d.nic_number}</strong></span> : ''}
                          </p>

                          {d.radicado_number && (
                            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                              Radicado OR: <strong>{d.radicado_number}</strong>
                            </p>
                          )}
                        </div>

                        {/* Center: 3 Phase Visual Progress Bar & Chips */}
                        <div className="lg:w-5/12">
                          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                            <span className="text-slate-700 dark:text-slate-300">
                              Progreso Global: <strong className="text-[#2d8a58]">{d.completed_steps} de 9 pasos</strong>
                            </span>
                            <span className="font-mono font-black text-sm text-[#2d8a58]">{d.progress_percentage}%</span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-2">
                            <div
                              className="bg-gradient-to-r from-[#2d8a58] to-[#48bb78] h-full rounded-full transition-all duration-300"
                              style={{ width: `${d.progress_percentage}%` }}
                            />
                          </div>

                          {/* 3 Phase Indicator Pills */}
                          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                            <div className={`p-1.5 rounded-xl border flex items-center justify-center gap-1 ${
                              f1Ok 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}>
                              <span>{f1Ok ? '✓' : '•'} Fase 1 (Docs)</span>
                            </div>

                            <div className={`p-1.5 rounded-xl border flex items-center justify-center gap-1 ${
                              f2Ok 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}>
                              <span>{f2Ok ? '✓' : '•'} Fase 2 (RETIE)</span>
                            </div>

                            <div className={`p-1.5 rounded-xl border flex items-center justify-center gap-1 ${
                              f3Ok 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}>
                              <span>{f3Ok ? '✓' : '•'} Fase 3 (AGPE)</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Fast Action Buttons */}
                        <div className="lg:w-1/4 flex items-center justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => openDossierDetail(d)}
                            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-[#2d8a58] dark:hover:bg-[#2d8a58] text-white font-black text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <span>Gestionar Hitos</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteDossier(d)}
                            className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Eliminar expediente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Embudo de Avance de los 9 Pasos (Visual Step Funnel) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-[#2d8a58]" />
              <span>Embudo General de Cumplimiento Hito por Hito</span>
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Muestra cuántos trámites activos han completado cada uno de los 9 requisitos oficiales.
            </p>

            <div className="space-y-3">
              {stepsConfig.map((s) => {
                const count = stats?.step_progress ? stats.step_progress[`step${s.num}`] : 0;
                const total = stats?.total || 1;
                const pct = Math.round((count / (total || 1)) * 100);

                return (
                  <div key={s.num} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-[#2d8a58]/10 text-[#2d8a58] dark:text-[#48bb78] font-bold flex items-center justify-center text-[10px]">
                          {s.num}
                        </span>
                        <span>{s.title}</span>
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-400 font-bold">
                        {count} de {stats?.total || 0} ({pct}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#2d8a58] h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Master Dossiers Table (For Print and Audit) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Matriz Consolidada de Cumplimiento para Interventoría</h4>
                <p className="text-[11px] text-slate-500">Listado detallado de los 9 pasos para auditoría técnica y regulatoria</p>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Matriz</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Expediente</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Operador</th>
                    <th className="p-3 text-center">1. Docs</th>
                    <th className="p-3 text-center">2. Renova</th>
                    <th className="p-3 text-center">3. Diseños</th>
                    <th className="p-3 text-center">4. RETIE</th>
                    <th className="p-3 text-center">5. Radicación</th>
                    <th className="p-3 text-center">6. Aprobación</th>
                    <th className="p-3 text-center">7. Visita</th>
                    <th className="p-3 text-center">8. Medidor</th>
                    <th className="p-3 text-center">9. AGPE</th>
                    <th className="p-3 text-right">Avance</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dossiers.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-[#2d8a58]">{d.expediente_code}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">{d.client_name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">{d.operator}</td>
                      {stepsConfig.map((s) => {
                        const ok = Boolean(d[s.fieldOk]);
                        return (
                          <td key={s.num} className="p-3 text-center">
                            <span className={`inline-block w-5 h-5 rounded-md font-bold leading-5 ${
                              ok ? 'bg-emerald-100 text-emerald-800 font-black' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {ok ? '✓' : '•'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="p-3 text-right font-mono font-black text-slate-800 dark:text-slate-200">
                        {d.progress_percentage}%
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDossierDetail(d)}
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#2d8a58] text-slate-700 dark:text-slate-300 hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                            title="Editar expediente y gestionar pasos"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDossier(d)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Eliminar expediente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE 8 STEPS OF A DOSSIER */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedDossier ? `Expediente: ${selectedDossier.expediente_code} - ${selectedDossier.client_name}` : 'Expediente'}
        maxWidth="max-w-4xl"
      >
        {selectedDossier && (
          <form onSubmit={handleSaveDossier} className="space-y-5">
            {/* Header info bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cliente & Contrato:</span>
                <h3 className="font-bold text-base leading-tight text-white">{editFormData.client_name || selectedDossier.client_name}</h3>
                <p className="text-xs text-slate-300">
                  {editFormData.client_city || selectedDossier.client_city || 'Sin ciudad'} &bull; Contrato: {selectedDossier.contract_code ? `${selectedDossier.contract_code} (${formatDate(selectedDossier.contract_date)})` : 'Sin contrato formalizado (Apertura directa)'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Progreso:</span>
                  <span className="font-black text-lg text-[#48bb78]">
                    {getFormCompletedCount()} de 9 Pasos ({Math.round((getFormCompletedCount() / 9) * 100)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Editable Client & Technical Parameters */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-3">
              <div className="font-bold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wider">
                Datos del Cliente y Parámetros del Trámite
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre del Cliente *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.client_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, client_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-medium bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={editFormData.client_phone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, client_phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ciudad / Municipio</label>
                  <input
                    type="text"
                    value={editFormData.client_city || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, client_city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-medium bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Operador de Red *</label>
                  <select
                    value={editFormData.operator || 'Afinia'}
                    onChange={(e) => setEditFormData({ ...editFormData, operator: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-bold bg-white dark:bg-slate-800"
                  >
                    <option value="Afinia">Afinia (CaribeMar)</option>
                    <option value="Air-e">Air-e</option>
                    <option value="Enel">Enel Colombia</option>
                    <option value="Celsia">Celsia</option>
                    <option value="EPM">EPM</option>
                    <option value="ESSA">ESSA</option>
                    <option value="EMCALI">EMCALI</option>
                    <option value="CHEC">CHEC</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Potencia (kWp)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.installed_power_kwp || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, installed_power_kwp: e.target.value })}
                    placeholder="Ej. 5.5"
                    className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">NIC / Cuenta</label>
                  <input
                    type="text"
                    value={editFormData.nic_number || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, nic_number: e.target.value })}
                    placeholder="Ej. 2481092"
                    className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">N° Radicado</label>
                  <input
                    type="text"
                    value={editFormData.radicado_number || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, radicado_number: e.target.value })}
                    placeholder="Ej. RAD-2024-9120"
                    className="w-full px-3 py-2 border rounded-xl font-mono bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                  <select
                    value={editFormData.status || 'en_tramite'}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-bold bg-white dark:bg-slate-800"
                  >
                    <option value="en_tramite">En Trámite</option>
                    <option value="finalizado_agpe">Finalizado (Carta AGPE)</option>
                    <option value="detenido">Detenido / En Observación</option>
                  </select>
                </div>
              </div>
            </div>

            {/* THE 8 STEPS WITH CHECKBOX, DATE, AND COMMENTS */}
            <div className="space-y-3">
              <h4 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-[#2d8a58]" />
                <span>Casillas de Verificación de los 9 Pasos Regulatorios</span>
              </h4>

              <div className="space-y-3">
                {stepsConfig.map((s) => {
                  const isOk = Boolean(editFormData[s.fieldOk]);
                  const comments = editFormData[s.fieldComments] || '';
                  const dateVal = editFormData[s.fieldDate] || '';

                  return (
                    <div
                      key={s.num}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        isOk
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                          : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {/* Interactive Checkbox */}
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = !isOk;
                              setEditFormData({
                                ...editFormData,
                                [s.fieldOk]: nextVal,
                                [s.fieldDate]: nextVal && !dateVal ? new Date().toISOString().split('T')[0] : dateVal
                              });
                            }}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer mt-0.5 ${
                              isOk
                                ? 'bg-[#2d8a58] text-white shadow-sm'
                                : 'border-2 border-slate-300 dark:border-slate-600 hover:border-[#2d8a58]'
                            }`}
                          >
                            {isOk && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className={`text-xs font-bold ${isOk ? 'text-[#1c5c3a] dark:text-[#48bb78]' : 'text-slate-800 dark:text-slate-200'}`}>
                                {s.title}
                              </h5>
                              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                {s.tag}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                              {s.desc}
                            </p>
                          </div>
                        </div>

                        {/* Date Picker for the step */}
                        <div className="flex items-center gap-2 text-xs shrink-0 self-start sm:self-center">
                          <label className="text-[11px] font-bold text-slate-500">Fecha:</label>
                          <input
                            type="date"
                            value={dateVal}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              [s.fieldDate]: e.target.value
                            })}
                            className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      {/* Comments text box for the step */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                        <input
                          type="text"
                          value={comments}
                          onChange={(e) => setEditFormData({
                            ...editFormData,
                            [s.fieldComments]: e.target.value
                          })}
                          placeholder={`Comentarios u observaciones para ${s.title.toLowerCase()}... (ej. Núm de dictamen, respuesta del operador, pendientes)`}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#2d8a58]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* General notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notas Generales del Trámite / Observaciones de Ingeniería
              </label>
              <textarea
                rows="2"
                value={editFormData.general_notes}
                onChange={(e) => setEditFormData({ ...editFormData, general_notes: e.target.value })}
                placeholder="Datos del transformador, detalles de la acometida, contacto del inspector del operador..."
                className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-900"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleDeleteDossier(selectedDossier)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar Expediente
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={savingDossier}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#2d8a58] hover:bg-[#237348] rounded-xl shadow-md shadow-[#2d8a58]/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingDossier ? 'Guardando...' : 'Guardar Cambios del Expediente'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: OPEN NEW EXPEDIENTE (CLIENT NAME OR CONTRACT) */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Aperturar Nuevo Expediente de Legalización"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateDossier} className="space-y-4">
          <p className="text-xs text-slate-500">
            Puedes abrir un expediente ingresando directamente el nombre del cliente o vinculándolo a un contrato de obra formalizado.
          </p>

          {/* Mode Selector */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setNewDossierMode('client')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                newDossierMode === 'client'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              1. Por Nombre de Cliente
            </button>
            <button
              type="button"
              onClick={() => setNewDossierMode('contract')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                newDossierMode === 'contract'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              2. Vincular a Contrato Existente
            </button>
          </div>

          {newDossierMode === 'client' ? (
            <div className="space-y-3">
              {/* Option to pick from existing registered clients */}
              {clients.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Seleccionar Cliente Registrado (Recomendado)</span>
                    <span className="text-[10px] text-[#2d8a58] font-bold">Autocompleta datos y potencia</span>
                  </label>
                  <select
                    value={newDossierData.client_id || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleClientSelect(e.target.value);
                      } else {
                        setNewDossierData(prev => ({ ...prev, client_id: '' }));
                      }
                    }}
                    className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <option value="">-- Selecciona de clientes registrados o escribe abajo --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? `(${c.city})` : ''} {c.latest_installed_power_kwp ? `• ${c.latest_installed_power_kwp} kWp` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={newDossierData.client_name}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  placeholder="Escribe el nombre del cliente..."
                  className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Puedes seleccionar un cliente existente arriba para autocompletar sus datos o escribir un nombre nuevo directamente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={newDossierData.client_phone}
                    onChange={(e) => setNewDossierData({ ...newDossierData, client_phone: e.target.value })}
                    placeholder="Ej. 3001234567"
                    className="w-full px-3.5 py-2 border rounded-xl text-xs font-mono bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={newDossierData.client_city}
                    onChange={(e) => setNewDossierData({ ...newDossierData, client_city: e.target.value })}
                    placeholder="Ej. Barranquilla"
                    className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Potencia Est. (kWp)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newDossierData.installed_power_kwp}
                    onChange={(e) => setNewDossierData({ ...newDossierData, installed_power_kwp: e.target.value })}
                    placeholder="Ej. 5.5"
                    className="w-full px-3.5 py-2 border rounded-xl text-xs font-mono bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contrato Formalizado *
              </label>
              {loadingEligible ? (
                <p className="text-xs text-slate-400 italic">Cargando contratos disponibles...</p>
              ) : (modalContracts.length > 0 ? modalContracts : eligibleContracts).length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  Todos los contratos formalizados ya cuentan con un expediente activo o no hay contratos disponibles.
                </div>
              ) : (
                <select
                  required
                  value={newDossierData.contract_id}
                  onChange={(e) => handleContractSelect(e.target.value)}
                  className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
                >
                  <option value="">-- Selecciona un contrato --</option>
                  {(modalContracts.length > 0 ? modalContracts : eligibleContracts).map((c) => (
                    <option key={c.contract_id} value={c.contract_id}>
                      {c.contract_code} &bull; {c.client_name} ({c.client_city || 'Sin ciudad'}) - {formatCOP(c.total_contract_value)} {c.legalization_included === 0 ? ' [Sin legalización en cotización]' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Operador de Red *
              </label>
              <select
                value={newDossierData.operator || 'Afinia'}
                onChange={(e) => setNewDossierData({ ...newDossierData, operator: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold bg-white dark:bg-slate-800"
              >
                <option value="Afinia">Afinia (CaribeMar)</option>
                <option value="Air-e">Air-e</option>
                <option value="Enel">Enel Colombia</option>
                <option value="Celsia">Celsia</option>
                <option value="EPM">EPM</option>
                <option value="ESSA">ESSA</option>
                <option value="EMCALI">EMCALI</option>
                <option value="CHEC">CHEC</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                NIC / Cuenta Operador
              </label>
              <input
                type="text"
                value={newDossierData.nic_number}
                onChange={(e) => setNewDossierData({ ...newDossierData, nic_number: e.target.value })}
                placeholder="Ej. 2481092"
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-mono bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                N° de Radicado Inicial
              </label>
              <input
                type="text"
                value={newDossierData.radicado_number}
                onChange={(e) => setNewDossierData({ ...newDossierData, radicado_number: e.target.value })}
                placeholder="Opcional (si ya fue radicado)"
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-mono bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Código Transformador
              </label>
              <input
                type="text"
                value={newDossierData.transformer_code}
                onChange={(e) => setNewDossierData({ ...newDossierData, transformer_code: e.target.value })}
                placeholder="Ej. TR-54910"
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-mono bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Instrucciones / Notas de Apertura
            </label>
            <textarea
              rows="2"
              value={newDossierData.general_notes}
              onChange={(e) => setNewDossierData({ ...newDossierData, general_notes: e.target.value })}
              placeholder="Detalles sobre el punto de conexión o particularidades del proyecto..."
              className="w-full px-3.5 py-2 border rounded-xl text-xs bg-white dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={newDossierMode === 'contract' ? !newDossierData.contract_id : !newDossierData.client_name?.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-[#2d8a58] hover:bg-[#237348] rounded-xl shadow cursor-pointer disabled:opacity-50"
            >
              Aperturar Expediente
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
