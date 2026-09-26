import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  Calendar,
  Clock,
  Plus,
  Search,
  User,
  MapPin,
  Phone,
  Zap,
  Layers,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Eye,
  Edit2,
  Trash2,
  Sparkles,
  Wifi,
  SunMedium,
  Printer,
  MessageSquare,
  Building2,
  ShieldCheck,
  Save,
  Check,
  ChevronRight,
  ChevronLeft,
  Compass,
  FileText,
  SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCOP, formatDate, formatKW, getSystemTypeName, getRoofTypeName } from '../utils/formatters';
import Modal from '../components/Modal';

export default function Visitas({ onNotify, onStatsUpdate }) {
  const { authFetch, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab in list mode: 'scheduled', 'realizadas', 'all', 'cancelled'
  const currentTab = searchParams.get('tab') || 'scheduled';

  // View mode: 'list' | 'survey' | 'print'
  const [viewMode, setViewMode] = useState('list');
  const [listDisplayMode, setListDisplayMode] = useState('cards'); // 'cards' or 'table'
  const [activeVisit, setActiveVisit] = useState(null);

  const [visits, setVisits] = useState([]);
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [companySettings, setCompanySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal: Schedule new visit
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    client_id: '',
    user_id: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '09:00 AM',
    operator: 'Afinia',
    voltage_level: 'Bifásica 120/240V',
    client_consumption_kwh: 0,
    technician_notes: ''
  });

  // Survey In-Page State
  const [surveyData, setSurveyData] = useState({});
  const [surveyStep, setSurveyStep] = useState('electrico'); // 'electrico', 'techo', 'equipos', 'diagnostico'
  const [savingSurvey, setSavingSurvey] = useState(false);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (currentTab !== 'all') {
        if (currentTab === 'realizadas') query.append('status', 'realizadas');
        else if (currentTab === 'scheduled') query.append('status', 'agendada');
        else if (currentTab === 'cancelled') query.append('status', 'cancelada');
      }
      if (searchTerm) query.append('search', searchTerm);

      const res = await authFetch(`/api/visits?${query.toString()}`);
      const data = await res.json();
      setVisits(data.visits || []);
      setStats(data.stats || null);

      if (onStatsUpdate && data.stats) {
        onStatsUpdate((prev) => ({
          ...prev,
          scheduled_visits_count: data.stats.scheduled_count || 0,
          pending_visits_to_quote_count: data.stats.pending_quote_count || 0
        }));
      }
    } catch (err) {
      console.error('Error fetching visits:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [resClients, resUsers, resSettings] = await Promise.all([
        authFetch('/api/clients'),
        authFetch('/api/auth/users'),
        authFetch('/api/settings')
      ]);
      const dataClients = await resClients.json();
      const dataUsers = await resUsers.json();
      const dataSettings = await resSettings.json();
      setClients(dataClients.clients || []);
      setTechnicians(dataUsers.users || []);
      setCompanySettings(dataSettings.settings || null);
    } catch (e) {
      console.error('Error fetching master data:', e);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (viewMode === 'list') {
      fetchVisits();
    }
  }, [currentTab, viewMode]);

  // Auto-open survey if visitId is in URL (e.g. from Dashboard "Realizar" button)
  useEffect(() => {
    const visitIdParam = searchParams.get('visitId');
    if (visitIdParam) {
      const loadVisitForSurvey = async () => {
        try {
          const res = await authFetch(`/api/visits/${visitIdParam}`);
          const data = await res.json();
          if (data.visit) {
            openInPageSurvey(data.visit);
          }
        } catch (err) {
          console.error('Error fetching visit for direct survey:', err);
        }
      };
      loadVisitForSurvey();
    }
  }, [searchParams.get('visitId')]);

  // Auto-open schedule modal if action=new is in URL
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      const cId = searchParams.get('clientId');
      openNewSchedule(cId);
      setSearchParams({ tab: currentTab }, { replace: true });
    }
  }, [searchParams.get('action'), clients.length]);

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchVisits();
  };

  // Open Schedule Modal
  const openNewSchedule = (preselectedClientId) => {
    const targetClientId = preselectedClientId || searchParams.get('clientId') || (clients[0] ? clients[0].id.toString() : '');
    const foundClient = clients.find(c => c.id.toString() === targetClientId?.toString());
    setScheduleData({
      client_id: targetClientId || '',
      user_id: user?.id ? user.id.toString() : (technicians[0]?.id ? technicians[0].id.toString() : ''),
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '09:00 AM',
      operator: foundClient?.operator || 'Afinia',
      voltage_level: foundClient?.voltage_level || 'Bifásica 120/240V',
      client_consumption_kwh: 0,
      technician_notes: ''
    });
    setIsScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/visits', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agendar visita');

      if (onNotify) onNotify({ type: 'success', message: `Visita ${data.visit_code} agendada con éxito.` });
      setIsScheduleModalOpen(false);
      fetchVisits();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  // Roof section helpers
  const recalculateRoofSections = (sections) => {
    let totalArea = 0;
    let totalPanels = 0;
    for (const s of sections) {
      const a = parseFloat(s.area) || ((parseFloat(s.largo) || 0) * (parseFloat(s.ancho) || 0));
      totalArea += a;
      totalPanels += (parseInt(s.estimated_panels, 10) || 0);
    }
    totalArea = Math.round(totalArea * 100) / 100;
    setSurveyData((prev) => ({
      ...prev,
      roof_sections: sections,
      available_area_m2: totalArea,
      estimated_panels_total: totalPanels
    }));
  };

  const addRoofSection = () => {
    const current = surveyData.roof_sections || [];
    const newSec = {
      id: Date.now(),
      name: `Cubierta ${current.length + 1}`,
      largo: '',
      ancho: '',
      area: 0,
      estimated_panels: ''
    };
    const updated = [...current, newSec];
    recalculateRoofSections(updated);
  };

  const removeRoofSection = (index) => {
    const current = surveyData.roof_sections || [];
    if (current.length <= 1) return;
    const updated = current.filter((_, i) => i !== index);
    recalculateRoofSections(updated);
  };

  const handleRoofSectionChange = (index, field, value) => {
    const current = [...(surveyData.roof_sections || [])];
    const item = { ...current[index] };
    if (field === 'largo' || field === 'ancho') {
      const numVal = value === '' ? '' : (parseFloat(value) || 0);
      item[field] = numVal;
      const l = field === 'largo' ? (parseFloat(value) || 0) : (parseFloat(item.largo) || 0);
      const w = field === 'ancho' ? (parseFloat(value) || 0) : (parseFloat(item.ancho) || 0);
      item.area = Math.round(l * w * 100) / 100;
      if (!item.panelsTouched) {
        item.estimated_panels = Math.round(item.area / 2.6);
      }
    } else if (field === 'estimated_panels') {
      item.estimated_panels = value === '' ? '' : (parseInt(value, 10) || 0);
      item.panelsTouched = true;
    } else if (field === 'name') {
      item.name = value;
    }
    current[index] = item;
    recalculateRoofSections(current);
  };

  // Switch to In-Page Survey Mode (Mobile-friendly, no popup)
  const openInPageSurvey = (visit) => {
    setActiveVisit(visit);

    let initialRoofSections = [];
    if (Array.isArray(visit.roof_sections) && visit.roof_sections.length > 0) {
      initialRoofSections = visit.roof_sections;
    } else if (visit.roof_sections_json) {
      try {
        const parsed = JSON.parse(visit.roof_sections_json);
        if (Array.isArray(parsed) && parsed.length > 0) initialRoofSections = parsed;
      } catch (e) {}
    }
    if (initialRoofSections.length === 0) {
      const initialArea = parseFloat(visit.available_area_m2) || 50;
      initialRoofSections = [{
        id: 1,
        name: 'Cubierta 1',
        largo: 10,
        ancho: Math.round((initialArea / 10) * 10) / 10,
        area: initialArea,
        estimated_panels: Math.round(initialArea / 2.6)
      }];
    }

    setSurveyData({
      scheduled_date: visit.scheduled_date || new Date().toISOString().split('T')[0],
      scheduled_time: visit.scheduled_time || '09:00 AM',
      user_id: visit.user_id || user?.id,
      operator: visit.operator || 'Afinia',
      voltage_level: visit.voltage_level || 'Bifásica 120/240V',
      totalizer_breaker_amps: visit.totalizer_breaker_amps || 50,
      transformer_type: visit.transformer_type || 'compartido',
      transformer_kva: visit.transformer_kva || 25,
      main_board_location: visit.main_board_location || '',
      grounding_system_status: visit.grounding_system_status || 'bueno',
      distance_roof_to_board_m: visit.distance_roof_to_board_m !== undefined ? visit.distance_roof_to_board_m : 15,
      distance_inverter_to_board_m: visit.distance_inverter_to_board_m !== undefined ? visit.distance_inverter_to_board_m : 15,
      client_consumption_kwh: visit.client_consumption_kwh || 0,
      roof_type: visit.roof_type || 'teja_colonial_barro',
      roof_condition: visit.roof_condition || 'buena',
      beams_condition: visit.beams_condition || 'buena',
      roof_slope_deg: visit.roof_slope_deg !== undefined ? visit.roof_slope_deg : 15,
      roof_orientation: visit.roof_orientation || 'Sur',
      available_area_m2: visit.available_area_m2 || 50,
      roof_sections: initialRoofSections,
      estimated_panels_total: visit.estimated_panels_total || Math.round((visit.available_area_m2 || 50) / 2.6),
      structure_condition: visit.structure_condition || 'bueno',
      structure_material: visit.structure_material || 'metalica',
      shading_level: visit.shading_level || 'ninguno',
      inverter_location: visit.inverter_location || '',
      battery_location: visit.battery_location || '',
      has_internet_wifi: visit.has_internet_wifi !== undefined ? visit.has_internet_wifi : 1,
      wifi_signal_strength: visit.wifi_signal_strength || 'Buena',
      recommended_system_type: visit.recommended_system_type || 'ongrid',
      recommended_structure_type: visit.recommended_structure_type || 'Estructura de aluminio sobre tejado',
      photo_meter_ok: visit.photo_meter_ok !== undefined ? Boolean(visit.photo_meter_ok) : false,
      photo_transformer_ok: visit.photo_transformer_ok !== undefined ? Boolean(visit.photo_transformer_ok) : false,
      energy_bill_ok: visit.energy_bill_ok !== undefined ? Boolean(visit.energy_bill_ok) : false,
      technician_notes: visit.technician_notes || ''
    });
    setSurveyStep('electrico');
    setViewMode('survey');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Switch to In-Page Printable / PDF Mode
  const openPrintView = (visit) => {
    setActiveVisit(visit);
    setViewMode('print');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseSurvey = () => {
    setViewMode('list');
    setActiveVisit(null);
    if (searchParams.get('visitId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('visitId');
      newParams.set('tab', currentTab);
      setSearchParams(newParams);
    }
  };

  const handleClosePrint = () => {
    setViewMode('list');
    setActiveVisit(null);
    if (searchParams.get('visitId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('visitId');
      newParams.set('tab', currentTab);
      setSearchParams(newParams);
    }
  };

  // Save Survey (draft or complete)
  const handleSaveSurvey = async (markAsCompleted = true) => {
    if (!activeVisit) return;
    try {
      setSavingSurvey(true);
      const res = await authFetch(`/api/visits/${activeVisit.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...surveyData,
          markAsCompleted
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar formato');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: markAsCompleted
            ? `Levantamiento técnico ${activeVisit.visit_code} completado con éxito.`
            : `Borrador de levantamiento guardado con éxito.`
        });
      }

      if (markAsCompleted) {
        handleCloseSurvey();
        setSearchParams({ tab: 'realizadas' });
        fetchVisits();
      } else {
        setActiveVisit((prev) => ({ ...prev, ...surveyData }));
      }
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setSavingSurvey(false);
    }
  };

  // Delete Visit
  const handleDeleteVisit = async (visitId, code) => {
    if (!window.confirm(`¿Seguro que deseas eliminar la visita ${code}?`)) return;
    try {
      const res = await authFetch(`/api/visits/${visitId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      if (onNotify) onNotify({ type: 'success', message: `Visita ${code} eliminada.` });
      fetchVisits();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  // Quick WhatsApp link
  const handleClientWhatsApp = (phone, name, code) => {
    if (!phone) return alert('El cliente no tiene teléfono registrado.');
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const text = encodeURIComponent(
      `Hola ${name}, te saludamos de Renova Energy para coordinar los detalles de tu visita técnica y levantamiento solar ${code}.`
    );
    window.open(`https://wa.me/${phoneWithCode}?text=${text}`, '_blank');
  };

  // Print function
  const triggerPrint = () => {
    window.print();
  };

  // ==========================================
  // RENDER: PRINTABLE PDF ACTA DE VISITA
  // ==========================================
  if (viewMode === 'print' && activeVisit) {
    const v = activeVisit;
    const isQuoted = v.status === 'cotizada';
    const isPendingQuote = v.status === 'realizada_pendiente_cotizar';

    let printRoofSections = [];
    if (Array.isArray(v.roof_sections) && v.roof_sections.length > 0) {
      printRoofSections = v.roof_sections;
    } else if (v.roof_sections_json) {
      try {
        const parsed = JSON.parse(v.roof_sections_json);
        if (Array.isArray(parsed) && parsed.length > 0) printRoofSections = parsed;
      } catch (e) {}
    }
    if (printRoofSections.length === 0) {
      printRoofSections = [{
        name: 'Cubierta General',
        largo: '-',
        ancho: '-',
        area: v.available_area_m2 || 0,
        estimated_panels: v.estimated_panels_total || Math.round((v.available_area_m2 || 0) / 2.6)
      }];
    }

    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        {/* Top Control Bar (Hidden on print) */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs no-print">
          <div className="flex items-center gap-2">
            <button
              onClick={handleClosePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Visitas</span>
            </button>
            <button
              onClick={() => openInPageSurvey(v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#2d8a58] hover:bg-[#2d8a58]/10 transition-colors cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
              <span>Editar Levantamiento</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={triggerPrint}
              className="px-5 py-2 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-[#2d8a58]/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar como PDF</span>
            </button>
          </div>
        </div>

        {/* Official Printable Sheet Container */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-md print:border-none print:shadow-none print:p-0 print:m-0 text-slate-800 font-['Plus_Jakarta_Sans',sans-serif]">
          {/* Header with Renova Energy Brand */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-4 border-[#2d8a58] pb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2d8a58] to-[#48bb78] flex items-center justify-center text-white font-black shadow-lg shadow-[#2d8a58]/20">
                  <Zap className="w-7 h-7 fill-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                    RENOVA ENERGY S.A.S.
                  </h1>
                  <span className="text-xs font-bold text-[#2d8a58] tracking-wide">
                    ENERGÍA SOLAR PARA TODOS
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                NIT: {companySettings?.nit || '901.458.789-1'} &bull; Régimen Común &bull; {companySettings?.address || 'Cra 15 # 85-30 Of. 402, Bogotá D.C.'}
              </p>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                PBX: {companySettings?.phone || '+57 (601) 745-8900'} &bull; {companySettings?.email || 'ventas@renovaenergy.com.co'} &bull; {companySettings?.website || 'www.renovaenergy.com.co'}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1 rounded-full bg-[#2d8a58]/15 text-[#1c5c3a] font-black text-xs tracking-wider border border-[#2d8a58]/30">
                ACTA DE VISITA TÉCNICA SOLAR
              </span>
              <div className="text-lg font-black font-mono text-slate-900 mt-1">
                {v.visit_code}
              </div>
              <div className="text-xs text-slate-600">
                Fecha Visita: <strong className="text-slate-900">{formatDate(v.scheduled_date)}</strong> - {v.scheduled_time}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Estado: <strong className="text-[#2d8a58]">{v.status === 'agendada' ? 'Agendada' : v.status === 'cancelada' ? 'Cancelada' : 'Levantamiento Realizado'}</strong>
              </div>
            </div>
          </div>

          {/* Client & General Info Grid */}
          <div className="my-6 p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <h3 className="text-xs font-black text-[#2d8a58] uppercase tracking-wider mb-3">
              Información del Cliente y Ubicación del Predio
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Cliente / Razón Social:</span>
                <span className="font-bold text-slate-900 text-sm">{v.client_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Identificación / NIT:</span>
                <span className="font-semibold text-slate-800">{v.client_doc_type || 'CC'} {v.client_doc_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Teléfono de Contacto:</span>
                <span className="font-semibold text-slate-800">{v.client_phone || 'Sin teléfono'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Dirección del Predio:</span>
                <span className="font-semibold text-slate-800">{v.client_address || 'No especificada'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Ciudad / Municipio:</span>
                <span className="font-semibold text-slate-800">{v.client_city || 'Colombia'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Operador de Red (OR):</span>
                <span className="font-bold text-[#2d8a58]">{v.operator || 'Afinia'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block text-[11px]">Técnico / Ingeniero de Levantamiento:</span>
                <span className="font-bold text-slate-900">{v.technician_name || user?.name || 'Ingeniero Renova Energy'}</span>
              </div>
            </div>
          </div>

          {/* Section 1: Electrical Parameters */}
          <div className="mb-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b-2 border-slate-200 pb-1.5 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#2d8a58]" />
              <span>1. Parámetros Eléctricos y Acometida</span>
            </h3>
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50 w-1/3">Nivel de Tensión / Acometida:</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{v.voltage_level || 'Bifásica 120/240V'}</td>
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50 w-1/4">Breaker Totalizador:</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{v.totalizer_breaker_amps || 50} Amperios</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Tipo de Transformador:</td>
                  <td className="py-2 px-3 text-slate-900 capitalize">{v.transformer_type === 'propio' ? 'Propio / Dedicado' : 'Compartido con Operador'}</td>
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Capacidad Transformador:</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{v.transformer_kva || 25} kVA</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Sistema Puesta a Tierra (SPT):</td>
                  <td className="py-2 px-3 font-bold text-slate-900 capitalize">
                    {v.grounding_system_status === 'bueno' ? '✅ Bueno (Varilla conectada)' :
                     v.grounding_system_status === 'regular' ? '⚠️ Regular (Ajustar)' :
                     v.grounding_system_status === 'malo' ? '❌ Malo (Hincar nueva varilla)' : 'Inexistente'}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Distancia String (Paneles a Inversor):</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{v.distance_roof_to_board_m !== undefined ? v.distance_roof_to_board_m : 15} Metros</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Distancia Inversor a Tablero:</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{v.distance_inverter_to_board_m !== undefined ? v.distance_inverter_to_board_m : 15} Metros</td>
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Consumo Registrado Factura:</td>
                  <td className="py-2 px-3 font-bold text-[#2d8a58]">{v.client_consumption_kwh ? `${v.client_consumption_kwh} kWh/mes` : 'No registrado'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Ubicación Tablero AC:</td>
                  <td colSpan="3" className="py-2 px-3 text-slate-800">{v.main_board_location || 'Garaje / Tablero general'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Roof & Structure */}
          <div className="mb-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b-2 border-slate-200 pb-1.5 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2d8a58]" />
              <span>2. Cubierta, Techo y Estructura</span>
            </h3>
            <table className="w-full text-xs border-collapse mb-3">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50 w-1/3">Tipo de Cubierta:</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{getRoofTypeName(v.roof_type)}</td>
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50 w-1/4">Estado de la Cubierta:</td>
                  <td className="py-2 px-3 font-bold">
                    {v.roof_condition === 'mala' ? <span className="text-amber-700">⚠️ Mala</span> : <span className="text-[#2d8a58]">✅ Buena</span>}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Orientación de Techo:</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{v.roof_orientation || 'Sur'}</td>
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Inclinación Estimada:</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{v.roof_slope_deg || 15}°</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Material de Vigas / Cerchas:</td>
                  <td className="py-2 px-3 text-slate-900 capitalize">{v.structure_material || 'Metálica'}</td>
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Estado de las Vigas:</td>
                  <td className="py-2 px-3 font-bold">
                    {v.beams_condition === 'mala' ? <span className="text-amber-700">⚠️ Mala</span> : <span className="text-[#2d8a58]">✅ Buena</span>}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Nivel de Sombreamiento:</td>
                  <td colSpan="3" className="py-2 px-3 text-slate-900 capitalize">{v.shading_level || 'Ninguno'}</td>
                </tr>
              </tbody>
            </table>

            {/* Medidas y Desglose de Cubiertas */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 py-1.5 px-3 font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center justify-between">
                <span>Medidas de Cubiertas y Paneles Estimados</span>
                <span>{printRoofSections.length} {printRoofSections.length === 1 ? 'cubierta' : 'cubiertas'}</span>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-1.5 px-3 text-left font-semibold">Cubierta</th>
                    <th className="py-1.5 px-3 text-center font-semibold">Largo (m)</th>
                    <th className="py-1.5 px-3 text-center font-semibold">Ancho (m)</th>
                    <th className="py-1.5 px-3 text-center font-semibold">Área (m²)</th>
                    <th className="py-1.5 px-3 text-center font-semibold">Paneles Estimados</th>
                  </tr>
                </thead>
                <tbody>
                  {printRoofSections.map((sec, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="py-1.5 px-3 font-semibold text-slate-800">{sec.name || `Cubierta ${idx + 1}`}</td>
                      <td className="py-1.5 px-3 text-center text-slate-700">{sec.largo || '-'}</td>
                      <td className="py-1.5 px-3 text-center text-slate-700">{sec.ancho || '-'}</td>
                      <td className="py-1.5 px-3 text-center font-bold text-slate-900">{sec.area || 0} m²</td>
                      <td className="py-1.5 px-3 text-center font-black text-[#2d8a58]">{sec.estimated_panels || 0}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/70 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan="3" className="py-2 px-3 text-right uppercase text-[11px]">Totales Consolidados:</td>
                    <td className="py-2 px-3 text-center text-[#2d8a58] font-black">{v.available_area_m2 || 0} m²</td>
                    <td className="py-2 px-3 text-center text-[#2d8a58] font-black">{v.estimated_panels_total || 0} paneles</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Equipment & Connectivity */}
          <div className="mb-6">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b-2 border-slate-200 pb-1.5 mb-3 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-[#2d8a58]" />
              <span>3. Ubicación de Equipos y Comunicaciones</span>
            </h3>
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50 w-1/3">Espacio para Inversores:</td>
                  <td className="py-2 px-3 text-slate-900">{v.inverter_location || 'Pared exterior ventilada / Garaje'}</td>
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50 w-1/4">Señal WiFi / Internet:</td>
                  <td className="py-2 px-3 font-bold text-slate-900">{v.wifi_signal_strength || 'Buena'}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-600 bg-slate-50/50">Espacio para Baterías:</td>
                  <td colSpan="3" className="py-2 px-3 text-slate-900">{v.battery_location || 'Piso firme nivelado bajo techo libre de humedad'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 4: Recommended System & Diagnosis */}
          <div className="mb-8">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b-2 border-slate-200 pb-1.5 mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#2d8a58]" />
              <span>4. Dictamen Técnico y Sistema Recomendado</span>
            </h3>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500 block text-[11px]">Sistema Solar Sugerido por el Técnico:</span>
                  <span className="text-sm font-black text-[#2d8a58] block mt-0.5">
                    {getSystemTypeName(v.recommended_system_type || 'ongrid')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Estructura de Montaje Recomendada:</span>
                  <span className="font-bold text-slate-900 block mt-0.5">
                    {v.recommended_structure_type || 'Estructura de aluminio sobre tejado'}
                  </span>
                </div>
              </div>

              {v.technician_notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block text-[11px] font-bold">Observaciones y Dictamen de Campo:</span>
                  <p className="text-slate-800 text-xs italic mt-1 whitespace-pre-wrap leading-relaxed">
                    "{v.technician_notes}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Checklists Fotográfico y Documental Requerido */}
          <div className="mb-8 print-avoid-break">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b-2 border-slate-200 pb-1.5 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2d8a58]" />
              <span>5. Registro Fotográfico y Documental Requerido</span>
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { title: '1. Foto Medidor', ok: Boolean(v.photo_meter_ok), desc: 'Lectura y número de serie nítido' },
                { title: '2. Foto Transformador', ok: Boolean(v.photo_transformer_ok), desc: 'Poste o placa de características' },
                { title: '3. Recibo de Energía', ok: Boolean(v.energy_bill_ok), desc: 'Última factura completa con NIC' }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 ${
                    item.ok
                      ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a]'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-xs shrink-0 ${
                    item.ok ? 'bg-[#2d8a58] text-white' : 'border border-slate-300 text-slate-400 bg-white'
                  }`}>
                    {item.ok ? '✓' : ''}
                  </span>
                  <div>
                    <span className="font-black block text-xs leading-snug">{item.title}</span>
                    <span className="text-[10px] text-slate-500 block leading-tight">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signatures Block */}
          <div className="pt-8 border-t-2 border-slate-200 mt-10">
            <div className="grid grid-cols-2 gap-12 text-center text-xs">
              <div>
                <div className="border-b-2 border-slate-400 w-4/5 mx-auto mb-2 h-16"></div>
                <p className="font-bold text-slate-900">{v.technician_name || 'Ingeniero Instalador'}</p>
                <p className="text-slate-500 text-[11px]">Técnico / Ingeniero Levantamiento</p>
                <p className="text-slate-400 text-[10px]">RENOVA ENERGY S.A.S. &bull; Matrícula Profesional Conte/Copnia</p>
              </div>

              <div>
                <div className="border-b-2 border-slate-400 w-4/5 mx-auto mb-2 h-16"></div>
                <p className="font-bold text-slate-900">{v.client_name}</p>
                <p className="text-slate-500 text-[11px]">Firma y Aceptación del Cliente</p>
                <p className="text-slate-400 text-[10px]">C.C. {v.client_doc_number || '_____________________'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MOBILE-FIRST IN-PAGE SURVEY VIEW
  // (NO MODAL / DIRECTLY ON PAGE)
  // ==========================================
  if (viewMode === 'survey' && activeVisit) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 pb-32 pt-1 animate-fadeIn">
        {/* Sticky Mobile Header */}
        <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
          <button
            onClick={handleCloseSurvey}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 px-2 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>

          <div className="text-center min-w-0">
            <span className="font-mono text-[10px] font-black text-[#2d8a58] bg-[#2d8a58]/10 px-2 py-0.5 rounded-md inline-block">
              {activeVisit.visit_code}
            </span>
            <h2 className="text-xs font-black text-slate-900 truncate">
              Levantamiento Técnico
            </h2>
          </div>

          <button
            onClick={() => openPrintView(activeVisit)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition-all cursor-pointer shrink-0"
            title="Ver e Imprimir Acta"
          >
            <Printer className="w-3.5 h-3.5 text-[#2d8a58]" />
            <span className="hidden sm:inline">Imprimir Acta</span>
          </button>
        </div>

        {/* Client Quick Info Banner for Field Technicians */}
        <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black text-[#48bb78] uppercase tracking-wider block">
              Cliente a Visitar:
            </span>
            <h3 className="text-base font-black text-white leading-tight mt-0.5">
              {activeVisit.client_name}
            </h3>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#48bb78] shrink-0" />
              <span>{activeVisit.client_address || 'Dirección no especificada'} &bull; {activeVisit.client_city || 'Colombia'}</span>
            </p>
          </div>

          {activeVisit.client_phone && (
            <div className="flex items-center gap-2 self-start sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
              <a
                href={`tel:${activeVisit.client_phone}`}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Phone className="w-3.5 h-3.5 text-[#48bb78]" />
                <span>Llamar</span>
              </a>
              <button
                type="button"
                onClick={() => handleClientWhatsApp(activeVisit.client_phone, activeVisit.client_name, activeVisit.visit_code)}
                className="px-3 py-2 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>
          )}
        </div>

        {/* Stepper Tabs - Mobile Thumb-Friendly */}
        <div className="grid grid-cols-4 gap-1.5 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
          {[
            { id: 'electrico', label: '1. Eléctrico', icon: Zap },
            { id: 'techo', label: '2. Cubierta', icon: Layers },
            { id: 'equipos', label: '3. Equipos', icon: Wifi },
            { id: 'diagnostico', label: '4. Diagnóstico', icon: Wrench }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = surveyStep === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSurveyStep(tab.id)}
                className={`py-2.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 text-center cursor-pointer ${
                  isActive
                    ? 'bg-[#2d8a58] text-white shadow-md shadow-[#2d8a58]/25'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-[11px] sm:text-xs truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* STEP 1: PARÁMETROS ELÉCTRICOS */}
        {surveyStep === 'electrico' && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5 animate-fadeIn">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#2d8a58]" />
                1. Parámetros Eléctricos y Acometida
              </h3>
              <p className="text-xs text-slate-500">Toca las opciones para registrar los datos rápidamente desde el celular.</p>
            </div>

            {/* Voltage / Acometida Segmented Buttons */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Nivel de Tensión / Acometida
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Monofásica 120V',
                  'Bifásica 120/240V',
                  'Trifásica 208V/120V',
                  'Trifásica 440V/220V'
                ].map((volt) => (
                  <button
                    key={volt}
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, voltage_level: volt })}
                    className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all text-left flex items-center justify-between cursor-pointer ${
                      surveyData.voltage_level === volt
                        ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a] ring-2 ring-[#2d8a58]/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50'
                    }`}
                  >
                    <span>{volt}</span>
                    {surveyData.voltage_level === volt && <Check className="w-4 h-4 text-[#2d8a58]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Breaker Totalizador AC */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Capacidad Breaker Totalizador (Amperios)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[30, 40, 50, 60, 70, 100, 150, 200].map((amps) => (
                  <button
                    key={amps}
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, totalizer_breaker_amps: amps })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      surveyData.totalizer_breaker_amps === amps
                        ? 'bg-[#2d8a58] text-white border-[#2d8a58]'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {amps}A
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={surveyData.totalizer_breaker_amps || 50}
                onChange={(e) => setSurveyData({ ...surveyData, totalizer_breaker_amps: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#2d8a58] focus:outline-none"
                placeholder="Otro amperaje..."
              />
            </div>

            {/* Transformador */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tipo de Transformador
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'compartido', label: 'Compartido (Red)' },
                    { id: 'propio', label: 'Propio / Dedicado' }
                  ].map((tr) => (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => setSurveyData({ ...surveyData, transformer_type: tr.id })}
                      className={`p-2.5 rounded-xl text-xs font-bold border text-center cursor-pointer ${
                        surveyData.transformer_type === tr.id
                          ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a]'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {tr.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Capacidad Transformador (kVA)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {[15, 25, 37.5, 45, 75, 112.5].map((kva) => (
                    <button
                      key={kva}
                      type="button"
                      onClick={() => setSurveyData({ ...surveyData, transformer_kva: kva })}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        surveyData.transformer_kva === kva
                          ? 'bg-[#2d8a58] text-white border-[#2d8a58]'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {kva}kVA
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={surveyData.transformer_kva || 25}
                  onChange={(e) => setSurveyData({ ...surveyData, transformer_kva: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#2d8a58]"
                />
              </div>
            </div>

            {/* SPT (Puesta a Tierra) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Sistema de Puesta a Tierra (SPT)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'bueno', label: '✅ Bueno (Varilla OK)' },
                  { id: 'regular', label: '⚠️ Regular (Ajustar)' },
                  { id: 'malo', label: '❌ Malo (Hincar)' },
                  { id: 'inexistente', label: '🚫 Inexistente' }
                ].map((spt) => (
                  <button
                    key={spt.id}
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, grounding_system_status: spt.id })}
                    className={`p-2.5 rounded-xl text-xs font-bold border text-center cursor-pointer ${
                      surveyData.grounding_system_status === spt.id
                        ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a] ring-1 ring-[#2d8a58]'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {spt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Distancias Cableado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Distancia de String (Paneles a Inversor) (m)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, distance_roof_to_board_m: Math.max(1, (surveyData.distance_roof_to_board_m !== undefined ? surveyData.distance_roof_to_board_m : 15) - 5) })}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-base flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={surveyData.distance_roof_to_board_m !== undefined ? surveyData.distance_roof_to_board_m : 15}
                    onChange={(e) => setSurveyData({ ...surveyData, distance_roof_to_board_m: parseFloat(e.target.value) || 0 })}
                    className="flex-1 text-center py-2.5 border rounded-xl font-bold text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, distance_roof_to_board_m: (surveyData.distance_roof_to_board_m !== undefined ? surveyData.distance_roof_to_board_m : 15) + 5 })}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-base flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Distancia de Inversor a Tablero (m)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, distance_inverter_to_board_m: Math.max(1, (surveyData.distance_inverter_to_board_m !== undefined ? surveyData.distance_inverter_to_board_m : 15) - 5) })}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-base flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={surveyData.distance_inverter_to_board_m !== undefined ? surveyData.distance_inverter_to_board_m : 15}
                    onChange={(e) => setSurveyData({ ...surveyData, distance_inverter_to_board_m: parseFloat(e.target.value) || 0 })}
                    className="flex-1 text-center py-2.5 border rounded-xl font-bold text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, distance_inverter_to_board_m: (surveyData.distance_inverter_to_board_m !== undefined ? surveyData.distance_inverter_to_board_m : 15) + 5 })}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-800 text-base flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Consumo Factura */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Consumo en Factura (kWh/mes)
              </label>
              <input
                type="number"
                value={surveyData.client_consumption_kwh || 0}
                onChange={(e) => setSurveyData({ ...surveyData, client_consumption_kwh: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-black text-sm text-[#2d8a58]"
                placeholder="Ej. 450"
              />
            </div>

            {/* Ubicación Tablero AC */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ubicación del Tablero Principal / Caja AC
              </label>
              <input
                type="text"
                value={surveyData.main_board_location || ''}
                onChange={(e) => setSurveyData({ ...surveyData, main_board_location: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                placeholder="Ej. Garaje pared norte, fácil acceso para tubería EMT..."
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSurveyStep('techo')}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <span>Siguiente: Cubierta y Techo</span>
                <ChevronRight className="w-4 h-4 text-[#48bb78]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CUBIERTA Y TECHO */}
        {surveyStep === 'techo' && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5 animate-fadeIn">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#2d8a58]" />
                2. Cubierta, Techo y Estructura
              </h3>
              <p className="text-xs text-slate-500">Evalúa el material, inclinación, orientación y espacio útil para los paneles solares.</p>
            </div>

            {/* Tipo de Cubierta Visual Grid */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Tipo de Cubierta
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'fibrocemento', label: '1. Fibrocemento', icon: '🏢' },
                  { id: 'metalica', label: '2. Metálica', icon: '📐' },
                  { id: 'pvc', label: '3. PVC', icon: '📦' },
                  { id: 'placa', label: '4. Placa', icon: '🏛️' },
                  { id: 'suelo_natural', label: '5. Suelo Natural', icon: '🌱' },
                  { id: 'teja_colonial_barro', label: '6. Teja Colonial Barro', icon: '🧱' }
                ].map((rf) => (
                  <button
                    key={rf.id}
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, roof_type: rf.id })}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      surveyData.roof_type === rf.id
                        ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a] ring-2 ring-[#2d8a58]/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl">{rf.icon}</span>
                    <span className="text-xs font-bold leading-tight">{rf.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Estado de la Cubierta (debajo de Tipo de Cubierta) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Estado de la Cubierta
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {[
                  { id: 'buena', label: '✅ Buena', desc: 'Apta para instalación de anclajes' },
                  { id: 'mala', label: '⚠️ Mala', desc: 'Deteriorada, requiere reparación' }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, roof_condition: st.id })}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      (surveyData.roof_condition || 'buena') === st.id
                        ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a] ring-2 ring-[#2d8a58]/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-black block">{st.label}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{st.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Medidas de Cubiertas con cálculo automático de área y paneles estimados */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#2d8a58]" />
                    Medidas de Cubiertas
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Ingresa largo y ancho. El área se calcula automáticamente (Largo × Ancho) junto a los paneles estimados.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addRoofSection}
                  className="px-3 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar otra cubierta</span>
                </button>
              </div>

              {/* Lista dinámica de cubiertas */}
              <div className="space-y-3 pt-1">
                {(surveyData.roof_sections || []).map((sec, idx) => (
                  <div
                    key={sec.id || idx}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#2d8a58]/15 text-[#1c5c3a] text-xs font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={sec.name || `Cubierta ${idx + 1}`}
                          onChange={(e) => handleRoofSectionChange(idx, 'name', e.target.value)}
                          className="text-xs font-black text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-[#2d8a58] focus:outline-none px-1 py-0.5"
                          placeholder="Nombre cubierta (ej. Techo Principal)"
                        />
                      </div>

                      {(surveyData.roof_sections || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRoofSection(idx)}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Eliminar esta cubierta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Largo (m)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={sec.largo !== undefined ? sec.largo : ''}
                          onChange={(e) => handleRoofSectionChange(idx, 'largo', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#2d8a58]"
                          placeholder="Ej. 10.0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Ancho (m)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={sec.ancho !== undefined ? sec.ancho : ''}
                          onChange={(e) => handleRoofSectionChange(idx, 'ancho', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#2d8a58]"
                          placeholder="Ej. 5.0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Área (m²)
                        </label>
                        <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-black text-[#2d8a58] flex items-center justify-between">
                          <span>{sec.area || 0} m²</span>
                          <span className="text-[10px] text-slate-400 font-normal">Largo×Ancho</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1" title="Número de paneles estimados según el técnico">
                          Paneles Estimados
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={sec.estimated_panels !== undefined ? sec.estimated_panels : ''}
                          onChange={(e) => handleRoofSectionChange(idx, 'estimated_panels', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50/50 text-xs font-black text-emerald-800 focus:ring-2 focus:ring-[#2d8a58]"
                          placeholder="Ej. 18"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totalizador de medidas */}
              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-[#2d8a58]/10 via-[#2d8a58]/5 to-transparent border border-[#2d8a58]/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Totales Consolidados:
                  </span>
                  <span className="text-xs text-slate-500">
                    ({(surveyData.roof_sections || []).length} { (surveyData.roof_sections || []).length === 1 ? 'cubierta' : 'cubiertas'})
                  </span>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Área Total
                    </span>
                    <span className="text-sm sm:text-base font-black text-slate-900">
                      {surveyData.available_area_m2 || 0} m²
                    </span>
                  </div>

                  <div className="text-right border-l border-[#2d8a58]/20 pl-6">
                    <span className="text-[10px] font-bold text-[#1c5c3a] uppercase block">
                      Total Paneles Estimados
                    </span>
                    <span className="text-sm sm:text-base font-black text-[#2d8a58]">
                      {surveyData.estimated_panels_total || 0} paneles
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Orientación */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-[#2d8a58]" />
                Orientación de la Cubierta
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
                {['Sur', 'Sureste', 'Suroeste', 'Este', 'Oeste', 'Norte', 'Plano'].map((ori) => (
                  <button
                    key={ori}
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, roof_orientation: ori })}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold border cursor-pointer ${
                      surveyData.roof_orientation === ori
                        ? 'bg-[#2d8a58] text-white border-[#2d8a58]'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {ori}
                  </button>
                ))}
              </div>
            </div>

            {/* Inclinación */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Inclinación Estimada: <strong className="text-[#2d8a58]">{surveyData.roof_slope_deg || 15}°</strong>
              </label>
              <input
                type="range"
                min="0"
                max="45"
                value={surveyData.roof_slope_deg || 15}
                onChange={(e) => setSurveyData({ ...surveyData, roof_slope_deg: parseInt(e.target.value) })}
                className="w-full accent-[#2d8a58] h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>0° Plano</span>
                <span>15° Estándar</span>
                <span>30°</span>
                <span>45°</span>
              </div>
            </div>

            {/* Material de Vigas & Estado de las Vigas */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Material de Vigas / Cerchas
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'metalica', label: 'Metálica' },
                    { id: 'madera', label: 'Madera' },
                    { id: 'concreto', label: 'Concreto' }
                  ].map((mat) => (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => setSurveyData({ ...surveyData, structure_material: mat.id })}
                      className={`p-2.5 rounded-xl text-xs font-bold border text-center cursor-pointer ${
                        surveyData.structure_material === mat.id
                          ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a]'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {mat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estado de las vigas (debajo de Material de las vigas) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Estado de las Vigas
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  {[
                    { id: 'buena', label: '✅ Buena', desc: 'Firme, sin deformaciones ni daño biológico' },
                    { id: 'mala', label: '⚠️ Mala', desc: 'Combada, oxidada o con comején (requiere refuerzo)' }
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setSurveyData({ ...surveyData, beams_condition: bg.id })}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                        (surveyData.beams_condition || 'buena') === bg.id
                          ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a] ring-2 ring-[#2d8a58]/20'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs font-black block">{bg.label}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{bg.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sombras */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nivel de Sombreamiento
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'ninguno', label: '☀️ Ninguno (Pleno sol)' },
                  { id: 'bajo', label: '⛅ Bajo (Sombra leve)' },
                  { id: 'medio', label: '🌤️ Medio (Árboles/muros)' },
                  { id: 'alto', label: '☁️ Alto (Optimizadores)' }
                ].map((sh) => (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, shading_level: sh.id })}
                    className={`p-2.5 rounded-xl text-xs font-bold border text-center cursor-pointer ${
                      surveyData.shading_level === sh.id
                        ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a]'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {sh.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setSurveyStep('electrico')}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                onClick={() => setSurveyStep('equipos')}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <span>Siguiente: Equipos y WiFi</span>
                <ChevronRight className="w-4 h-4 text-[#48bb78]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: EQUIPOS Y WIFI */}
        {surveyStep === 'equipos' && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5 animate-fadeIn">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Wifi className="w-5 h-5 text-[#2d8a58]" />
                3. Ubicación de Equipos y Conectividad
              </h3>
              <p className="text-xs text-slate-500">Verifica dónde se montará el inversor, baterías y la calidad de la señal WiFi para monitoreo.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lugar previsto para Inversor(es)
              </label>
              <input
                type="text"
                value={surveyData.inverter_location || ''}
                onChange={(e) => setSurveyData({ ...surveyData, inverter_location: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                placeholder="Pared ventilada garaje, cuarto técnico, pasillo cubierto..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Espacio para Banco de Baterías (si aplica sistema híbrido / off-grid)
              </label>
              <input
                type="text"
                value={surveyData.battery_location || ''}
                onChange={(e) => setSurveyData({ ...surveyData, battery_location: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                placeholder="Piso firme interior ventilado libre de humedad..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Calidad de Señal WiFi en Sitio del Inversor
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'Excelente', label: '📶 Excelente (Rápido)' },
                  { id: 'Buena', label: '📶 Buena (Estable)' },
                  { id: 'Débil', label: '⚠️ Débil (Repetidor)' },
                  { id: 'Sin señal', label: '❌ Sin señal (4G/Cable)' }
                ].map((wf) => (
                  <button
                    key={wf.id}
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, wifi_signal_strength: wf.id })}
                    className={`p-3 rounded-2xl border text-center text-xs font-bold cursor-pointer transition-all ${
                      surveyData.wifi_signal_strength === wf.id
                        ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a] ring-2 ring-[#2d8a58]/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {wf.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setSurveyStep('techo')}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                onClick={() => setSurveyStep('diagnostico')}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <span>Siguiente: Diagnóstico Final</span>
                <ChevronRight className="w-4 h-4 text-[#48bb78]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: DIAGNÓSTICO Y RECOMENDACIÓN */}
        {surveyStep === 'diagnostico' && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5 animate-fadeIn">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#2d8a58]" />
                4. Dictamen Técnico y Recomendación Final
              </h3>
              <p className="text-xs text-slate-500">Define qué sistema solar se adapta mejor y escribe tus observaciones de campo.</p>
            </div>

            {/* Recommended System Card Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Tipo de Sistema Recomendado por el Técnico
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { id: 'ongrid', label: '1. On-Grid (Ahorro en Factura)', icon: SunMedium, desc: 'Conectado a la red de energía sin baterías' },
                  { id: 'hibrido', label: '2. On-Grid Híbrido con Baterías', icon: Zap, desc: 'Ahorro mensual + respaldo continuo en apagones' },
                  { id: 'offgrid', label: '3. Off-Grid Aislado Rural', icon: Layers, desc: 'Zonas no interconectadas o fincas sin red' },
                  { id: 'bombeo', label: '4. Bombeo Solar de Agua', icon: Sparkles, desc: 'Pozos profundos y riego con variador solar' }
                ].map((sys) => {
                  const Icon = sys.icon;
                  return (
                    <button
                      key={sys.id}
                      type="button"
                      onClick={() => setSurveyData({ ...surveyData, recommended_system_type: sys.id })}
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 cursor-pointer transition-all ${
                        surveyData.recommended_system_type === sys.id
                          ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a] ring-2 ring-[#2d8a58]/20'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5 text-[#2d8a58] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold block">{sys.label}</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{sys.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Structure Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Estructura de Fijación Recomendada
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'Estructura de aluminio sobre tejado',
                  'Estructura en acero a piso'
                ].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, recommended_structure_type: st })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border text-center cursor-pointer ${
                      surveyData.recommended_structure_type === st
                        ? 'border-[#2d8a58] bg-[#2d8a58]/10 text-[#1c5c3a]'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Checklist: Documentos y Fotos Obligatorias de Campo */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-3">
              <div>
                <label className="block text-xs font-black text-[#1c5c3a] uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-[#2d8a58]" />
                  <span>Casillas de Verificación de Campo Requeridas</span>
                </label>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Marca las casillas conforme tomes o recopiles cada uno de los registros obligatorios:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    key: 'photo_meter_ok',
                    title: '1. Foto Medidor',
                    desc: 'Frontal con lectura y serie nítida',
                    ok: Boolean(surveyData.photo_meter_ok)
                  },
                  {
                    key: 'photo_transformer_ok',
                    title: '2. Foto Transformador',
                    desc: 'Placa, poste o punto de conexión',
                    ok: Boolean(surveyData.photo_transformer_ok)
                  },
                  {
                    key: 'energy_bill_ok',
                    title: '3. Recibo de Energía',
                    desc: 'Última factura completa con NIC',
                    ok: Boolean(surveyData.energy_bill_ok)
                  }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSurveyData({ ...surveyData, [item.key]: !item.ok })}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      item.ok
                        ? 'bg-white border-[#2d8a58] ring-2 ring-[#2d8a58]/30 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        item.ok
                          ? 'bg-[#2d8a58] text-white'
                          : 'border-2 border-slate-300'
                      }`}
                    >
                      {item.ok && <Check className="w-4 h-4 stroke-[3]" />}
                    </span>
                    <div>
                      <span className={`text-xs font-bold block ${item.ok ? 'text-[#1c5c3a]' : 'text-slate-800'}`}>
                        {item.title}
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        {item.desc}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Field Notes & Observations */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Diagnóstico General y Observaciones Técnicas de Campo
              </label>
              <textarea
                rows="4"
                value={surveyData.technician_notes || ''}
                onChange={(e) => setSurveyData({ ...surveyData, technician_notes: e.target.value })}
                className="w-full p-3.5 border rounded-2xl text-xs focus:ring-2 focus:ring-[#2d8a58] focus:outline-none"
                placeholder="Escribe todas las condiciones encontradas en la visita, facilidad de paso de cableado, requerimientos de andamios o escaleras, estado de la red..."
              />
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setSurveyStep('equipos')}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
            </div>
          </div>
        )}

        {/* Floating Fixed Bottom Actions Bar on Mobile & Desktop */}
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-2xl transition-colors no-print">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleSaveSurvey(false)}
              disabled={savingSurvey}
              className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Borrador</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveSurvey(true)}
              disabled={savingSurvey}
              className="flex-1 py-3 px-4 rounded-2xl bg-[#2d8a58] hover:bg-[#237348] text-white font-black text-xs sm:text-sm shadow-lg shadow-[#2d8a58]/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{savingSurvey ? 'Guardando...' : 'Completar Levantamiento Técnico'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN VISITS LIST VIEW
  // ==========================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-[#2d8a58]" />
            Visitas Técnicas & Levantamiento Solar
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Agenda y gestiona las visitas técnicas en terreno y diligencia los levantamientos de ingeniería solar.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setListDisplayMode(listDisplayMode === 'cards' ? 'table' : 'cards')}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span>{listDisplayMode === 'cards' ? 'Ver como Tabla' : 'Ver como Tarjetas'}</span>
          </button>
          <button
            onClick={openNewSchedule}
            className="px-4 py-2.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-md shadow-[#2d8a58]/25 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Agendar Visita Técnica</span>
          </button>
        </div>
      </div>

      {/* Overdue visits warning banner (Visitas no realizadas en el tiempo acordado) */}
      {(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const overdueCount = visits.filter((v) => v.status === 'agendada' && v.scheduled_date && v.scheduled_date < todayStr).length;
        if (overdueCount === 0) return null;
        return (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-amber-50 border-2 border-rose-300 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black shrink-0 shadow-md">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black flex items-center gap-2">
                  <span>Alerta: {overdueCount} {overdueCount === 1 ? 'visita técnica retrasada' : 'visitas técnicas retrasadas'}</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 text-[10px] font-bold">
                    Tiempo Acordado Vencido
                  </span>
                </h3>
                <p className="text-xs text-rose-800 mt-0.5">
                  La fecha pactada para el levantamiento ya venció. Por favor completa el levantamiento técnico en terreno o reprograma la fecha para no retrasar la cotización.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleTabChange('scheduled')}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm cursor-pointer whitespace-nowrap"
            >
              Ver Agendadas Retrasadas
            </button>
          </div>
        );
      })()}

      {/* Tabs / Pipeline */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        {[
          {
            id: 'scheduled',
            label: '📅 Visitas Agendadas',
            count: stats?.scheduled_count,
            activeColor: 'bg-slate-900 text-white font-bold',
            color: 'text-slate-700 hover:bg-slate-100',
            badgeBg: 'bg-slate-200 text-slate-700'
          },
          {
            id: 'realizadas',
            label: '📋 Levantamientos Realizados',
            count: stats?.completed_count,
            activeColor: 'bg-[#2d8a58] text-white font-bold shadow-md shadow-[#2d8a58]/25',
            color: 'text-[#1c5c3a] hover:bg-[#2d8a58]/10 font-bold',
            badgeBg: 'bg-[#2d8a58]/20 text-[#224817] font-bold'
          },
          {
            id: 'all',
            label: 'Todas las Visitas',
            count: stats?.total_count,
            activeColor: 'bg-slate-800 text-white font-bold',
            color: 'text-slate-600 hover:bg-slate-100',
            badgeBg: 'bg-slate-200 text-slate-600'
          },
          {
            id: 'cancelled',
            label: 'Canceladas',
            count: stats?.cancelled_count,
            activeColor: 'bg-slate-600 text-white font-bold',
            color: 'text-slate-500 hover:bg-slate-100',
            badgeBg: 'bg-slate-200 text-slate-600'
          }
        ].map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isActive ? tab.activeColor : tab.color
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${tab.badgeBg}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por código de visita, cliente, ciudad o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d8a58]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
        >
          Buscar
        </button>
      </form>

      {/* Visits Cards / Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#2d8a58] border-t-transparent mx-auto mb-2"></div>
          <p className="text-xs text-slate-400">Cargando visitas técnicas...</p>
        </div>
      ) : visits.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">No hay visitas en esta sección</h3>
          <p className="text-xs text-slate-400 mt-1">Agenda una nueva visita o diligencia los levantamientos técnicos pendientes.</p>
        </div>
      ) : listDisplayMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visits.map((v) => {
            const isCompleted = v.status === 'realizada_pendiente_cotizar' || v.status === 'cotizada';
            const isScheduled = v.status === 'agendada';
            const isCancelled = v.status === 'cancelada';

            return (
              <div
                key={v.id}
                className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                  isCompleted
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : isCancelled
                    ? 'border-slate-200 opacity-75'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-400 block">
                        {v.visit_code}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">
                        {v.client_name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {v.client_phone || 'Sin tel'} &bull; {v.client_city || 'Sin ciudad'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-xl text-[11px] font-black border ${
                        isCompleted
                          ? 'bg-[#2d8a58]/20 text-[#224817] border-[#2d8a58]/40'
                          : isScheduled
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {isCompleted ? '✅ Levantamiento Realizado' : isScheduled ? '📅 Agendada' : '❌ Cancelada'}
                      </span>
                    </div>
                  </div>

                  {/* Scheduled Info Pill */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1 my-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#2d8a58]" /> Fecha Visita:
                      </span>
                      <span className="font-bold text-slate-800">{formatDate(v.scheduled_date)} - {v.scheduled_time}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" /> Técnico:
                      </span>
                      <span className="font-semibold text-slate-700">{v.technician_name || 'Sin asignar'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-slate-400" /> Acometida:
                      </span>
                      <span className="font-semibold text-slate-700">{v.voltage_level || 'Bifásica'} &bull; {v.operator}</span>
                    </div>
                  </div>

                  {/* Technical Highlights if surveyed */}
                  {v.roof_type && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1 mb-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Levantamiento Técnico de Campo:
                      </span>
                      <p className="text-slate-700">
                        Cubierta: <strong>{getRoofTypeName(v.roof_type)}</strong> ({v.roof_orientation || 'Sur'} - {v.roof_slope_deg || 15}°)
                      </p>
                      <p className="text-slate-700">
                        Área útil: <strong>{v.available_area_m2 || 0} m²</strong> &bull; Paneles est.: <strong>{v.estimated_panels_total || 0}</strong> &bull; Breaker: <strong>{v.totalizer_breaker_amps || 50}A</strong>
                      </p>
                      {v.client_consumption_kwh > 0 && (
                        <p className="text-[#1c5c3a] font-bold">
                          Consumo registrado: {v.client_consumption_kwh} kWh/mes
                        </p>
                      )}
                    </div>
                  )}

                  {/* Technician notes */}
                  {v.technician_notes && (
                    <div className="mb-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Notas del Técnico:
                      </span>
                      <p className="text-xs text-slate-600 italic line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        "{v.technician_notes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  {/* Primary Action Button */}
                  {isScheduled ? (
                    <button
                      onClick={() => openInPageSurvey(v)}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <ClipboardCheck className="w-4 h-4 text-[#48bb78]" />
                      <span>Diligenciar Visita</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => openInPageSurvey(v)}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-[#2d8a58]/20"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Ver / Editar Levantamiento</span>
                    </button>
                  )}

                  {/* Secondary buttons: Print Acta PDF + Delete */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => openPrintView(v)}
                      className="text-xs font-bold text-slate-600 hover:text-[#2d8a58] flex items-center gap-1.5 p-1 transition-colors cursor-pointer"
                      title="Generar e imprimir acta técnica de la visita"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#2d8a58]" />
                      <span>Imprimir / PDF Acta</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteVisit(v.id, v.visit_code)}
                        className="text-slate-400 hover:text-rose-600 p-1 text-xs cursor-pointer transition-colors"
                        title="Eliminar visita"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View for Visitas */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Cliente / Ubicación</th>
                  <th className="py-3.5 px-4">Fecha & Hora</th>
                  <th className="py-3.5 px-4">Técnico Asignado</th>
                  <th className="py-3.5 px-4">Acometida / Operador</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.map((v) => {
                  const isCompleted = v.status === 'realizada_pendiente_cotizar' || v.status === 'cotizada';
                  const isScheduled = v.status === 'agendada';
                  const isCancelled = v.status === 'cancelada';
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isOverdue = isScheduled && v.scheduled_date && v.scheduled_date < todayStr;

                  const phoneClean = (v.client_phone || '').replace(/\D/g, '');
                  const waPhone = phoneClean.startsWith('57') ? phoneClean : `57${phoneClean}`;

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {v.visit_code}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{v.client_name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{v.client_city || 'Sin ciudad'}</span>
                          {v.client_phone && (
                            <>
                              <span>&bull;</span>
                              <span>{v.client_phone}</span>
                              <a
                                href={`https://wa.me/${waPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:text-emerald-700"
                                title="Abrir WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5 inline" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{formatDate(v.scheduled_date)}</div>
                        <div className="text-[11px] text-slate-500">{v.scheduled_time}</div>
                        {isOverdue && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Retrasada
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {v.technician_name || 'Sin asignar'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">{v.voltage_level || 'Bifásica'}</div>
                        <div className="text-[11px] text-slate-400">{v.operator || 'Sin operador'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isCompleted
                            ? 'bg-[#2d8a58]/20 text-[#224817] border-[#2d8a58]/40'
                            : isScheduled
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {isCompleted ? '✅ Realizada' : isScheduled ? '📅 Agendada' : '❌ Cancelada'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isScheduled ? (
                            <button
                              onClick={() => openInPageSurvey(v)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5 text-[#48bb78]" />
                              <span>Diligenciar</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => openInPageSurvey(v)}
                              className="px-2.5 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                          )}
                          <button
                            onClick={() => openPrintView(v)}
                            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                            title="Imprimir / PDF Acta"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#2d8a58]" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteVisit(v.id, v.visit_code)}
                              className="p-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                              title="Eliminar visita"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal: Schedule New Visit */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Agendar Nueva Visita Técnica"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Cliente a Visitar <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsScheduleModalOpen(false);
                    navigate('/clientes?action=new');
                  }}
                  className="text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                >
                  + Registrar Nuevo Cliente
                </button>
              </div>
              <select
                required
                value={scheduleData.client_id}
                onChange={(e) => {
                  const cId = e.target.value;
                  const foundClient = clients.find(c => c.id.toString() === cId);
                  setScheduleData({
                    ...scheduleData,
                    client_id: cId,
                    operator: foundClient?.operator || scheduleData.operator
                  });
                }}
                className="w-full px-3.5 py-2 border rounded-xl text-xs font-semibold"
              >
                <option value="">-- Selecciona un cliente --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.city || 'Sin ciudad'}) - {c.phone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha Programada <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={scheduleData.scheduled_date}
                onChange={(e) => setScheduleData({ ...scheduleData, scheduled_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hora de la Visita
              </label>
              <select
                value={scheduleData.scheduled_time}
                onChange={(e) => setScheduleData({ ...scheduleData, scheduled_time: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
              >
                <option value="08:00 AM">08:00 AM</option>
                <option value="09:00 AM">09:00 AM</option>
                <option value="10:00 AM">10:00 AM</option>
                <option value="11:00 AM">11:00 AM</option>
                <option value="02:00 PM">02:00 PM</option>
                <option value="03:00 PM">03:00 PM</option>
                <option value="04:00 PM">04:00 PM</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Técnico / Ingeniero Asignado
              </label>
              <select
                value={scheduleData.user_id}
                onChange={(e) => setScheduleData({ ...scheduleData, user_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
              >
                {technicians.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Operador de Red
              </label>
              <input
                type="text"
                value={scheduleData.operator}
                onChange={(e) => setScheduleData({ ...scheduleData, operator: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
                placeholder="Afinia, Air-e, Celsia, EPM..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Notas Previas o Instrucciones para el Técnico
              </label>
              <textarea
                rows="2"
                value={scheduleData.technician_notes}
                onChange={(e) => setScheduleData({ ...scheduleData, technician_notes: e.target.value })}
                className="w-full p-3 border rounded-xl text-xs"
                placeholder="Preguntar por don Carlos, llevar escalera de 4 pasos, revisar factura..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-[#2d8a58] hover:bg-[#237348] rounded-xl shadow cursor-pointer"
            >
              Agendar Visita
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
