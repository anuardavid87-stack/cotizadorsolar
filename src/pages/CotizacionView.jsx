import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Printer,
  PhoneCall,
  Calendar,
  ArrowLeft,
  SunMedium,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Building2,
  FileText,
  DollarSign,
  MessageSquare,
  Edit2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCOP, formatDate, formatKW, getSystemTypeName, getInterestBadgeInfo } from '../utils/formatters';
import Modal from '../components/Modal';

export default function CotizacionView({ onNotify }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { authFetch, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Followup modal state
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);
  const [followupInteraction, setFollowupInteraction] = useState('llamada');
  const [followupScore, setFollowupScore] = useState(8);
  const [followupComments, setFollowupComments] = useState('');
  const [followupAction, setFollowupAction] = useState('reprogramar'); // reprogramar, desiste, ganado
  const [nextDate, setNextDate] = useState('');
  const [desistReason, setDesistReason] = useState('Falta de presupuesto');
  const [submittingFollowup, setSubmittingFollowup] = useState(false);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/quotes/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Cotización no encontrada');
      setData(json);
      setFollowupScore(json.quote.interest_score || 7);
      setNextDate(json.quote.followup_date || '');
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
      navigate('/cotizaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuote();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    if (!data?.quote?.client_phone) {
      alert('El cliente no tiene teléfono registrado.');
      return;
    }
    const cleanPhone = data.quote.client_phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const text = encodeURIComponent(
      `Hola ${data.quote.client_name}, un gusto saludarte de parte de ${data.settings?.company_name || 'Renova Energy'}. Te compartimos la propuesta técnica para tu sistema ${getSystemTypeName(data.quote.system_type)} (${data.quote.installed_power_kwp} kWp) con código ${data.quote.quote_code} por un valor de ${formatCOP(data.quote.total_price)}. ¿Tienes disponibilidad hoy para revisar los detalles técnicos?`
    );
    window.open(`https://wa.me/${phoneWithCode}?text=${text}`, '_blank');
  };

  const handleSaveFollowup = async (e) => {
    e.preventDefault();
    try {
      setSubmittingFollowup(true);
      const payload = {
        quote_id: parseInt(id),
        client_id: data.quote.client_id,
        interaction_type: followupInteraction,
        interest_score: followupScore,
        comments: followupComments,
        action_taken: followupAction,
        next_followup_date: followupAction === 'reprogramar' ? nextDate : null,
        desist_reason: followupAction === 'desiste' ? desistReason : null
      };

      const res = await authFetch('/api/followups', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error al registrar seguimiento');

      if (onNotify) onNotify({ type: 'success', message: 'Seguimiento registrado exitosamente.' });
      setIsFollowupModalOpen(false);
      setFollowupComments('');
      fetchQuote();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setSubmittingFollowup(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent"></div>
      </div>
    );
  }

  const { quote, followups, settings } = data;
  const badge = getInterestBadgeInfo(quote.interest_score);

  // Estimated monthly generation: kWp * 30 days * 4.2 HSP * 0.8 efficiency factor
  const estimatedKwhMonth = Math.round(quote.installed_power_kwp * 30 * 4.2 * 0.82);
  const estimatedSavingsMonthCOP = Math.round(estimatedKwhMonth * 850); // Aprox $850 COP por kWh evitado

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Action Bar (Hidden on print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs no-print">
        <button
          onClick={() => navigate('/cotizaciones')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al listado</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate(`/cotizador?editQuoteId=${id}`)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-300"
            title="Modificar parámetros, equipos o precios de esta cotización"
          >
            <Edit2 className="w-4 h-4 text-[#2d8a58]" />
            <span>Editar Cotización</span>
          </button>

          <button
            onClick={() => setIsFollowupModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Registrar Seguimiento</span>
          </button>

          <button
            onClick={handleWhatsApp}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Enviar por WhatsApp</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#2d8a58]/20"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Guardar PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Executive Proposal Sheet */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-md print:border-none print:shadow-none print:p-0">
        {/* Header with Company details */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-4 border-[#2d8a58] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2d8a58] to-[#48bb78] flex items-center justify-center text-white font-black shadow-md shadow-[#2d8a58]/20">
                <SunMedium className="w-6 h-6" />
              </div>
              <span className="text-xl font-black text-slate-900 tracking-tight">
                {settings?.company_name || 'RENOVA ENERGY S.A.S.'}
              </span>
            </div>
            <p className="text-xs text-slate-500">NIT: {settings?.nit || '901.458.789-1'} &bull; {settings?.address || 'Bogotá D.C., Colombia'}</p>
            <p className="text-xs text-slate-500">{settings?.email || 'ventas@renovaenergy.com.co'} &bull; {settings?.phone || '+57 (601) 745-8900'}</p>
          </div>

          <div className="text-left sm:text-right">
            <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-mono text-xs font-black">
              {quote.quote_code}
            </span>
            <div className="text-xs text-slate-500 mt-1">
              Fecha de emisión: <span className="font-bold text-slate-800">{formatDate(quote.created_at)}</span>
            </div>
            <div className="text-xs text-slate-500">
              Próximo Seguimiento: <span className="font-bold text-amber-700">{formatDate(quote.followup_date)}</span>
            </div>
            <div className="mt-1">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                Interés: {badge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Client & Project Specs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Datos del Cliente
            </h3>
            <p className="text-base font-bold text-slate-900">{quote.client_name}</p>
            <p className="text-xs text-slate-600">{quote.client_doc_type}: {quote.client_doc_number || 'N/A'}</p>
            <p className="text-xs text-slate-600">Tel: {quote.client_phone} &bull; {quote.client_email || 'Sin correo'}</p>
            <p className="text-xs text-slate-600">{quote.client_address || 'Dirección no especificada'}, {quote.client_city || ''}</p>
            <p className="text-xs text-slate-600">Operador: <span className="font-semibold text-slate-800">{quote.client_operator || 'Afinia'}</span></p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Especificaciones Técnicas del Proyecto
            </h3>
            <p className="text-sm font-bold text-amber-600 mb-1">{getSystemTypeName(quote.system_type)}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Potencia Pico</span>
                <span className="text-sm font-black text-slate-800">{formatKW(quote.installed_power_kwp)}</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Cantidad Paneles</span>
                <span className="text-sm font-black text-slate-800">{quote.installed_panels} paneles ({quote.panel_power_w}W)</span>
              </div>
              {quote.system_type === 'bombeo' ? (
                <>
                  <div className="p-2 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Aplicación</span>
                    <span className="text-sm font-black text-cyan-700">Bombeo Solar Directo</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Variador MPPT</span>
                    <span className="text-sm font-black text-slate-800 truncate block">
                      {quote.selected_inverters?.[0]?.name?.replace('Variador de Frecuencia Solar ', 'VFD ') || 'Variador Solar'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Generación Mensual</span>
                    <span className="text-sm font-black text-emerald-700">~{estimatedKwhMonth} kWh/mes</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Ahorro Mensual Est.</span>
                    <span className="text-sm font-black text-emerald-700">~{formatCOP(estimatedSavingsMonthCOP)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Itemized Equipments Table */}
        <div className="my-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Desglose de Equipos, Materiales & Servicios
          </h3>
          <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3">Ítem / Descripción</th>
                <th className="p-3 text-center">Cant.</th>
                <th className="p-3 text-right">Vr. Unitario</th>
                <th className="p-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* Paneles */}
              <tr className="hover:bg-slate-50">
                <td className="p-3">
                  <div className="font-bold text-slate-800">Módulos Solares Monocristalinos Tier 1</div>
                  <div className="text-[11px] text-slate-500">{quote.panel_power_w} Wp &bull; Garantía lineal de 25 años</div>
                </td>
                <td className="p-3 text-center font-semibold">{quote.installed_panels}</td>
                <td className="p-3 text-right">{formatCOP(quote.panel_unit_price)}</td>
                <td className="p-3 text-right font-bold text-slate-800">{formatCOP(quote.panels_total)}</td>
              </tr>

              {/* Inversores o Variador Solar */}
              {quote.selected_inverters?.map((inv, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold text-slate-800">
                      {quote.system_type === 'bombeo' ? 'Variador de Frecuencia Solar:' : 'Inversor Solar:'} {inv.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {quote.system_type === 'bombeo'
                        ? 'Variador de frecuencia solar MPPT para bombeo de agua directo con paneles solares'
                        : `${inv.power}W • Conexión y monitoreo remoto`}
                    </div>
                  </td>
                  <td className="p-3 text-center font-semibold">{inv.qty}</td>
                  <td className="p-3 text-right">{formatCOP(inv.price)}</td>
                  <td className="p-3 text-right font-bold text-slate-800">{formatCOP(inv.qty * inv.price)}</td>
                </tr>
              ))}

              {/* Baterías */}
              {quote.selected_batteries?.map((bat, idx) => (
                <tr key={idx} className="hover:bg-slate-50 bg-emerald-50/20">
                  <td className="p-3">
                    <div className="font-bold text-slate-800">Banco de Baterías: {bat.name}</div>
                    <div className="text-[11px] text-slate-500">{bat.voltage} - {bat.ah}Ah &bull; Más de 6000 ciclos de vida</div>
                  </td>
                  <td className="p-3 text-center font-semibold">{bat.qty}</td>
                  <td className="p-3 text-right">{formatCOP(bat.price)}</td>
                  <td className="p-3 text-right font-bold text-emerald-800">{formatCOP(bat.qty * bat.price)}</td>
                </tr>
              ))}

              {/* Bombeo */}
              {quote.selected_pumps?.map((pmp, idx) => (
                <tr key={idx} className="hover:bg-slate-50 bg-cyan-50/20">
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{pmp.name}</div>
                    <div className="text-[11px] text-slate-500">Componente para bombeo solar agrícola</div>
                  </td>
                  <td className="p-3 text-center font-semibold">{pmp.qty}</td>
                  <td className="p-3 text-right">{formatCOP(pmp.price)}</td>
                  <td className="p-3 text-right font-bold text-cyan-800">{formatCOP(pmp.qty * pmp.price)}</td>
                </tr>
              ))}

              {/* Estructura */}
              <tr className="hover:bg-slate-50">
                <td className="p-3">
                  <div className="font-bold text-slate-800">Estructura de Montaje Solar: {quote.structure_type}</div>
                  <div className="text-[11px] text-slate-500">Aluminio anodizado AL6005-T5 y tornillería en acero inoxidable</div>
                </td>
                <td className="p-3 text-center font-semibold">{quote.installed_panels}</td>
                <td className="p-3 text-right">{formatCOP(quote.structure_unit_price)}</td>
                <td className="p-3 text-right font-bold text-slate-800">{formatCOP(quote.structure_total)}</td>
              </tr>

              {/* Mano de Obra */}
              <tr className="hover:bg-slate-50">
                <td className="p-3">
                  <div className="font-bold text-slate-800">Mano de Obra, Ingeniería y Montaje Certificado</div>
                  <div className="text-[11px] text-slate-500">Instalación eléctrica AC/DC y pruebas conforme a norma RETIE</div>
                </td>
                <td className="p-3 text-center font-semibold">{quote.installed_power_kwp} kWp</td>
                <td className="p-3 text-right">{formatCOP(quote.mdo_unit_price)}</td>
                <td className="p-3 text-right font-bold text-slate-800">{formatCOP(quote.mdo_total)}</td>
              </tr>

              {/* Legalización RETIE */}
              {quote.legalization_included === 1 && (
                <tr className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold text-slate-800">Legalización, Trámites Operador de Red y Certificación RETIE</div>
                    <div className="text-[11px] text-slate-500">
                      Incluye diseño de ingeniería, radicación punto de conexión, contador bidireccional y dictamen ONAC
                    </div>
                  </td>
                  <td className="p-3 text-center font-semibold">1 Global</td>
                  <td className="p-3 text-right">{formatCOP(quote.legalization_total)}</td>
                  <td className="p-3 text-right font-bold text-slate-800">{formatCOP(quote.legalization_total)}</td>
                </tr>
              )}

              {/* Caja AC y Accesorios */}
              <tr className="hover:bg-slate-50">
                <td className="p-3">
                  <div className="font-bold text-slate-800">
                    {quote.system_type === 'bombeo'
                      ? 'Accesorios de Conexión, Protecciones DC y Cableado Fotovoltaico'
                      : 'Tablero Protecciones Caja AC & Accesorios de Conexión'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {quote.system_type === 'bombeo'
                      ? 'Cable fotovoltaico resistente a intemperie/UV, conectores MC4, protecciones DC y tubería conduit'
                      : 'Breakers, DPS supresores de transitorios, cable fotovoltaico UV y conduit'}
                  </div>
                </td>
                <td className="p-3 text-center font-semibold">1 Global</td>
                <td className="p-3 text-right">{formatCOP(quote.caja_ac_price + quote.accessories_price)}</td>
                <td className="p-3 text-right font-bold text-slate-800">{formatCOP(quote.caja_ac_price + quote.accessories_price)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals & Financing Simulation Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 items-start">
          {/* Guarantees & Terms */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Garantías y Condiciones Comerciales
            </h4>
            <ul className="list-disc list-inside text-slate-600 space-y-1 text-[11px]">
              <li>Garantía de Paneles: <strong>{settings?.warranty_panels_years || 25} años</strong> de producción lineal.</li>
              <li>Garantía de Inversor: <strong>{settings?.warranty_inverter_years || 5} años</strong> contra defectos de fábrica.</li>
              <li>Garantía de Baterías de Litio: <strong>{settings?.warranty_batteries_years || 10} años</strong>.</li>
              <li>Garantía de Instalación y Mano de Obra: <strong>{settings?.warranty_installation_years || 2} años</strong>.</li>
              <li>Cotización exenta de IVA bajo los incentivos de la Ley 1715 de Energías Renovables.</li>
            </ul>
          </div>

          {/* Budget Summary */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-xs shadow-md">
            <div className="flex justify-between text-slate-300">
              <span>Subtotal Presupuesto:</span>
              <span>{formatCOP(quote.subtotal)}</span>
            </div>

            {quote.discount_amount > 0 && (
              <div className="flex justify-between text-rose-400 font-bold">
                <span>Descuento Comercial ({quote.discount_percent}%):</span>
                <span>-{formatCOP(quote.discount_amount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
              <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">TOTAL PROYECTO:</span>
              <span className="text-2xl font-black text-amber-400">{formatCOP(quote.total_price)}</span>
            </div>

            {quote.financing_monthly_fee > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 bg-slate-950/60 p-2.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Opción Financiación Bancaria:</span>
                <div className="flex justify-between items-center text-xs font-semibold mt-0.5">
                  <span>Plazo: {quote.financing_term_months} meses</span>
                  <span className="text-emerald-400 font-bold text-sm">{formatCOP(quote.financing_monthly_fee)} / mes</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Signatures block */}
        <div className="grid grid-cols-2 gap-12 pt-12 mt-8 border-t border-slate-200 text-xs">
          <div className="border-t border-slate-400 pt-2 text-center">
            <p className="font-bold text-slate-800">{user?.name || 'Ingeniero Solar'}</p>
            <p className="text-slate-500">Asesor Técnico Comercial</p>
            <p className="text-slate-400 text-[10px]">{settings?.company_name}</p>
          </div>

          <div className="border-t border-slate-400 pt-2 text-center">
            <p className="font-bold text-slate-800">{quote.client_name}</p>
            <p className="text-slate-500">Aceptación y Firma del Cliente</p>
            <p className="text-slate-400 text-[10px]">{quote.client_doc_type}: {quote.client_doc_number || ''}</p>
          </div>
        </div>
      </div>

      {/* Follow-up Interaction History (Visible on screen, hidden on print) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs no-print">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Bitácora de Seguimiento con el Cliente
            </h3>
            <p className="text-xs text-slate-500">
              Historial de contactos, llamadas y comentarios registrados para esta cotización
            </p>
          </div>

          <button
            onClick={() => setIsFollowupModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer"
          >
            + Añadir Comentario
          </button>
        </div>

        {followups?.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No hay seguimientos registrados aún.</p>
        ) : (
          <div className="space-y-3">
            {followups?.map((f) => (
              <div key={f.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold capitalize px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                      {f.interaction_type}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      por {f.user_name || 'Asesor'} &bull; {formatDate(f.created_at)}
                    </span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getInterestBadgeInfo(f.interest_score).color}`}>
                    {f.interest_score}/10 Interés
                  </span>
                </div>

                <p className="text-xs text-slate-700 mt-1">{f.comments}</p>

                {f.next_followup_date && (
                  <div className="text-[11px] text-amber-700 font-bold mt-2 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Próximo contacto programado: {formatDate(f.next_followup_date)}</span>
                  </div>
                )}

                {f.desist_reason && (
                  <div className="text-[11px] text-rose-700 font-bold mt-2">
                    Motivo desistimiento: {f.desist_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Add Followup Interaction */}
      <Modal
        isOpen={isFollowupModalOpen}
        onClose={() => setIsFollowupModalOpen(false)}
        title={`Registrar Seguimiento - ${quote.quote_code}`}
      >
        <form onSubmit={handleSaveFollowup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Interacción</label>
            <div className="grid grid-cols-4 gap-2">
              {['llamada', 'whatsapp', 'visita', 'reunion'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFollowupInteraction(type)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                    followupInteraction === type
                      ? 'border-amber-500 bg-amber-500/10 text-amber-800'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Calificación de Interés del Cliente (1 al 10)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="10"
                value={followupScore}
                onChange={(e) => setFollowupScore(parseInt(e.target.value))}
                className="flex-1 accent-amber-500 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                followupScore >= 8 ? 'bg-red-100 text-red-700 border-red-200' :
                followupScore >= 5 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                'bg-blue-100 text-blue-800 border-blue-200'
              }`}>
                {followupScore} / 10 ({followupScore >= 8 ? 'Probable' : followupScore >= 5 ? 'Tibio' : 'Frío'})
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Comentarios del Cliente / Resumen de la Conversación <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="3"
              required
              value={followupComments}
              onChange={(e) => setFollowupComments(e.target.value)}
              placeholder="Ej. El cliente revisó la propuesta, le parece adecuado el inversor pero solicitó facilidades con crédito bancario..."
              className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Acción / Resultado</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'reprogramar', label: '📅 Nueva Fecha', color: 'border-amber-500' },
                { id: 'ganado', label: '🏆 Proyecto Ganado', color: 'border-emerald-500' },
                { id: 'desiste', label: '🛑 Cliente Desiste', color: 'border-rose-500' }
              ].map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setFollowupAction(act.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    followupAction === act.id
                      ? `${act.color} bg-slate-900 text-white shadow-xs`
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>

          {followupAction === 'reprogramar' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nueva Fecha de Seguimiento
              </label>
              <input
                type="date"
                required
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          )}

          {followupAction === 'desiste' && (
            <div>
              <label className="block text-xs font-bold text-rose-700 mb-1">
                Motivo del Desistimiento (Se archivará de la lista de pendientes)
              </label>
              <select
                value={desistReason}
                onChange={(e) => setDesistReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-rose-300 text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                <option value="Falta de presupuesto">Falta de presupuesto / Sin capacidad de pago</option>
                <option value="Escogió otra empresa de energía solar">Escogió a la competencia</option>
                <option value="Aplazó el proyecto indefinidamente">Proyecto aplazado indefinidamente</option>
                <option value="Problemas estructurales en el techo">El techo no soporta los paneles</option>
                <option value="No responde llamadas ni mensajes">No responde contactos</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFollowupModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submittingFollowup}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-xl shadow disabled:opacity-50"
            >
              {submittingFollowup ? 'Guardando...' : 'Guardar Seguimiento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
