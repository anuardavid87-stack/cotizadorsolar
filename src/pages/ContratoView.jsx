import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileSignature, Printer, ArrowLeft, Edit2, CheckCircle2,
  Calendar, DollarSign, Shield, Zap, Package, Building2,
  Clock, Phone, Mail, MapPin, User, Check, Instagram, Table,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCOP } from '../utils/formatters';
import { formatoMonedaLetras, numeroALetras } from '../utils/contractCalculator';
import { downloadContractWordDoc } from '../utils/contractWordExporter';

function formatContractDateSpanish(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const monthName = months[(month || 1) - 1] || 'septiembre';
  return `a los ${day || 1} días del mes de ${monthName} de ${year || new Date().getFullYear()}`;
}

export default function ContratoView({ onNotify }) {
  const { id } = useParams();
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [contract, setContract] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showDetailedSchedule, setShowDetailedSchedule] = useState(true);

  const fetchContract = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/contracts/${id}`);
      if (!res.ok) throw new Error('Contrato no encontrado');
      const data = await res.json();
      setContract(data.contract);
      setSettings(data.settings);
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContract();
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    try {
      setUpdatingStatus(true);
      const res = await authFetch(`/api/contracts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Error al actualizar estado');
      setContract(prev => ({ ...prev, status: newStatus }));
      if (onNotify) onNotify({ type: 'success', message: `Estado actualizado a: ${newStatus}` });
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#2d8a58] border-t-transparent mx-auto"></div>
        <p className="text-xs text-slate-400 mt-3 font-semibold">Cargando contrato...</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-12 text-center">
        <h3 className="text-sm font-bold text-slate-700">Contrato no encontrado</h3>
        <button
          onClick={() => navigate('/contratos')}
          className="mt-4 px-4 py-2 rounded-xl bg-[#2d8a58] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Contratos</span>
        </button>
      </div>
    );
  }

  // Parse schedule and equipment
  let schedule = [];
  let invertersList = [];
  let batteriesList = [];
  let pumpsList = [];
  try {
    schedule = JSON.parse(contract.installments_schedule_json || '[]');
  } catch (e) {}
  try {
    invertersList = JSON.parse(contract.selected_inverters_json || '[]');
    batteriesList = JSON.parse(contract.selected_batteries_json || '[]');
    pumpsList = JSON.parse(contract.selected_pumps_json || '[]');
  } catch (e) {}

  const company = {
    company_name: settings?.company_name || 'SOLARTECH COL. S.A.S.',
    nit: settings?.nit || '901756614 - 5',
    nit_formatted: '901.756.614-5',
    address: settings?.address || 'Calle 14 # 16ª - 49 Barrio San José',
    city: settings?.city || 'Magangué',
    department: settings?.department || 'Bolívar',
    phone: settings?.phone || '+57 300 187 7158',
    phone_secondary: '3017860859',
    email: settings?.email || 'ventas@renovaenergy.com.co',
    instagram: settings?.instagram || 'renovasolarenergy',
    website: settings?.website || 'W W W . R E N O V A E N E R G Y . C O M',
    legal_rep_name: contract.contractor_rep_name || settings?.legal_rep_name || 'NELLIS ELENA MANJARREZ RODRÍGUEZ',
    legal_rep_doc: contract.contractor_rep_doc || settings?.legal_rep_doc || '1.052.952.061',
    bank_name: settings?.bank_name || 'Bancolombia',
    bank_account_type: settings?.bank_account_type || 'Cuenta de ahorros',
    bank_account_number: settings?.bank_account_number || '48400003755',
    bank_key: '0090969263'
  };

  const totalVal = Math.round(contract.total_contract_value || 0);
  const downPaymentVal = Math.round(contract.down_payment_amount || 0);
  const financedVal = Math.round(contract.financed_amount || (totalVal - downPaymentVal));
  const countCuotas = contract.installments_count || (schedule.length > 0 ? schedule.length : 1);
  const averageCuota = schedule.length > 0 && schedule[0].amount
    ? Math.round(schedule[0].amount)
    : Math.round(financedVal / countCuotas);

  const durationDays = contract.execution_time_days || 60;
  const daysForStart = contract.days_for_installation_start || 30;
  const warrantyPanelsYears = contract.warranty_years_panels || 12;
  const warrantyInverterYears = contract.warranty_years_inverter || 5;
  const warrantyInstallationYears = contract.warranty_years_installation || 1;
  const hasLegalization = contract.legalization_included !== 0 && contract.legalization_included !== false && contract.legalization_included !== '0';
  const clientOperator = contract.client_operator || 'OPERADOR DE RED';

  // Equipment Table Items (matching exact PDF structure)
  const equipmentRows = [];

  // 1. Panels
  if (contract.installed_panels > 0) {
    equipmentRows.push({
      quantity: contract.installed_panels,
      product: `PANEL SOLAR ${contract.panel_power_w || 630} W BIFACIAL TRINA SOLAR`,
      potencia: `${contract.installed_power_kwp || 0} kWp`
    });
  }

  // 2. Inverters
  if (invertersList.length > 0) {
    invertersList.forEach(inv => {
      equipmentRows.push({
        quantity: inv.quantity || 1,
        product: inv.name || `INVERSOR HIBRIDO BIFASICO\nMARCA: SOLIS CAPACIDAD ${inv.power_kw || contract.installed_power_kwp || 16}KW`,
        potencia: `${inv.power_kw || contract.installed_power_kwp || 16} kW`
      });
    });
  } else {
    equipmentRows.push({
      quantity: 1,
      product: `INVERSOR HIBRIDO BIFASICO\nMARCA: SOLIS CAPACIDAD ${contract.installed_power_kwp || 16}KW`,
      potencia: `${contract.installed_power_kwp || 16} kW`
    });
  }

  // 3. Structure
  equipmentRows.push({
    quantity: 1,
    product: contract.structure_type ? `ESTRUCTURA SOBRE TECHO EN ALUMINIO (${contract.structure_type.toUpperCase()})` : 'ESTRUCTURA SOBRE TECHO EN ALUMINIO (ESTRUCTURA DE ALUMINIO SOBRE TEJADO)',
    potencia: `${contract.installed_power_kwp || 0} KWP`
  });

  // 4. Legalization (only if included)
  if (hasLegalization) {
    equipmentRows.push({
      quantity: 1,
      product: 'LEGALIZACION SISTEMA FOTOVOLTAICO',
      potencia: `${contract.installed_power_kwp || 0} kW`
    });
  }

  // 5. Batteries (if any)
  if (batteriesList.length > 0) {
    batteriesList.forEach(bat => {
      equipmentRows.push({
        quantity: bat.quantity || 1,
        product: bat.name || `BATERIA ${bat.capacity_ah || 300} A`,
        potencia: `${bat.capacity_ah || 300} A`
      });
    });
  }

  // 6. Pumps (if any)
  if (pumpsList.length > 0) {
    pumpsList.forEach(pump => {
      equipmentRows.push({
        quantity: pump.quantity || 1,
        product: pump.name || 'BOMBA SOLAR',
        potencia: `${pump.power_hp || 1} HP`
      });
    });
  }

  const handleDownloadWord = () => {
    try {
      downloadContractWordDoc({
        contract,
        company,
        equipmentRows,
        schedule
      });
      if (onNotify) onNotify({ type: 'success', message: 'Documento Word (.doc) generado y descargado con éxito.' });
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: 'Error al exportar a Word: ' + err.message });
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-6">
      {/* Top Action Bar (no-print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/contratos')}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Volver al listado"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-[#2d8a58]">{contract.contract_code}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                contract.status === 'firmado' ? 'bg-emerald-100 text-emerald-800' :
                contract.status === 'en_ejecucion' ? 'bg-blue-100 text-blue-800' :
                contract.status === 'finalizado' ? 'bg-purple-100 text-purple-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {contract.status === 'en_ejecucion' ? 'En Construcción' : contract.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cliente: <strong>{contract.client_name}</strong> &bull; Fecha: {contract.contract_date}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Changer */}
          <select
            value={contract.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updatingStatus}
            className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="borrador">Borrador</option>
            <option value="firmado">Firmado</option>
            <option value="en_ejecucion">En Construcción</option>
            <option value="finalizado">Finalizado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <button
            type="button"
            onClick={() => setShowDetailedSchedule(!showDetailedSchedule)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Alternar vista de tabla de amortización detallada"
          >
            <Table className="w-3.5 h-3.5" />
            <span>{showDetailedSchedule ? 'Ocultar Cronograma Detallado' : 'Ver Cronograma Detallado'}</span>
          </button>

          <button
            onClick={() => navigate(`/contrato/editar/${contract.id}`)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Editar Condiciones</span>
          </button>

          {/* Word Download Button */}
          <button
            onClick={handleDownloadWord}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            title="Descargar contrato editable en formato Microsoft Word (.doc)"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Descargar en Word</span>
          </button>

          {/* Print / Save PDF Button */}
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#2d8a58]/20 transition-all cursor-pointer"
            title="Imprimir contrato con márgenes ajustados o guardar como PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Legal Contract Document - Exact Renova Letterhead */}
      <div className="contract-print-page bg-white text-slate-900 p-8 sm:p-14 rounded-3xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none print:rounded-none font-sans text-xs leading-relaxed text-justify relative">
        
        {/* Centered Watermark (Present on every page behind content) */}
        <div className="contract-watermark-container pointer-events-none select-none">
          <img
            src="/renova_logo.png"
            alt="Renova Watermark"
            className="contract-watermark"
          />
        </div>

        {/* Master Paged Document Table for Repeating Header and Footer on Every Print Page */}
        <table className="contract-doc-table w-full border-none border-collapse">
          {/* HEADER: Repeating on Every Page */}
          <thead>
            <tr>
              <td className="border-none p-0 pb-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <img
                      src="/renova_logo.png"
                      alt="Renova Energy"
                      className="h-14 sm:h-16 w-auto object-contain"
                    />
                  </div>

                  <div className="text-right text-[11px] text-slate-800 space-y-1">
                    <div className="flex items-center justify-end gap-1.5 font-medium">
                      <span>{company.phone}</span>
                      <span className="w-4 h-4 rounded-full bg-[#1b4332] text-white flex items-center justify-center text-[10px]">
                        <Phone className="w-2.5 h-2.5 fill-current" />
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 font-medium">
                      <span className="text-[10px]">{company.email}</span>
                      <span className="w-4 h-4 rounded-full bg-[#1b4332] text-white flex items-center justify-center text-[10px]">
                        <Mail className="w-2.5 h-2.5 fill-current" />
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 font-medium">
                      <span>{company.instagram}</span>
                      <span className="w-4 h-4 rounded-full bg-[#1b4332] text-white flex items-center justify-center text-[10px]">
                        <Instagram className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </thead>

          {/* FOOTER: Repeating on Every Page */}
          <tfoot>
            <tr>
              <td className="border-none p-0 pt-4">
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-[10px] text-slate-700">
                  <span className="font-bold tracking-widest text-slate-800">{company.website}</span>
                  <span className="flex items-center gap-1 font-medium">
                    <span>Kra 14#16-49 Barrio San José | Magangué</span>
                    <MapPin className="w-3 h-3 text-[#9bc53d] fill-current" />
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>

          {/* MAIN DOCUMENT BODY */}
          <tbody>
            <tr>
              <td className="border-none p-0">
                {/* Contract Title */}
                <div className="text-center my-6">
                  <h1 className="text-xs sm:text-sm font-black uppercase text-slate-900 tracking-wide max-w-xl mx-auto leading-snug">
                    CONTRATO DE DISEÑO, INSTALACIÓN, MANO DE OBRA Y SUMINISTRO DE EQUIPOS DE SISTEMA FOTOVOLTAICO
                  </h1>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    REF: {contract.contract_code} (Cotización {contract.quote_code})
                  </p>
                </div>

                {/* Preamble / Parties */}
                <div className="space-y-3.5 text-justify text-slate-800 leading-relaxed">
                  <p>
                    Entre <strong>{(contract.client_name || '').toUpperCase()}</strong> identificado con {contract.client_doc_type || 'cedula de ciudadanía'} número <strong>{contract.client_doc_number || 'N/A'}</strong>, teléfono <strong>{contract.client_phone || 'N/A'}</strong>, quien para efectos del presente contrato se denominará <strong>EL CONTRATANTE</strong>, y <strong>{company.company_name}</strong> Identificada con NIT <strong>{company.nit}</strong>, ubicada en la <strong>{company.address} {company.city} - {company.department}</strong>, teléfono <strong>{company.phone_secondary || company.phone}</strong>, en representación de la empresa estará <strong>{company.legal_rep_name.toUpperCase()}</strong> Identificada con cédula de ciudadanía numero <strong>{company.legal_rep_doc}</strong> quien para efectos del presente contrato se denominará <strong>EL CONTRATISTA</strong>, conjuntamente <strong>LAS PARTES</strong>, hemos convenido en celebrar el presente contrato de <strong>COMPRAVENTA</strong>, el cual estará regido por las siguientes <strong>CONSIDERACIONES</strong>:
                  </p>

                  {/* PRIMERA. - OBJETO */}
                  <div className="pt-2">
                    <p>
                      <strong>PRIMERA. - OBJETO:</strong> EL CONTRATISTA se obliga a transferir al CONTRATANTE a título de <strong>COMPRAVENTA</strong>, y este último se obliga a adquirir a este mismo título, el diseño e instalación de un sistema fotovoltaico conectado a la red de <strong>{contract.installed_power_kwp || 0} KWP</strong>, el cual consta de los siguientes artículos:
                    </p>

                    {/* Official Equipment Table with Green Header */}
                    <div className="my-3 border border-slate-700 rounded-xs overflow-hidden">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-[#b8d655] text-slate-950 font-bold border-b border-slate-700">
                          <tr>
                            <th className="py-1.5 px-3 border-r border-slate-700 text-center w-24">CANTIDAD</th>
                            <th className="py-1.5 px-3 border-r border-slate-700">PRODUCTO</th>
                            <th className="py-1.5 px-3 text-center w-32">POTENCIA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-400">
                          {equipmentRows.map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-400">
                              <td className="py-1.5 px-3 border-r border-slate-400 text-center font-bold">
                                {row.quantity}
                              </td>
                              <td className="py-1.5 px-3 border-r border-slate-400 font-semibold uppercase whitespace-pre-line">
                                {row.product}
                              </td>
                              <td className="py-1.5 px-3 text-center font-bold">
                                {row.potencia}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SEGUNDA. - DURACIÓN */}
                  <p>
                    <strong>SEGUNDA. - DURACIÓN:</strong> El término de duración del presente contrato será de <strong>({durationDays}) días calendario</strong> contados a partir de la fecha de suscripción del mismo.
                  </p>

                  {/* TERCERA. – VALOR */}
                  <p>
                    <strong>TERCERA. – VALOR:</strong> El valor total del presente contrato es la suma de <strong>{formatoMonedaLetras(totalVal)} ($ {formatCOP(totalVal)})</strong> moneda legal colombiana.
                  </p>

                  {/* CUARTA. - FORMA DE PAGO */}
                  <div className="pt-2">
                    <p>
                      <strong>CUARTA. - FORMA DE PAGO:</strong> EL CONTRATANTE cancelará a EL CONTRATISTA la suma de <strong>{formatoMonedaLetras(totalVal)} ($ {formatCOP(totalVal)})</strong>, moneda legal colombiana, de la siguiente forma:
                    </p>

                    {/* Official Payment Conditions Table */}
                    <div className="my-3 border border-slate-700 rounded-xs overflow-hidden">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-[#b8d655] text-slate-950 font-bold border-b border-slate-700">
                          <tr>
                            <th className="py-1.5 px-3 border-r border-slate-700 w-36">Concepto</th>
                            <th className="py-1.5 px-3 border-r border-slate-700 w-32 text-right">Valor</th>
                            <th className="py-1.5 px-3">Condición de pago</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-400">
                          <tr className="border-b border-slate-400">
                            <td className="py-2 px-3 border-r border-slate-400 font-bold uppercase">
                              VALOR TOTAL DEL PROYECTO
                            </td>
                            <td className="py-2 px-3 border-r border-slate-400 font-black text-right text-slate-950">
                              $ {formatCOP(totalVal)}
                            </td>
                            <td className="py-2 px-3">
                              Sistema fotovoltaico con suministro, instalación.
                            </td>
                          </tr>

                          <tr className="border-b border-slate-400">
                            <td className="py-2 px-3 border-r border-slate-400 font-bold uppercase">
                              CUOTA INICIAL
                            </td>
                            <td className="py-2 px-3 border-r border-slate-400 font-black text-right text-slate-950">
                              $ {formatCOP(downPaymentVal)}
                            </td>
                            <td className="py-2 px-3">
                              Se cancela al momento de la firma del contrato para dar inicio al proyecto.
                            </td>
                          </tr>

                          <tr>
                            <td className="py-2 px-3 border-r border-slate-400 font-bold uppercase">
                              SALDO
                            </td>
                            <td className="py-2 px-3 border-r border-slate-400 font-black text-right text-slate-950">
                              $ {formatCOP(financedVal)}
                            </td>
                            <td className="py-2 px-3">
                              Será diferido sin intereses a {countCuotas} cuotas mensuales (${formatCOP(averageCuota)}) pagando la primera cuota el {contract.first_installment_date ? contract.first_installment_date : '30 de octubre del presente año'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <p className="mt-2 text-slate-800">
                      Los pagos deberán realizarse de manera mensual, consecutiva e ininterrumpida, conforme al acuerdo de pago establecido entre las partes.
                    </p>
                    <p className="mt-2 text-slate-800">
                      Los pagos descritos en el presente contrato serán realizados mediante consignación bancaria o transferencia electrónica a la siguiente cuenta:
                    </p>
                    <p className="mt-2 text-slate-900 font-bold">
                      Titular: {company.company_name} NIT: {company.nit_formatted || company.nit} Banco: {company.bank_name} Tipo de cuenta: {company.bank_account_type} No. de cuenta: {company.bank_account_number} Llave: {company.bank_key || '0090969263'}
                    </p>
                    <p className="mt-2 text-slate-800">
                      El CONTRATANTE deberá conservar y presentar el respectivo comprobante de cada pago realizado como soporte del cumplimiento de las obligaciones económicas establecidas en el presente contrato.
                    </p>

                    {/* Detailed Schedule Table */}
                    {schedule && schedule.length > 0 && (
                      <div className="mt-4">
                        <p className="font-bold text-[11px] text-slate-900 mb-1.5">
                          Cronograma de Cuotas Mensuales ({countCuotas} cuotas):
                        </p>
                        <div className="border border-slate-700 rounded-xs overflow-hidden">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-[#b8d655] text-slate-950 font-bold border-b border-slate-700">
                              <tr>
                                <th className="py-1.5 px-3 border-r border-slate-700 text-center w-24">Cuota #</th>
                                <th className="py-1.5 px-3 border-r border-slate-700 text-center w-36">Fecha Vencimiento</th>
                                <th className="py-1.5 px-3 border-r border-slate-700 text-right">Valor Cuota</th>
                                <th className="py-1.5 px-3 text-right">Saldo Restante</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-400 font-sans">
                              {schedule.map((inst, i) => (
                                <tr key={i} className="border-b border-slate-400">
                                  <td className="py-1.5 px-3 border-r border-slate-400 text-center font-bold">Cuota #{inst.installment_number}</td>
                                  <td className="py-1.5 px-3 border-r border-slate-400 text-center">{inst.due_date}</td>
                                  <td className="py-1.5 px-3 border-r border-slate-400 text-right font-bold text-slate-900">$ {formatCOP(inst.amount)}</td>
                                  <td className="py-1.5 px-3 text-right text-slate-800">$ {formatCOP(inst.remaining_balance || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QUINTA. - ENTREGA */}
                  <p>
                    <strong>QUINTA. - ENTREGA:</strong> Una vez verificado por parte de EL CONTRATISTA el pago de la cuota inicial, EL CONTRATISTA procederá a programar la entrega e instalación de la totalidad de los bienes objeto de la compraventa; todo lo anterior conforme a lo estipulado en la Cláusula cuarta del presente contrato, La entrega e instalación se realizará en su totalidad en la Dirección de EL CONTRATANTE <strong>{contract.client_address || ''} {contract.client_city || ''} {contract.client_department || ''}</strong>.
                  </p>

                  {/* SEXTA. - OBLIGACIONES DEL CONTRATANTE */}
                  {hasLegalization ? (
                    <div className="space-y-1">
                      <p>
                        <strong>SEXTA. - OBLIGACIONES DEL CONTRATANTE:</strong> 1) Disponer del sitio o lugar, para que EL CONTRATISTA pueda enviar, almacenar e instalar LOS MATERIALES sin contratiempo alguno. 2) Pagar el valor pactado en la forma y términos indicados en este contrato. 3)Es obligación de EL CONTRATANTE suministrar de manera oportuna los documentos necesarios para realizar los trámites ante el operador de red como son:
                      </p>
                      <ul className="list-disc list-inside pl-3 space-y-0.5">
                        <li>Fotocopia de la cedula</li>
                        <li>Fotocopia del certificado de libertad y tradición del inmueble donde se realiza la instalación</li>
                        <li>Copia del último recibo de energía</li>
                        <li>Cámara de comercio y Rut (si aplica)</li>
                      </ul>
                    </div>
                  ) : (
                    <p>
                      <strong>SEXTA. - OBLIGACIONES DEL CONTRATANTE:</strong> 1) Disponer del sitio o lugar, para que EL CONTRATISTA pueda enviar, almacenar e instalar LOS MATERIALES sin contratiempo alguno. 2) Pagar el valor pactado en la forma y términos indicados en este contrato.
                    </p>
                  )}

                  {/* SÉPTIMA. — OBLIGACIONES DEL CONTRATISTA */}
                  {hasLegalization ? (
                    <p>
                      <strong>SÉPTIMA. — OBLIGACIONES DEL CONTRATISTA:</strong> 1) Realizar la entrega de todos los productos indicados en la primera cláusula, en el lugar estipulado para tal fin por EL CONTRATANTE en el presente contrato. 2) Llevar a cabo la instalación de dichos productos según lo establecido en la cotización realizada y bajo los requerimientos técnicos descritos. cómo llevar a cabo todos los trámites de legalización requeridos ante el <strong>({clientOperator})</strong>, para el funcionamiento del proyecto, dándose por entendido que el tiempo en el que se realicen y aprueben dichos trámites dependerá del operador de red, y no del CONTRATISTA. 3) Entregar al CONTRATANTE el documento de garantías de los productos.
                    </p>
                  ) : (
                    <p>
                      <strong>SÉPTIMA. — OBLIGACIONES DEL CONTRATISTA:</strong> 1) Realizar la entrega de todos los productos indicados en la primera cláusula, en el lugar estipulado para tal fin por EL CONTRATANTE en el presente contrato. 2) Llevar a cabo la instalación de dichos productos según lo establecido en la cotización realizada y bajo los requerimientos técnicos descritos. 3) Entregar al CONTRATANTE el documento de garantías de los productos.
                    </p>
                  )}

                  {/* OCTAVA.- CLÁUSULA PENAL */}
                  <p>
                    <strong>OCTAVA.- CLÁUSULA PENAL:</strong> En caso de incumplimiento por cualquiera de las partes de las obligaciones legales o contractuales, dará derecho a la parte cumplida a exigir como pago la suma del <strong>veinte por ciento (20%)</strong> del valor total del contrato, como pena por dicho incumplimiento, sin que haya lugar a requerimiento o constitución en mora alguna y para lo cual el presente contrato prestará mérito ejecutivo, sin perjuicio que la parte que hace efectivo el cumplimiento de la pena, persevere en la ejecución del contrato.
                  </p>

                  {/* NOVENA.- DECLARACIÓN DE PRINCIPIOS DE PREVENCIÓN DE FRAUDE */}
                  <p>
                    <strong>NOVENA.- DECLARACIÓN DE PRINCIPIOS DE PREVENCIÓN DE FRAUDE.- NOVENA.- PREVENCIÓN DE LAVADO DE ACTIVOS, FINANCIACIÓN DEL TERRORISMO (LA/FT), ANTICORRUPCIÓN Y PREVENCIÓN DE FRAUDE.-</strong> Las partes declaran que: 1) Las actividades propias de su objeto social, así como los recursos y activos que conforman su patrimonio y el de sus socios, accionistas, representantes legales y/o administradores, tienen un origen lícito y no provienen directa o indirectamente del ejercicio de actividades ilícitas, de fraude, soborno, corrupción, lavado de activos o financiación del terrorismo, ni han sido utilizados como medios o instrumentos para la realización de las mismas; 2) No se encuentran incluidos, ni ellos ni sus socios o representantes legales, en listas restrictivas nacionales o internacionales vinculantes para Colombia (tales como la lista OFAC/Lista Clinton, listas de la ONU, entre otras), ni existen antecedentes por sanciones en firme o investigaciones en curso relacionadas con LA/FT, fraude o corrupción por parte de autoridades colombianas o extranjeras; 3) Adoptarán adecuados procedimientos y mecanismos de detección y prevención de actividades irregulares. Si en desarrollo del presente contrato se identifica cualquier irregularidad o sospecha de actos fraudulentos, serán inmediatamente reportados a la otra parte; 4) Prestarán la colaboración requerida para adelantar las investigaciones pertinentes. En el evento en que cualquiera de las partes, sus socios, accionistas, administradores o representantes legales llegaren a ser vinculados por las autoridades competentes a cualquier tipo de investigación por la presunta comisión de delitos relacionados con LA/FT, corrupción o fraude, o sean incluidos en listas restrictivas, se entenderá como justa causa para que la parte cumplida pueda terminar unilateralmente y de manera inmediata el presente contrato, sin que haya lugar al pago de indemnización alguna.
                  </p>

                  {/* DÉCIMA. - AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS */}
                  <p>
                    <strong>DÉCIMA. - AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS.</strong> Se entiende para todos los efectos, que, con la firma del presente contrato, las partes manifiestan de manera previa, libre, voluntaria, inequívoca e informada su autorización para realizar el tratamiento de los datos personales. En cumplimiento de la normativa de Protección de Datos Personales, especialmente la Ley 1581 de 2012 y Decreto 1377 de 2013 y demás normas que los modifiquen y/o adicionen y/o sustituyan, las Partes se autorizan para realizar el tratamiento de sus datos personales o de titulares relacionados derivados del presente vínculo contractual directamente o a través de terceros encargados de dicho tratamiento, con la finalidad de ejecutar las diversas actividades relacionadas con el negocio jurídico. Por tratamiento de datos se entiende cualquier operación o conjunto de operaciones sobre datos personales, tales como, la recolección, almacenamiento, uso, circulación, transmisión, transferencia y/o supresión. La presente autorización incluye la transferencia y/o transmisión de los datos en Colombia, que sean administrados por las entidades vinculadas a las partes.
                  </p>

                  {/* DÉCIMA PRIMERA.- CLÁUSULA COMPROMISORIA */}
                  <p>
                    <strong>DÉCIMA PRIMERA.- CLÁUSULA COMPROMISORIA.-</strong> Toda controversia o diferencia relativa a éste contrato y al cumplimiento de cualquiera de las obligaciones señaladas en el mismo que surja entre las partes, no pudiendo arreglar amigablemente, se resolverá por el Tribunal de Arbitramento designado por la Cámara de Comercio de <strong>{company.city}</strong>, que se sujetará a lo dispuesto en Ley 1563 de 2012 y, o en las normas que lo reglamenten, adicionen o modifiquen, de acuerdo con las siguientes reglas: a) El Tribunal estará integrado por un (1) árbitro, cuyo nombramiento es delegado por las partes al Centro de Conciliación y Arbitraje de la Cámara de Comercio de {company.city}. b) La organización interna del Tribunal se sujetará a las reglas previstas para el efecto por el Centro de Conciliación y Arbitraje de la Cámara de Comercio de {company.city}. c) El Tribunal decidirá en derecho y los gastos que ocasione serán asumidos por la parte vencida. d) El Tribunal funcionará en {company.city}, en el Centro de Conciliación y Arbitraje de la Cámara de Comercio de esta Ciudad y quedará facultado para conciliar las pretensiones opuestas.
                  </p>

                  {/* DÉCIMA SEGUNDA. - LUGAR DE EJECUCIÓN */}
                  <p>
                    <strong>DÉCIMA SEGUNDA. - LUGAR DE EJECUCIÓN:</strong> Los elementos objeto del presente contrato serán enviados e instalados por el CONTRATISTA en el domicilio del EL CONTRATANTE, ubicado en la <strong>{contract.client_address || ''} {contract.client_city || ''} {contract.client_department || ''}</strong>.
                  </p>

                  {/* DÉCIMA TERCERA. - MÉRITO EJECUTIVO */}
                  <p>
                    <strong>DÉCIMA TERCERA. - MÉRITO EJECUTIVO. -</strong> El presente contrato presta mérito ejecutivo. Las partes renuncian a los requerimientos de ley para efectos de constituirse en mora.
                  </p>

                  {/* DÉCIMA CUARTA. - MODIFICACIONES */}
                  <p>
                    <strong>DÉCIMA CUARTA. - MODIFICACIONES. -</strong> Cualquier modificación de las estipulaciones contenidas en el presente contrato o adición al mismo, deberá realizarse por escrito y con la firma de ambas partes.
                  </p>

                  {/* DÉCIMA QUINTA. - DOMICILIO */}
                  <p>
                    <strong>DÉCIMA QUINTA. - DOMICILIO:</strong> Para todos los efectos de ejecución del objeto contractual, las partes acuerdan como domicilio la ciudad de <strong>{company.city} - {company.department}</strong>.
                  </p>

                  {/* DÉCIMA SEXTA. - CLÁUSULA DE GARANTÍA */}
                  <div className="space-y-2 pt-1">
                    <p><strong>DÉCIMA SEXTA. - CLÁUSULA DE GARANTÍA:</strong></p>
                    
                    <p className="pl-3">
                      <strong>1. GARANTÍA DE INSTALACIÓN:</strong> EL CONTRATISTA garantiza la instalación de los equipos fotovoltaicos por un período de <strong>{warrantyInstallationYears} año(s)</strong> a partir de la fecha de finalización de la instalación. Esta garantía cubre defectos de mano de obra y materiales utilizados en la instalación. Durante este período, <strong>{company.company_name}</strong> se compromete a realizar las reparaciones o sustituciones necesarias para corregir cualquier defecto de instalación, sin costo adicional para el cliente.
                    </p>

                    <p className="pl-3">
                      <strong>2. ACOMPAÑAMIENTO EN MANTENIMIENTO:</strong> EL CONTRATISTA ofrece un servicio de acompañamiento en la supervisión de los equipos fotovoltaicos por un período de <strong>1 (un) año</strong> a partir de la fecha de finalización de la instalación. Este servicio incluye: asesoría técnica telefónica o por correo electrónico, visita de inspección cumplido 1 año de la instalación o antes si el sistema lo requiere teniendo en cuenta servicios y garantías necesarias.
                    </p>

                    <p className="pl-3">
                      <strong>3. GARANTÍA DEL FABRICANTE:</strong>
                      <br />&bull; <strong>Inversor:</strong> de <strong>{warrantyInverterYears} años</strong> a partir de la fecha de compra.
                      <br />&bull; <strong>Paneles:</strong> de <strong>{warrantyPanelsYears} años</strong> a partir de la fecha de compra.
                    </p>

                    <p className="pl-3">
                      <strong>4. EXCLUSIONES DE LA GARANTÍA:</strong> No cubre daños causados por negligencia, mal uso, accidentes, actos de terceros o fuerza mayor.
                    </p>

                    <p className="pl-3">
                      <strong>5.RESOLUCIÓN DE CONTROVERSIAS:</strong> Cualquier controversia se resolverá amistosamente o ante los tribunales competentes.
                    </p>
                  </div>

                  {/* DÉCIMA SÉPTIMA. - DIRECCIÓN PARA NOTIFICACIÓN */}
                  <p>
                    <strong>DÉCIMA SÉPTIMA. - DIRECCIÓN PARA NOTIFICACIÓN. -</strong> Las partes recibirán notificaciones en las siguientes direcciones: <strong>{company.company_name}</strong>: {company.address} {company.city} - {company.department}; <strong>EL CONTRATANTE</strong>: {contract.client_address || ''} {contract.client_city || ''} {contract.client_department || ''}.
                  </p>

                  {/* DÉCIMA OCTAVA- TIEMPO DE ESPERA PARA INICIO DE OBRA */}
                  <div className="space-y-2 pt-1">
                    <p>
                      <strong>DÉCIMA OCTAVA- TIEMPO DE ESPERA PARA INICIO DE OBRA:</strong> El CONTRATISTA se compromete a iniciar la instalación del sistema solar <strong>treinta ({daysForStart}) días calendario</strong> posterior a la firma de este contrato y pago de la primera cuota.
                    </p>

                    {hasLegalization ? (
                      <>
                        <p className="pt-1">
                          <strong>PARÁGRAFO PRIMERO – INDEPENDENCIA DE LAS OBLIGACIONES DE PAGO:</strong> Las obligaciones de pago asumidas por EL CONTRATANTE son independientes de los tiempos requeridos para la ejecución de los trámites de legalización, aprobación, conexión o puesta en funcionamiento del sistema ante el operador de red, siempre que EL CONTRATISTA haya cumplido con las gestiones y obligaciones que le corresponden.
                        </p>

                        <p>
                          <strong>PARÁGRAFO SEGUNDO – NO SUSPENSIÓN AUTOMÁTICA DE PAGOS:</strong> Ninguna circunstancia externa no imputable a EL CONTRATISTA suspenderá ni modificará automáticamente las fechas de pago pactadas en el presente contrato, salvo acuerdo expreso y por escrito de las partes.
                        </p>

                        <p>
                          <strong>PARÁGRAFO TERCERO – TIEMPOS DEL OPERADOR DE RED:</strong> Las partes reconocen y aceptan que los trámites de legalización, revisión, aprobación, instalación o puesta en servicio del proyecto que deban ser realizados o autorizados por el operador de red están sujetos a los procedimientos, requisitos, disponibilidad de agenda y tiempos de respuesta establecidos por dicho operador de red.
                        </p>

                        <p>
                          <strong>PARÁGRAFO CUARTO – MODIFICACIONES AL CRONOGRAMA:</strong> Cualquier modificación de fechas, valores o condiciones de pago deberá constar por escrito y estar debidamente firmada por ambas partes.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="pt-1">
                          <strong>PARÁGRAFO PRIMERO – INDEPENDENCIA DE LAS OBLIGACIONES DE PAGO:</strong> Las obligaciones de pago asumidas por EL CONTRATANTE son independientes de factores externos no imputables al EL CONTRATISTA, siempre que EL CONTRATISTA haya cumplido con las gestiones técnicas de instalación y suministro que le corresponden.
                        </p>

                        <p>
                          <strong>PARÁGRAFO SEGUNDO – NO SUSPENSIÓN AUTOMÁTICA DE PAGOS:</strong> Ninguna circunstancia externa no imputable a EL CONTRATISTA suspenderá ni modificará automáticamente las fechas de pago pactadas en el presente contrato, salvo acuerdo expreso y por escrito de las partes.
                        </p>

                        <p>
                          <strong>PARÁGRAFO TERCERO – MODIFICACIONES AL CRONOGRAMA:</strong> Cualquier modificación de fechas, valores o condiciones de pago deberá constar por escrito y estar debidamente firmada por ambas partes.
                        </p>
                      </>
                    )}
                  </div>

                  {/* DÉCIMA NOVENA. - INTERESES MORATORIOS Y CUMPLIMIENTO EN LOS PAGOS */}
                  <div className="space-y-2 pt-1">
                    <p>
                      <strong>DÉCIMA NOVENA. - INTERESES MORATORIOS Y CUMPLIMIENTO EN LOS PAGOS:</strong>
                    </p>
                    <p>
                      EL CONTRATANTE se obliga a efectuar el pago de cada una de las cuotas pactadas en la <strong>Cláusula Cuarta – FORMA DE PAGO</strong>, en las fechas y por los valores allí establecidos.
                    </p>
                    <ul className="list-disc list-inside pl-3 space-y-1">
                      <li>
                        En caso de que EL CONTRATANTE no efectúe el pago de una cuota en la fecha de vencimiento pactada, incurrirá en mora automáticamente, sin necesidad de requerimiento previo, y <strong>EL CONTRATISTA</strong> podrá aplicar un <strong>interés moratorio equivalente al dos por ciento (2%) mensual sobre el valor de la cuota vencida</strong>, contado a partir del día siguiente a la fecha establecida para el pago.
                      </li>
                      <li>
                        El interés moratorio aquí pactado se aplicará <em>sin perjuicio de los demás derechos y acciones que correspondan a EL CONTRATISTA por el incumplimiento contractual y, en todo caso, sin exceder los límites máximos establecidos por la legislación colombiana vigente</em>.
                      </li>
                      <li>
                        El pago posterior de una cuota vencida no exonerará al CONTRATANTE del pago de los intereses de mora que se hayan causado hasta la fecha de su cancelación.
                      </li>
                    </ul>
                  </div>

                  {/* VIGÉSIMA - COMPOSICIÓN, ACEPTACIÓN, FECHA Y FIRMA DEL CONTRATO */}
                  <div className="pt-3">
                    <p><strong>VIGÉSIMA - COMPOSICIÓN, ACEPTACIÓN, FECHA Y FIRMA DEL CONTRATO:</strong></p>
                    <p className="mt-1">
                      &bull; En aceptación de las obligaciones que las partes adquieren, se suscribe el presente documento en dos (2) ejemplares de este {formatContractDateSpanish(contract.contract_date)}.
                    </p>
                  </div>

                  {/* Additional Custom Clauses if Present */}
                  {contract.custom_clauses && contract.custom_clauses.trim() !== '' && (
                    <div className="pt-2 border-t border-slate-200">
                      <p><strong>VIGÉSIMA PRIMERA. - CLÁUSULAS ESPECIALES ADICIONALES:</strong></p>
                      <p className="whitespace-pre-line text-slate-800 mt-1">
                        {contract.custom_clauses}
                      </p>
                    </div>
                  )}

                  {/* Signatures Block (Page 8 style) */}
                  <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-slate-300">
                    <div>
                      <p className="text-[11px] font-bold text-slate-800 mb-12">POR EL CONTRATISTA</p>
                      <div className="border-b border-slate-700 w-full mb-2"></div>
                      <p className="text-xs font-bold text-slate-950 uppercase">{company.legal_rep_name}</p>
                      <p className="text-[11px] text-slate-700">C.C. {company.legal_rep_doc}</p>
                      <p className="text-[11px] font-semibold text-slate-800">{company.company_name}</p>
                      <p className="text-[10px] text-slate-600">Representante Legal</p>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-slate-800 mb-12">POR EL CONTRATANTE</p>
                      <div className="border-b border-slate-700 w-full mb-2"></div>
                      <p className="text-xs font-bold text-slate-950 uppercase">{contract.client_name}</p>
                      <p className="text-[11px] text-slate-700">{contract.client_doc_type || 'C.C.'} {contract.client_doc_number}</p>
                      <p className="text-[10px] text-slate-600">Contratante</p>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
