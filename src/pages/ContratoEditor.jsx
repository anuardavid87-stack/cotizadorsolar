import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileSignature, Save, ArrowLeft, CheckCircle2, AlertTriangle,
  Calculator, DollarSign, Calendar, Percent, Shield, Clock,
  Package, SunMedium, Zap, Layers, RefreshCw, Sliders, Check, User,
  FileText, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCOP } from '../utils/formatters';
import {
  generateInstallmentsSchedule,
  validateInstallmentsSum,
  adjustLastInstallmentToBalance
} from '../utils/contractCalculator';

export default function ContratoEditor({ onNotify }) {
  const { quoteId, id: contractId } = useParams();
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const isEditingExisting = Boolean(contractId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableQuotes, setAvailableQuotes] = useState([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState(quoteId || '');

  // Core Data
  const [client, setClient] = useState(null);
  const [quote, setQuote] = useState(null);
  const [contractCode, setContractCode] = useState('');
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractStatus, setContractStatus] = useState('borrador');

  // Financial Parameters
  const [totalContractValue, setTotalContractValue] = useState(0);
  const [downPaymentAmount, setDownPaymentAmount] = useState(0);
  const [hasInterest, setHasInterest] = useState(false);
  const [monthlyInterestRatePercent, setMonthlyInterestRatePercent] = useState('2.0');
  const [legalizationIncluded, setLegalizationIncluded] = useState(true);
  const [installmentsCount, setInstallmentsCount] = useState(12);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(() => {
    // 30 days from today
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Amortization Schedule
  const [schedule, setSchedule] = useState([]);
  const [isCustomSchedule, setIsCustomSchedule] = useState(false);

  // Contract Terms
  const [executionTimeDays, setExecutionTimeDays] = useState(60);
  const [warrantyPanels, setWarrantyPanels] = useState(12);
  const [warrantyInverter, setWarrantyInverter] = useState(5);
  const [warrantyInstallation, setWarrantyInstallation] = useState(1);
  const [contractorRepName, setContractorRepName] = useState('NELLIS ELENA MANJARREZ RODRÍGUEZ');
  const [contractorRepDoc, setContractorRepDoc] = useState('1.052.952.061');
  const [customClauses, setCustomClauses] = useState('');
  const [notes, setNotes] = useState('');

  // Financed Balance Calculation
  const financedAmount = Math.max(0, (parseFloat(totalContractValue) || 0) - (parseFloat(downPaymentAmount) || 0));

  // Helper to re-generate automatic schedule on parameter changes (when not custom)
  const regenerateScheduleIfAuto = (overrideParams = {}) => {
    if (isCustomSchedule) return;

    const total = overrideParams.total !== undefined ? overrideParams.total : totalContractValue;
    const down = overrideParams.down !== undefined ? overrideParams.down : downPaymentAmount;
    const count = overrideParams.count !== undefined ? overrideParams.count : installmentsCount;
    const withInterest = overrideParams.hasInterest !== undefined ? overrideParams.hasInterest : hasInterest;
    const ratePct = overrideParams.ratePercent !== undefined ? overrideParams.ratePercent : monthlyInterestRatePercent;
    const firstDate = overrideParams.firstDate !== undefined ? overrideParams.firstDate : firstInstallmentDate;

    const fin = Math.max(0, (parseFloat(total) || 0) - (parseFloat(down) || 0));
    const rate = withInterest ? (parseFloat(ratePct) || 0) / 100 : 0;

    const newSchedule = generateInstallmentsSchedule({
      financedAmount: fin,
      installmentsCount: count,
      hasInterest: withInterest,
      monthlyRate: rate,
      firstDate: firstDate
    });
    setSchedule(newSchedule);
  };

  // Load quote details into state
  const applyQuoteData = (q, settings) => {
    setQuote(q);
    setClient({
      id: q.client_id,
      name: q.client_name,
      doc_type: q.client_doc_type || 'CC',
      doc_number: q.client_doc_number || '',
      phone: q.client_phone || '',
      email: q.client_email || '',
      address: q.client_address || '',
      city: q.client_city || '',
      department: q.client_department || '',
      operator: q.client_operator || ''
    });

    const total = parseFloat(q.total_price) || 0;
    const downPayment = (q.financing_down_payment_amount !== null && q.financing_down_payment_amount !== undefined && q.financing_down_payment_amount !== '')
      ? parseFloat(q.financing_down_payment_amount)
      : Math.round(total * 0.5); // Default 50% anticipo
    const financed = Math.max(0, total - downPayment);
    const initialTerm = q.financing_term_months || 12;
    const initialRate = q.financing_monthly_rate !== undefined && q.financing_monthly_rate !== null
      ? parseFloat(q.financing_monthly_rate)
      : 0;

    setTotalContractValue(total);
    setDownPaymentAmount(downPayment);
    setInstallmentsCount(initialTerm);
    setHasInterest(initialRate > 0);
    setMonthlyInterestRatePercent(initialRate > 0 ? (initialRate * 100).toString() : '2.0');
    setLegalizationIncluded(q.legalization_included !== undefined && q.legalization_included !== null ? Boolean(q.legalization_included) : true);

    // Company defaults
    if (settings) {
      setContractorRepName(settings.legal_rep_name || 'NELLIS ELENA MANJARREZ RODRÍGUEZ');
      setContractorRepDoc(settings.legal_rep_doc || '1.052.952.061');
    }

    // Schedule
    const todayPlus30 = new Date();
    todayPlus30.setDate(todayPlus30.getDate() + 30);
    const firstDueDate = todayPlus30.toISOString().split('T')[0];
    setFirstInstallmentDate(firstDueDate);

    const initSchedule = generateInstallmentsSchedule({
      financedAmount: financed,
      installmentsCount: initialTerm,
      hasInterest: initialRate > 0,
      monthlyRate: initialRate,
      firstDate: firstDueDate
    });
    setSchedule(initSchedule);
    setIsCustomSchedule(false);
  };

  // Load Data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        if (isEditingExisting) {
          // Editing existing contract
          const res = await authFetch(`/api/contracts/${contractId}`);
          if (!res.ok) throw new Error('Contrato no encontrado');
          const data = await res.json();
          const ct = data.contract;

          setContractCode(ct.contract_code);
          setContractDate(ct.contract_date || new Date().toISOString().split('T')[0]);
          setContractStatus(ct.status || 'borrador');
          setTotalContractValue(ct.total_contract_value || 0);
          setDownPaymentAmount(ct.down_payment_amount || 0);
          setHasInterest(Boolean(ct.has_interest));
          setMonthlyInterestRatePercent(ct.monthly_interest_rate ? (ct.monthly_interest_rate * 100).toString() : '2.0');
          setLegalizationIncluded(ct.legalization_included !== undefined && ct.legalization_included !== null ? Boolean(ct.legalization_included) : true);
          setInstallmentsCount(ct.installments_count || 1);
          setFirstInstallmentDate(ct.first_installment_date || new Date().toISOString().split('T')[0]);
          setExecutionTimeDays(ct.execution_time_days || 60);
          setWarrantyPanels(ct.warranty_years_panels || 12);
          setWarrantyInverter(ct.warranty_years_inverter || 5);
          setWarrantyInstallation(ct.warranty_years_installation || 1);
          setContractorRepName(ct.contractor_rep_name || 'NELLIS ELENA MANJARREZ RODRÍGUEZ');
          setContractorRepDoc(ct.contractor_rep_doc || '1.052.952.061');
          setCustomClauses(ct.custom_clauses || '');
          setNotes(ct.notes || '');

          try {
            const parsedSchedule = JSON.parse(ct.installments_schedule_json || '[]');
            setSchedule(parsedSchedule);
            setIsCustomSchedule(Boolean(ct.is_custom_schedule));
          } catch (e) {
            setSchedule([]);
          }

          setClient({
            id: ct.client_id,
            name: ct.client_name,
            doc_type: ct.client_doc_type,
            doc_number: ct.client_doc_number,
            phone: ct.client_phone,
            email: ct.client_email,
            address: ct.client_address,
            city: ct.client_city,
            department: ct.client_department,
            operator: ct.client_operator
          });

          setQuote({
            id: ct.quote_id,
            quote_code: ct.quote_code,
            system_type: ct.quote_system_type,
            installed_power_kwp: ct.installed_power_kwp,
            installed_panels: ct.installed_panels,
            panel_power_w: ct.panel_power_w,
            structure_type: ct.structure_type,
            legalization_included: ct.legalization_included,
            selected_inverters_json: ct.selected_inverters_json,
            selected_batteries_json: ct.selected_batteries_json,
            selected_pumps_json: ct.selected_pumps_json
          });
        } else {
          // Creating new contract
          const activeQuoteId = quoteId || selectedQuoteId;

          // Also fetch list of won quotes for quote selection
          try {
            const pendingRes = await authFetch('/api/contracts/pending-quotes');
            if (pendingRes.ok) {
              const pData = await pendingRes.json();
              const pList = pData.pendingQuotes || [];
              setAvailableQuotes(pList);

              // If no quoteId in URL and we have pending quotes, default to first pending quote
              if (!activeQuoteId && pList.length > 0) {
                const targetId = pList[0].quote_id;
                setSelectedQuoteId(targetId);
                const qRes = await authFetch(`/api/quotes/${targetId}`);
                if (qRes.ok) {
                  const qData = await qRes.json();
                  applyQuoteData(qData.quote, qData.settings);
                  setLoading(false);
                  return;
                }
              }
            }
          } catch (e) {
            console.error('Error loading pending quotes:', e);
          }

          if (activeQuoteId) {
            const res = await authFetch(`/api/quotes/${activeQuoteId}`);
            if (!res.ok) throw new Error('Cotización no encontrada');
            const data = await res.json();
            applyQuoteData(data.quote, data.settings);
          }
        }
      } catch (err) {
        if (onNotify) onNotify({ type: 'error', message: err.message });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [quoteId, contractId]);

  // Handle choosing a different quote
  const handleSelectDifferentQuote = async (targetId) => {
    if (!targetId) return;
    try {
      setLoading(true);
      setSelectedQuoteId(targetId);
      const res = await authFetch(`/api/quotes/${targetId}`);
      if (!res.ok) throw new Error('No se pudo cargar la cotización seleccionada');
      const data = await res.json();
      applyQuoteData(data.quote, data.settings);
      navigate(`/contrato/nuevo/${targetId}`, { replace: true });
    } catch (e) {
      if (onNotify) onNotify({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Recalculate automatic schedule
  const handleRecalculateSchedule = () => {
    const rate = hasInterest ? (parseFloat(monthlyInterestRatePercent) || 0) / 100 : 0;
    const newSchedule = generateInstallmentsSchedule({
      financedAmount,
      installmentsCount,
      hasInterest,
      monthlyRate: rate,
      firstDate: firstInstallmentDate
    });
    setSchedule(newSchedule);
    setIsCustomSchedule(false);
    if (onNotify) onNotify({ type: 'info', message: 'Cronograma de cuotas recalculado automáticamente.' });
  };

  // Handle manual editing of an installment amount
  const handleInstallmentAmountChange = (index, newAmount) => {
    const parsed = Math.max(0, parseFloat(newAmount) || 0);
    const updated = schedule.map((item, idx) => {
      if (idx === index) {
        return {
          ...item,
          amount: parsed,
          principal: parsed,
          remaining_balance: 0
        };
      }
      return item;
    });

    // Recompute running remaining balance
    let currentBal = financedAmount;
    for (let i = 0; i < updated.length; i++) {
      currentBal = Math.max(0, currentBal - updated[i].amount);
      updated[i].remaining_balance = currentBal;
    }

    setSchedule(updated);
    setIsCustomSchedule(true);
  };

  // Handle manual date change
  const handleInstallmentDateChange = (index, newDate) => {
    const updated = schedule.map((item, idx) => (idx === index ? { ...item, due_date: newDate } : item));
    setSchedule(updated);
    setIsCustomSchedule(true);
  };

  // Quick fix: Adjust last installment to balance
  const handleAdjustLastInstallment = () => {
    const adjusted = adjustLastInstallmentToBalance(schedule, financedAmount);
    setSchedule(adjusted);
    if (onNotify) onNotify({ type: 'success', message: 'Última cuota ajustada para cuadrar exactamente el saldo.' });
  };

  // Validation Status
  const validation = validateInstallmentsSum(schedule, financedAmount, hasInterest);

  // Submit and Save
  const handleSaveContract = async () => {
    if (!client?.id || !quote?.id) {
      if (onNotify) onNotify({ type: 'error', message: 'Debes seleccionar una cotización válida con cliente para generar el contrato.' });
      return;
    }

    if (!validation.isValid) {
      const confirmSave = window.confirm(
        `El total de las cuotas suma ${formatCOP(validation.totalSum)}, mientras que el saldo a financiar es ${formatCOP(financedAmount)} (Diferencia: ${formatCOP(Math.abs(validation.difference))}).\n\n¿Deseas que el sistema ajuste la última cuota automáticamente para cuadrar el saldo antes de guardar?`
      );
      if (confirmSave) {
        handleAdjustLastInstallment();
      } else {
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        quote_id: quote?.id || null,
        client_id: client?.id,
        contract_date: contractDate,
        status: contractStatus,
        total_contract_value: totalContractValue,
        down_payment_amount: downPaymentAmount,
        financed_amount: financedAmount,
        legalization_included: legalizationIncluded ? 1 : 0,
        has_interest: hasInterest,
        monthly_interest_rate: hasInterest ? (parseFloat(monthlyInterestRatePercent) || 0) / 100 : 0,
        installments_count: installmentsCount,
        first_installment_date: firstInstallmentDate,
        installments_schedule: schedule,
        is_custom_schedule: isCustomSchedule,
        execution_time_days: executionTimeDays,
        warranty_years_panels: warrantyPanels,
        warranty_years_inverter: warrantyInverter,
        warranty_years_installation: warrantyInstallation,
        contractor_rep_name: contractorRepName,
        contractor_rep_doc: contractorRepDoc,
        custom_clauses: customClauses,
        notes: notes,
        equipment_summary: {
          system_type: quote?.system_type,
          installed_power_kwp: quote?.installed_power_kwp,
          installed_panels: quote?.installed_panels,
          panel_power_w: quote?.panel_power_w,
          structure_type: quote?.structure_type,
          legalization_included: legalizationIncluded ? 1 : 0
        }
      };

      const url = isEditingExisting ? `/api/contracts/${contractId}` : '/api/contracts';
      const method = isEditingExisting ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el contrato');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: isEditingExisting
            ? `Contrato ${data.contract_code || contractCode} actualizado con éxito.`
            : (legalizationIncluded
                ? `Contrato ${data.contract_code} generado exitosamente y expediente de legalización aperturado.`
                : `Contrato ${data.contract_code} generado exitosamente.`)
        });
      }

      navigate(`/contrato/${data.id || contractId}`);
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#2d8a58] border-t-transparent mx-auto"></div>
        <p className="text-xs text-slate-400 mt-3 font-semibold">Cargando módulo de elaboración de contrato...</p>
      </div>
    );
  }

  // If no quote or client could be loaded
  if (!client && !isEditingExisting) {
    return (
      <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-800 dark:text-white">
          Selecciona un Proyecto Ganado para Elaborar el Contrato
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Para redactar el contrato de obra, selecciona una cotización ganada de la lista o regresa a la pestaña de contratos pendientes.
        </p>

        {availableQuotes.length > 0 ? (
          <div className="text-left space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Proyectos Ganados Disponibles:
            </label>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-2xl overflow-hidden">
              {availableQuotes.map((pq) => (
                <div
                  key={pq.quote_id}
                  onClick={() => handleSelectDifferentQuote(pq.quote_id)}
                  className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div>
                    <span className="font-mono font-black text-xs text-[#2d8a58] block">{pq.quote_code}</span>
                    <strong className="text-xs text-slate-800 dark:text-white">{pq.client_name}</strong>
                    <p className="text-[11px] text-slate-400">{pq.client_city} &bull; {pq.installed_power_kwp} kWp</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900 dark:text-white block">{formatCOP(pq.total_price)}</span>
                    <span className="text-[10px] text-[#2d8a58] font-bold flex items-center gap-1 justify-end mt-1">
                      Elaborar <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No hay proyectos ganados pendientes en este momento.</p>
        )}

        <div className="pt-3">
          <button
            onClick={() => navigate('/contratos')}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Volver a Contratos
          </button>
        </div>
      </div>
    );
  }

  // Parse inverters and batteries
  let invertersList = [];
  let batteriesList = [];
  try {
    invertersList = JSON.parse(quote?.selected_inverters_json || '[]');
    batteriesList = JSON.parse(quote?.selected_batteries_json || '[]');
  } catch (e) {}

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/contratos')}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Volver a la lista de contratos"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
              <FileSignature className="w-6 h-6 text-[#2d8a58]" />
              {isEditingExisting ? `Editar Contrato ${contractCode}` : 'Elaborar Contrato de Construcción Solar'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Parametriza la forma de pago, cuotas (1 a 60), intereses y garantías contractuales &bull; Renova Energy S.A.S.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSaveContract}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-md shadow-[#2d8a58]/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : 'Guardar y Ver Documento'}</span>
          </button>
        </div>
      </div>

      {/* 1. Context Cards: Client & Technical Equipment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Client Info Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-white font-bold text-sm">
              <User className="w-4 h-4 text-[#2d8a58]" />
              <span>Contratante (Cliente)</span>
            </div>
            {availableQuotes.length > 1 && !isEditingExisting && (
              <select
                value={selectedQuoteId || quote?.id || ''}
                onChange={(e) => handleSelectDifferentQuote(e.target.value)}
                className="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[#2d8a58] cursor-pointer"
              >
                {availableQuotes.map(aq => (
                  <option key={aq.quote_id} value={aq.quote_id}>
                    {aq.quote_code} - {aq.client_name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <p className="font-bold text-slate-900 dark:text-white text-sm">{client?.name || 'Cliente no especificado'}</p>
            <p className="text-slate-500 dark:text-slate-400">
              {client?.doc_type || 'CC'}: <strong className="text-slate-700 dark:text-slate-300">{client?.doc_number || 'N/A'}</strong>
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Tel: <strong className="text-slate-700 dark:text-slate-300">{client?.phone || 'No registrado'}</strong>
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Ubicación: <strong className="text-slate-700 dark:text-slate-300">{client?.address ? `${client.address}, ` : ''}{client?.city || 'Sitio'}</strong>
            </p>
          </div>
        </div>

        {/* Quoted Products Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-white font-bold text-sm">
              <Package className="w-4 h-4 text-[#2d8a58]" />
              <span>Equipos y Alcance Cotizado ({quote?.quote_code || 'COT'})</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2d8a58]/15 text-[#2d8a58]">
              {quote?.system_type === 'ongrid' ? 'On-Grid Interconectado' :
               quote?.system_type === 'hibrido' ? 'Híbrido con Baterías' :
               quote?.system_type === 'offgrid' ? 'Off-Grid Aislado' : 'Bombeo Solar'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Potencia Pico</span>
              <span className="text-base font-black text-[#2d8a58]">{quote?.installed_power_kwp || 0} kWp</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Módulos Solares</span>
              <span className="text-base font-black text-slate-800 dark:text-white">{quote?.installed_panels || 0} Paneles</span>
              <span className="text-[10px] text-slate-400 block">{quote?.panel_power_w || 720}W Tier-1</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">{quote?.system_type === 'bombeo' ? 'Variador Solar' : 'Inversores'}</span>
              <span className="text-xs font-bold text-slate-800 dark:text-white block mt-1 truncate">
                {invertersList.length > 0 ? (invertersList[0]?.name?.replace('Variador de Frecuencia Solar ', 'VFD ') || `${invertersList.length} unidad(es)`) : 'Incluido'}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Estructura & RETIE</span>
              <span className="text-xs font-bold text-slate-800 dark:text-white block mt-1 truncate">
                {quote?.structure_type || 'Estructura de aluminio sobre tejado'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Financial & Payment Schedule Configurator */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#2d8a58]" />
              Forma de Pago y Financiación de la Obra
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configura el valor inicial (anticipo), saldo a financiar, tasa de interés y número de cuotas (1 a 60 meses).
            </p>
          </div>

          <button
            type="button"
            onClick={handleRecalculateSchedule}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#2d8a58]" />
            <span>Recalcular Automáticamente</span>
          </button>
        </div>

        {/* Financial Inputs Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Contract Value */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Valor Total del Contrato:
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={totalContractValue}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setTotalContractValue(val);
                  regenerateScheduleIfAuto({ total: val });
                }}
                className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2d8a58] focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {formatCOP(totalContractValue)}
            </span>
          </div>

          {/* Down Payment (Cuota Inicial / Anticipo) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Cuota Inicial (Anticipo):
              </label>
              <span className="text-[10px] font-bold text-emerald-600">
                {totalContractValue > 0 ? `${Math.round((downPaymentAmount / totalContractValue) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
              <input
                type="number"
                min="0"
                max={totalContractValue}
                step="1000"
                value={downPaymentAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setDownPaymentAmount(val);
                  regenerateScheduleIfAuto({ down: val });
                }}
                className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-emerald-600 focus:ring-2 focus:ring-[#2d8a58] focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {formatCOP(downPaymentAmount)}
            </span>
          </div>

          {/* Financed Balance (Saldo a financiar) */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase">
              Saldo a Financiar:
            </span>
            <span className="text-base font-black text-[#2d8a58] block mt-1">
              {formatCOP(financedAmount)}
            </span>
            <span className="text-[10px] text-slate-400">
              Monto a diferir en las cuotas
            </span>
          </div>

          {/* First Due Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Primer Vencimiento:
            </label>
            <input
              type="date"
              value={firstInstallmentDate}
              onChange={(e) => {
                const d = e.target.value;
                setFirstInstallmentDate(d);
                regenerateScheduleIfAuto({ firstDate: d });
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-[#2d8a58] focus:outline-none"
            />
          </div>
        </div>

        {/* Installments and Interest Controls */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Number of Installments (1 to 60) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Plazo: <strong>{installmentsCount} cuotas mensuales</strong>
              </label>
              <span className="text-[10px] font-mono font-bold text-slate-400">1 a 60 meses</span>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              value={installmentsCount}
              onChange={(e) => {
                const count = parseInt(e.target.value) || 1;
                setInstallmentsCount(count);
                regenerateScheduleIfAuto({ count });
              }}
              className="w-full accent-[#2d8a58] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1 mt-1">
              <span>1 cuota</span>
              <span>12</span>
              <span>24</span>
              <span>36</span>
              <span>48</span>
              <span>60 cuotas</span>
            </div>
          </div>

          {/* Has Interest Switch */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
              ¿Aplica Tasa de Interés?
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setHasInterest(false);
                  regenerateScheduleIfAuto({ hasInterest: false });
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !hasInterest
                    ? 'bg-[#2d8a58] text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Sin Interés (0%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasInterest(true);
                  regenerateScheduleIfAuto({ hasInterest: true });
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  hasInterest
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Con Intereses
              </button>
            </div>
          </div>

          {/* Monthly Interest Rate (if applicable) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-slate-400" />
              Tasa de Interés Mensual (% M.V.):
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                disabled={!hasInterest}
                value={hasInterest ? monthlyInterestRatePercent : '0.0'}
                onChange={(e) => {
                  const r = e.target.value;
                  setMonthlyInterestRatePercent(r);
                  regenerateScheduleIfAuto({ ratePercent: r });
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">% mes</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {hasInterest ? `Equivale a ~${((parseFloat(monthlyInterestRatePercent) || 0) * 12).toFixed(1)}% E.A.` : 'Financiación directa a 0%'}
            </span>
          </div>
        </div>

        {/* 3. Live Balance Validation Status Banner */}
        <div className={`p-4 rounded-2xl border transition-all ${
          validation.isValid
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {validation.isValid ? (
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 animate-pulse">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <h4 className="text-xs font-black">
                  {validation.isValid
                    ? '✅ Cronograma Cuadrado con Precisión'
                    : '⚠️ Descuadre en el Cronograma de Cuotas'}
                </h4>
                <p className="text-xs opacity-90">
                  Suma de cuotas: <strong>{formatCOP(validation.totalSum)}</strong> &bull; Saldo a financiar: <strong>{formatCOP(financedAmount)}</strong>
                  {!validation.isValid && (
                    <span className="ml-1 text-rose-600 font-black">
                      (Diferencia: {formatCOP(Math.abs(validation.difference))})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {!validation.isValid && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleAdjustLastInstallment}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Ajustar Última Cuota
                </button>
                <button
                  type="button"
                  onClick={handleRecalculateSchedule}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  Distribuir Igual
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4. Interactive Installments Table (Editable Cuota by Cuota) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#2d8a58]" />
              Cronograma de Cuotas Mensuales (Puedes editar el valor o fecha de cada cuota manualmente):
            </span>
            {isCustomSchedule && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200">
                Editado manualmente
              </span>
            )}
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10">
                <tr>
                  <th className="py-2.5 px-4 w-20">Cuota #</th>
                  <th className="py-2.5 px-4">Fecha Vencimiento</th>
                  <th className="py-2.5 px-4">Valor Cuota (Editable)</th>
                  {hasInterest && <th className="py-2.5 px-4">Interés</th>}
                  {hasInterest && <th className="py-2.5 px-4">Capital</th>}
                  <th className="py-2.5 px-4 text-right">Saldo Restante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {schedule.map((inst, index) => (
                  <tr key={index} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-4 font-mono font-black text-slate-800 dark:text-white">
                      #{inst.installment_number}
                    </td>

                    <td className="py-2 px-4">
                      <input
                        type="date"
                        value={inst.due_date}
                        onChange={(e) => handleInstallmentDateChange(index, e.target.value)}
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
                      />
                    </td>

                    <td className="py-2 px-4">
                      <div className="relative max-w-xs">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="1000"
                          min="0"
                          value={inst.amount}
                          onChange={(e) => handleInstallmentAmountChange(index, e.target.value)}
                          className="w-full pl-6 pr-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2d8a58] focus:outline-none text-xs"
                        />
                      </div>
                    </td>

                    {hasInterest && (
                      <td className="py-2 px-4 text-amber-600 font-semibold text-[11px]">
                        {formatCOP(inst.interest || 0)}
                      </td>
                    )}

                    {hasInterest && (
                      <td className="py-2 px-4 text-emerald-600 font-semibold text-[11px]">
                        {formatCOP(inst.principal || 0)}
                      </td>
                    )}

                    <td className="py-2 px-4 text-right font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                      {formatCOP(inst.remaining_balance || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. Terms, Guarantees & Signatures Setup */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#2d8a58]" />
          Términos de Ejecución y Garantías
        </h2>

        {/* Legalization Included Toggle */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2d8a58]" />
              ¿Incluye trámites de legalización ante el Operador de Red?
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {legalizationIncluded
                ? 'El contrato incluirá cláusulas de trámites ante el Operador de Red y creará automáticamente el expediente en Legalizaciones.'
                : 'Se suprimirán del contrato el término "LEGALIZACIÓN" y todas las cláusulas de trámites ante el operador de red. No se aperturará expediente.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLegalizationIncluded(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                legalizationIncluded
                  ? 'bg-[#2d8a58] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Incluido
            </button>
            <button
              type="button"
              onClick={() => setLegalizationIncluded(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !legalizationIncluded
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              No Incluido
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Plazo de Entrega e Instalación:
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="365"
                value={executionTimeDays}
                onChange={(e) => setExecutionTimeDays(parseInt(e.target.value) || 180)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">días</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Garantía Paneles Solares:
            </label>
            <div className="relative">
              <input
                type="number"
                value={warrantyPanels}
                onChange={(e) => setWarrantyPanels(parseInt(e.target.value) || 12)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">años</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Garantía Inversor:
            </label>
            <div className="relative">
              <input
                type="number"
                value={warrantyInverter}
                onChange={(e) => setWarrantyInverter(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">años</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Garantía de Instalación:
            </label>
            <div className="relative">
              <input
                type="number"
                value={warrantyInstallation}
                onChange={(e) => setWarrantyInstallation(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">años</span>
            </div>
          </div>
        </div>

        {/* Representative Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Representante Legal (Contratista):
            </label>
            <input
              type="text"
              value={contractorRepName}
              onChange={(e) => setContractorRepName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Cédula / Documento Representante:
            </label>
            <input
              type="text"
              value={contractorRepDoc}
              onChange={(e) => setContractorRepDoc(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Custom Clauses / Notes */}
        <div className="pt-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Cláusulas Especiales / Observaciones Contractuales:
          </label>
          <textarea
            rows="3"
            value={customClauses}
            onChange={(e) => setCustomClauses(e.target.value)}
            placeholder="Ej. El contratante se compromete a facilitar el ingreso del personal técnico en jornada continua de 8:00 AM a 5:00 PM..."
            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-[#2d8a58] focus:outline-none"
          />
        </div>

        {/* Save Button */}
        <div className="pt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSaveContract}
            disabled={saving}
            className="px-6 py-3 rounded-2xl bg-[#2d8a58] hover:bg-[#237348] text-white font-black text-sm shadow-lg shadow-[#2d8a58]/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{saving ? 'Guardando Contrato...' : 'Guardar y Generar Documento Legal'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
