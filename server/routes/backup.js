import express from 'express';
import fs from 'fs';
import path from 'path';
import xlsxModule from 'xlsx';
import { db, dbPath, syncToSupabase, syncFromSupabase } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

const XLSX = xlsxModule.default || xlsxModule;
const router = express.Router();

/**
 * Format column widths for auto-fitting Excel worksheets
 */
function setAutoColumnWidths(ws, rows) {
  if (!rows || rows.length === 0) return;
  const colKeys = Object.keys(rows[0]);
  ws['!cols'] = colKeys.map(key => {
    let maxLen = key.length;
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const val = rows[i][key];
      if (val !== undefined && val !== null) {
        const strVal = String(val);
        if (strVal.length > maxLen) {
          maxLen = Math.min(strVal.length, 60);
        }
      }
    }
    return { wch: Math.max(maxLen + 3, 12) };
  });
}

/**
 * GET /api/backup/export-excel
 * Exports complete multi-sheet Excel workbook with independent worksheets for all modules (Admin only)
 */
router.get('/export-excel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const wb = XLSX.utils.book_new();

    // 1. Clientes
    const rawClients = db.prepare(`
      SELECT 
        id, name, doc_type, doc_number, phone, email, address, city, department,
        operator, client_type, voltage_level, stratum, notes, created_at
      FROM clients 
      ORDER BY id ASC
    `).all();

    const formattedClients = rawClients.map(c => ({
      'ID': c.id,
      'Nombre / Razón Social': c.name || '',
      'Tipo Doc': c.doc_type || 'CC',
      'Número de Documento': c.doc_number || '',
      'Teléfono / Celular': c.phone || '',
      'Correo Electrónico': c.email || '',
      'Dirección': c.address || '',
      'Ciudad': c.city || '',
      'Departamento': c.department || '',
      'Operador de Red': c.operator || 'Afinia',
      'Tipo de Cliente': c.client_type || 'Residencial',
      'Nivel de Tensión': c.voltage_level || '',
      'Estrato': c.stratum || '',
      'Notas y Observaciones': c.notes || '',
      'Fecha de Registro': c.created_at || ''
    }));
    const wsClients = XLSX.utils.json_to_sheet(formattedClients.length > 0 ? formattedClients : [{ 'Información': 'Sin clientes registrados' }]);
    setAutoColumnWidths(wsClients, formattedClients);
    XLSX.utils.book_append_sheet(wb, wsClients, '1. Clientes');

    // 2. Cotizaciones
    const rawQuotes = db.prepare(`
      SELECT 
        q.*, c.name as client_name, c.phone as client_phone, u.name as user_name, p.name as panel_name
      FROM quotes q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN users u ON q.user_id = u.id
      LEFT JOIN products p ON q.panel_model_id = p.id
      ORDER BY q.id DESC
    `).all();

    const formattedQuotes = rawQuotes.map(q => ({
      'ID': q.id,
      'Código Cotización': q.quote_code || '',
      'Cliente': q.client_name || '',
      'Teléfono Cliente': q.client_phone || '',
      'Asesor Comercial': q.user_name || '',
      'Tipo de Sistema': q.system_type === 'ongrid' ? 'On-Grid (Red)' : q.system_type === 'hybrid' ? 'Híbrido' : q.system_type === 'offgrid' ? 'Off-Grid' : 'Bombeo Solar',
      'Estado': q.status || '',
      'Puntaje Interés': q.interest_score || 0,
      'Consumo Mensual (kWh)': q.client_consumption_kwh || 0,
      'Potencia Requerida (kWp)': q.required_power_kwp || 0,
      'Modelo Panel': q.panel_name || 'Panel Solar 720W',
      'Potencia Panel (W)': q.panel_power_w || 720,
      'Precio Unitario Panel (COP)': q.panel_unit_price || 0,
      'Paneles Sugeridos': q.suggested_panels || 0,
      'Paneles Instalados': q.installed_panels || 0,
      'Potencia Instalada (kWp)': q.installed_power_kwp || 0,
      'Total Paneles (COP)': q.panels_total || 0,
      'Total Inversores/Variador (COP)': q.inverters_total || 0,
      'Total Baterías (COP)': q.batteries_total || 0,
      'Total Bombeo (COP)': q.pumps_total || 0,
      'Mano de Obra (COP)': q.mdo_total || 0,
      'Estructura (COP)': q.structure_total || 0,
      'Legalización Incluida': q.legalization_included ? 'SÍ' : 'NO',
      'Total Legalización (COP)': q.legalization_total || 0,
      'Caja AC y Protecciones (COP)': q.caja_ac_price || 0,
      'Accesorios Conexión (COP)': q.accessories_price || 0,
      'Subtotal (COP)': q.subtotal || 0,
      'Descuento (%)': q.discount_percent || 0,
      'Descuento Monto (COP)': q.discount_amount || 0,
      'VALOR TOTAL PROPUESTA (COP)': q.total_price || 0,
      'Anticipo Financiado (COP)': q.financing_down_payment_amount || 0,
      'Saldo Financiado (COP)': q.financing_amount || 0,
      'Plazo Meses': q.financing_term_months || 0,
      'Cuota Mensual Estimada (COP)': q.financing_monthly_fee || 0,
      'Tasa Interés Mensual': q.financing_monthly_rate ? (q.financing_monthly_rate * 100).toFixed(1) + '%' : '2.0%',
      'Fecha Próximo Seguimiento': q.followup_date || '',
      'Notas Técnicas': q.notes || '',
      'Fecha Creación': q.created_at || ''
    }));
    const wsQuotes = XLSX.utils.json_to_sheet(formattedQuotes.length > 0 ? formattedQuotes : [{ 'Información': 'Sin cotizaciones registradas' }]);
    setAutoColumnWidths(wsQuotes, formattedQuotes);
    XLSX.utils.book_append_sheet(wb, wsQuotes, '2. Cotizaciones');

    // 3. Contratos
    const rawContracts = db.prepare(`
      SELECT 
        ctr.*, c.name as client_name, c.doc_number as client_doc, u.name as user_name, q.quote_code
      FROM contracts ctr
      LEFT JOIN clients c ON ctr.client_id = c.id
      LEFT JOIN users u ON ctr.user_id = u.id
      LEFT JOIN quotes q ON ctr.quote_id = q.id
      ORDER BY ctr.id DESC
    `).all();

    const formattedContracts = rawContracts.map(ctr => ({
      'ID': ctr.id,
      'Código Contrato': ctr.contract_code || '',
      'Cotización Asociada': ctr.quote_code || '',
      'Cliente': ctr.client_name || '',
      'Documento Cliente': ctr.client_doc || '',
      'Asesor Comercial': ctr.user_name || '',
      'Fecha Firma': ctr.contract_date || '',
      'Estado Contrato': ctr.status || 'borrador',
      'Incluye Legalización': ctr.legalization_included ? 'SÍ' : 'NO',
      'VALOR TOTAL CONTRATO (COP)': ctr.total_contract_value || 0,
      'Valor Anticipo (COP)': ctr.down_payment_amount || 0,
      'Saldo Financiado (COP)': ctr.financed_amount || 0,
      'Aplica Interés': ctr.has_interest ? 'SÍ' : 'NO',
      'Tasa Interés Mensual': ctr.monthly_interest_rate ? (ctr.monthly_interest_rate * 100).toFixed(1) + '%' : '0%',
      'Número de Cuotas': ctr.installments_count || 1,
      'Fecha Primera Cuota': ctr.first_installment_date || '',
      'Plazo Ejecución (Días)': ctr.execution_time_days || 180,
      'Garantía Paneles (Años)': ctr.warranty_years_panels || 25,
      'Garantía Inversor (Años)': ctr.warranty_years_inverter || 5,
      'Garantía Instalación (Años)': ctr.warranty_years_installation || 2,
      'Representante Contratista': ctr.contractor_rep_name || '',
      'Cédula Representante': ctr.contractor_rep_doc || '',
      'Cláusulas Especiales': ctr.custom_clauses || '',
      'Notas': ctr.notes || '',
      'Fecha Creación': ctr.created_at || ''
    }));
    const wsContracts = XLSX.utils.json_to_sheet(formattedContracts.length > 0 ? formattedContracts : [{ 'Información': 'Sin contratos registrados' }]);
    setAutoColumnWidths(wsContracts, formattedContracts);
    XLSX.utils.book_append_sheet(wb, wsContracts, '3. Contratos');

    // 4. Visitas Técnicas
    const rawVisits = db.prepare(`
      SELECT 
        v.*, c.name as client_name, c.phone as client_phone, c.address as client_address, u.name as user_name, q.quote_code
      FROM technical_visits v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN quotes q ON v.quote_id = q.id
      ORDER BY v.id DESC
    `).all();

    const formattedVisits = rawVisits.map(v => ({
      'ID': v.id,
      'Código Visita': v.visit_code || '',
      'Cliente': v.client_name || '',
      'Teléfono': v.client_phone || '',
      'Dirección': v.client_address || '',
      'Técnico / Asesor': v.user_name || '',
      'Cotización Asociada': v.quote_code || '',
      'Fecha Programada': v.scheduled_date || '',
      'Hora Programada': v.scheduled_time || '',
      'Estado Visita': v.status || '',
      'Operador Red': v.operator || 'Afinia',
      'Nivel Tensión': v.voltage_level || '',
      'Breaker Totalizador (A)': v.totalizer_breaker_amps || 50,
      'Tipo Transformador': v.transformer_type || '',
      'Capacidad Transformador (kVA)': v.transformer_kva || 0,
      'Ubicación Tablero': v.main_board_location || '',
      'Estado Polo a Tierra': v.grounding_system_status || '',
      'Distancia Techo a Tablero (m)': v.distance_roof_to_board_m || 0,
      'Distancia Inversor a Tablero (m)': v.distance_inverter_to_board_m || 0,
      'Consumo Reportado (kWh)': v.client_consumption_kwh || 0,
      'Tipo Techo': v.roof_type || '',
      'Estado Techo': v.roof_condition || '',
      'Estado Vigas': v.beams_condition || '',
      'Inclinación (Grados)': v.roof_slope_deg || 0,
      'Orientación': v.roof_orientation || '',
      'Área Disponible (m²)': v.available_area_m2 || 0,
      'Paneles Estimados en Techo': v.estimated_panels_total || 0,
      'Material Estructura': v.structure_material || '',
      'Nivel Sombras': v.shading_level || '',
      'Ubicación Propuesta Inversor': v.inverter_location || '',
      'Ubicación Propuesta Baterías': v.battery_location || '',
      '¿Tiene WiFi?': v.has_internet_wifi ? 'SÍ' : 'NO',
      'Señal WiFi': v.wifi_signal_strength || '',
      'Sistema Recomendado': v.recommended_system_type || '',
      'Estructura Recomendada': v.recommended_structure_type || '',
      'Foto Medidor Verificada': v.photo_meter_ok ? 'SÍ' : 'NO',
      'Foto Transformador Verificada': v.photo_transformer_ok ? 'SÍ' : 'NO',
      'Recibo Energía Verificado': v.energy_bill_ok ? 'SÍ' : 'NO',
      'Notas Técnicas': v.technician_notes || '',
      'Fecha Registro': v.created_at || ''
    }));
    const wsVisits = XLSX.utils.json_to_sheet(formattedVisits.length > 0 ? formattedVisits : [{ 'Información': 'Sin visitas registradas' }]);
    setAutoColumnWidths(wsVisits, formattedVisits);
    XLSX.utils.book_append_sheet(wb, wsVisits, '4. Visitas Técnicas');

    // 5. Trámites Regulatorios
    const rawLegalizations = db.prepare(`
      SELECT 
        leg.*, c.name as client_name, ctr.contract_code, u.name as user_name
      FROM network_legalizations leg
      LEFT JOIN clients c ON leg.client_id = c.id
      LEFT JOIN contracts ctr ON leg.contract_id = ctr.id
      LEFT JOIN users u ON leg.user_id = u.id
      ORDER BY leg.id DESC
    `).all();

    const formattedLegalizations = rawLegalizations.map(leg => ({
      'ID': leg.id,
      'Código Expediente': leg.expediente_code || '',
      'Contrato Asociado': leg.contract_code || '',
      'Cliente': leg.client_name || '',
      'Responsable Trámite': leg.user_name || '',
      'Operador Red': leg.operator || 'Afinia',
      'Estado Expediente': leg.status || 'en_tramite',
      'Número NIC': leg.nic_number || '',
      'Número Radicado': leg.radicado_number || '',
      'Código Transformador': leg.transformer_code || '',
      'Potencia Instalada (kWp)': leg.installed_power_kwp || 0,
      'Tipo Sistema': leg.system_type || 'ongrid',
      'Paso 1: Docs Completos': leg.step1_docs_ok ? 'SÍ' : 'NO',
      'Paso Renova: Diseño e Info': leg.step_renova_ok ? 'SÍ' : 'NO',
      'Paso 2: Diseños Eléctricos': leg.step2_designs_ok ? 'SÍ' : 'NO',
      'Paso 3: RETIE': leg.step3_retie_ok ? 'SÍ' : 'NO',
      'Paso 4: Radicación Operador': leg.step4_radication_ok ? 'SÍ' : 'NO',
      'Paso 5: Aprobación Conexión': leg.step5_approval_ok ? 'SÍ' : 'NO',
      'Paso 6: Visita Operador': leg.step6_visit_ok ? 'SÍ' : 'NO',
      'Paso 7: Medidor Bidireccional': leg.step7_meter_ok ? 'SÍ' : 'NO',
      'Paso 8: AGPE Conexión Definitiva': leg.step8_agpe_ok ? 'SÍ' : 'NO',
      'Notas Generales': leg.general_notes || '',
      'Fecha Creación': leg.created_at || ''
    }));
    const wsLegalizations = XLSX.utils.json_to_sheet(formattedLegalizations.length > 0 ? formattedLegalizations : [{ 'Información': 'Sin trámites regulatorios registrados' }]);
    setAutoColumnWidths(wsLegalizations, formattedLegalizations);
    XLSX.utils.book_append_sheet(wb, wsLegalizations, '5. Trámites Regulatorios');

    // 6. Seguimientos CRM
    const rawFollowups = db.prepare(`
      SELECT 
        f.*, c.name as client_name, q.quote_code, u.name as user_name
      FROM followups f
      LEFT JOIN clients c ON f.client_id = c.id
      LEFT JOIN quotes q ON f.quote_id = q.id
      LEFT JOIN users u ON f.user_id = u.id
      ORDER BY f.id DESC
    `).all();

    const formattedFollowups = rawFollowups.map(f => ({
      'ID': f.id,
      'Cotización Asociada': f.quote_code || '',
      'Cliente': f.client_name || '',
      'Asesor Comercial': f.user_name || '',
      'Tipo de Interacción': f.interaction_type || '',
      'Puntaje Interés (1-10)': f.interest_score || 0,
      'Comentarios y Acuerdos': f.comments || '',
      'Acción Tomada': f.action_taken || '',
      'Próximo Seguimiento': f.next_followup_date || '',
      'Motivo Desistimiento': f.desist_reason || '',
      'Fecha Registro': f.created_at || ''
    }));
    const wsFollowups = XLSX.utils.json_to_sheet(formattedFollowups.length > 0 ? formattedFollowups : [{ 'Información': 'Sin seguimientos registrados' }]);
    setAutoColumnWidths(wsFollowups, formattedFollowups);
    XLSX.utils.book_append_sheet(wb, wsFollowups, '6. Seguimientos CRM');

    // 7. Catálogo de Productos
    const rawProducts = db.prepare(`
      SELECT 
        id, category, name, brand, model, power_w, voltage, capacity_ah,
        system_type, unit_price, cost_price, unit, description, active, created_at
      FROM products 
      ORDER BY category ASC, name ASC
    `).all();

    const formattedProducts = rawProducts.map(p => ({
      'ID': p.id,
      'Categoría': p.category || '',
      'Producto / Servicio': p.name || '',
      'Marca': p.brand || '',
      'Modelo': p.model || '',
      'Potencia (W)': p.power_w || 0,
      'Voltaje': p.voltage || '',
      'Capacidad (Ah)': p.capacity_ah || 0,
      'Sistema': p.system_type || 'all',
      'Precio Venta COP': p.unit_price || 0,
      'Costo Base COP': p.cost_price || 0,
      'Unidad Medida': p.unit || 'unidad',
      'Descripción Técnica': p.description || '',
      'Activo en Cotizador': p.active ? 'SÍ' : 'NO'
    }));
    const wsProducts = XLSX.utils.json_to_sheet(formattedProducts.length > 0 ? formattedProducts : [{ 'Información': 'Sin productos registrados' }]);
    setAutoColumnWidths(wsProducts, formattedProducts);
    XLSX.utils.book_append_sheet(wb, wsProducts, '7. Catálogo Productos');

    // 8. Usuarios del Sistema
    const rawUsers = db.prepare(`
      SELECT id, name, username, email, role, active, created_at 
      FROM users 
      ORDER BY id ASC
    `).all();

    const formattedUsers = rawUsers.map(u => ({
      'ID': u.id,
      'Nombre Completo': u.name || '',
      'Usuario (Login)': u.username || '',
      'Correo Electrónico': u.email || '',
      'Rol Asignado': u.role || 'asesor',
      'Estado': u.active ? 'ACTIVO' : 'INACTIVO',
      'Fecha Creación': u.created_at || ''
    }));
    const wsUsers = XLSX.utils.json_to_sheet(formattedUsers.length > 0 ? formattedUsers : [{ 'Información': 'Sin usuarios registrados' }]);
    setAutoColumnWidths(wsUsers, formattedUsers);
    XLSX.utils.book_append_sheet(wb, wsUsers, '8. Usuarios');

    // 9. Configuración Empresa
    const company = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() || {};
    const formattedCompany = [{
      'Parámetro': 'Razón Social', 'Valor': company.company_name || 'SOLARTECH COL. S.A.S.'
    }, {
      'Parámetro': 'NIT', 'Valor': company.nit || '901756614 - 5'
    }, {
      'Parámetro': 'Teléfono Corporativo', 'Valor': company.phone || '+57 300 187 7158'
    }, {
      'Parámetro': 'Correo Electrónico', 'Valor': company.email || 'gerenciarenovaenergysas1@gmail.com'
    }, {
      'Parámetro': 'Dirección Principal', 'Valor': company.address || 'Calle 14 # 16A-49 Barrio San José'
    }, {
      'Parámetro': 'Ciudad / Departamento', 'Valor': `${company.city || 'Magangué'} - ${company.department || 'Bolívar'}`
    }, {
      'Parámetro': 'Sitio Web', 'Valor': company.website || 'WWW.RENOVAENERGY.COM'
    }, {
      'Parámetro': 'Instagram', 'Valor': company.instagram || 'renovasolarenergy'
    }, {
      'Parámetro': 'Representante Legal', 'Valor': company.legal_rep_name || 'NELLIS ELENA MANJARREZ RODRÍGUEZ'
    }, {
      'Parámetro': 'Cédula Representante Legal', 'Valor': company.legal_rep_doc || '1.052.952.061'
    }, {
      'Parámetro': 'Banco', 'Valor': company.bank_name || 'Bancolombia'
    }, {
      'Parámetro': 'Tipo de Cuenta', 'Valor': company.bank_account_type || 'Cuenta de Ahorros'
    }, {
      'Parámetro': 'Número de Cuenta', 'Valor': company.bank_account_number || '48400003755'
    }, {
      'Parámetro': 'Radiación Solar Defecto (HSP)', 'Valor': company.default_radiation_coef || 10.1
    }, {
      'Parámetro': 'Mano de Obra Base (COP/kWp)', 'Valor': company.default_mdo_rate || 400000
    }, {
      'Parámetro': 'Estructura Base (COP/panel)', 'Valor': company.default_structure_rate || 280000
    }, {
      'Parámetro': 'Caja AC Base (COP)', 'Valor': company.default_caja_ac || 2000000
    }, {
      'Parámetro': 'Accesorios Base (COP)', 'Valor': company.default_accessories || 5000000
    }, {
      'Parámetro': 'Tasa Interés Mensual Defecto', 'Valor': company.default_monthly_interest_rate ? `${(company.default_monthly_interest_rate * 100).toFixed(1)}%` : '2.0%'
    }, {
      'Parámetro': 'Garantía Paneles (Años)', 'Valor': company.warranty_panels_years || 25
    }, {
      'Parámetro': 'Garantía Inversores (Años)', 'Valor': company.warranty_inverter_years || 5
    }, {
      'Parámetro': 'Garantía Baterías (Años)', 'Valor': company.warranty_batteries_years || 10
    }, {
      'Parámetro': 'Garantía Instalación (Años)', 'Valor': company.warranty_installation_years || 2
    }, {
      'Parámetro': 'Términos y Condiciones Comerciales', 'Valor': company.terms_and_conditions || ''
    }];
    const wsCompany = XLSX.utils.json_to_sheet(formattedCompany);
    wsCompany['!cols'] = [{ wch: 35 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsCompany, '9. Configuración Empresa');

    // 10. Auditoría de Seguridad
    const rawLogs = db.prepare(`
      SELECT id, created_at, user_name, action, module, entity_type, entity_id, description, ip_address 
      FROM audit_logs 
      ORDER BY id DESC 
      LIMIT 1000
    `).all();

    const formattedLogs = rawLogs.map(l => ({
      'ID': l.id,
      'Fecha y Hora': l.created_at || '',
      'Usuario': l.user_name || 'Sistema',
      'Acción': l.action || '',
      'Módulo': l.module || '',
      'Tipo de Entidad': l.entity_type || '',
      'ID Entidad': l.entity_id || '',
      'Descripción del Evento': l.description || '',
      'IP': l.ip_address || ''
    }));
    const wsLogs = XLSX.utils.json_to_sheet(formattedLogs.length > 0 ? formattedLogs : [{ 'Información': 'Sin registros de auditoría' }]);
    setAutoColumnWidths(wsLogs, formattedLogs);
    XLSX.utils.book_append_sheet(wb, wsLogs, '10. Auditoría Seguridad');

    // 11. Trabajos Técnicos Programados
    let rawJobs = [];
    try {
      rawJobs = db.prepare(`
        SELECT 
          j.*, c.name as client_full_name, u.name as tech_full_name, ctr.contract_code
        FROM technical_jobs j
        LEFT JOIN clients c ON j.client_id = c.id
        LEFT JOIN users u ON j.technician_id = u.id
        LEFT JOIN contracts ctr ON j.contract_id = ctr.id
        ORDER BY j.scheduled_date DESC, j.id DESC
      `).all();
    } catch (eJobs) {
      console.warn('[Backup] technical_jobs table read notice:', eJobs.message);
    }

    const formattedJobs = rawJobs.map(j => ({
      'ID': j.id,
      'Código Trabajo': j.job_code || '',
      'Título / Tarea': j.title || '',
      'Tipo de Trabajo': j.job_type || 'instalacion',
      'Prioridad': (j.priority || 'media').toUpperCase(),
      'Estado': (j.status || 'pendiente').toUpperCase(),
      'Técnico Asignado': j.tech_full_name || j.technician_name || 'Sin Asignar',
      'Cliente': j.client_full_name || j.client_name || '',
      'Teléfono Cliente': j.client_phone || '',
      'Dirección': j.client_address || '',
      'Ciudad': j.city || '',
      'Contrato Asociado': j.contract_code || '',
      'Fecha Programada': j.scheduled_date || '',
      'Hora Programada': j.scheduled_time || '',
      'Fecha de Finalización': j.completed_at || '',
      'Descripción / Alcance': j.description || '',
      'Materiales Requeridos': j.materials_needed || '',
      'Notas del Técnico': j.technician_notes || '',
      'Fecha Creación': j.created_at || ''
    }));
    const wsJobs = XLSX.utils.json_to_sheet(formattedJobs.length > 0 ? formattedJobs : [{ 'Información': 'Sin trabajos técnicos programados' }]);
    setAutoColumnWidths(wsJobs, formattedJobs);
    XLSX.utils.book_append_sheet(wb, wsJobs, '11. Trabajos Programados');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `COPIA_SEGURIDAD_RENOVA_SOLARTECH_${nowStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    console.log(`[Backup Route] Generated multi-sheet Excel backup: ${filename} (${excelBuffer.length} bytes, 11 sheets)`);
    return res.end(excelBuffer);

  } catch (err) {
    console.error('[Backup Route Error - Export Excel]:', err);
    res.status(500).json({ error: 'Error al generar la copia de seguridad en Excel: ' + err.message });
  }
});

/**
 * GET /api/backup/download-db
 * Downloads the raw SQLite database file directly (Admin only)
 */
router.get('/download-db', authenticateToken, requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'El archivo de base de datos no fue encontrado en el servidor.' });
    }

    const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `solarquote_backup_${nowStr}.db`;

    res.download(dbPath, filename, (err) => {
      if (err) {
        console.error('[Backup Route Error - Download DB]:', err);
      } else {
        console.log(`[Backup Route] Direct database file downloaded: ${filename}`);
      }
    });
  } catch (err) {
    console.error('[Backup Route Error - Download DB]:', err);
    res.status(500).json({ error: 'Error al descargar la base de datos: ' + err.message });
  }
});

/**
 * GET /api/backup/status
 * Returns system counts and cloud synchronization health (Admin only)
 */
router.get('/status', authenticateToken, requireAdmin, (req, res) => {
  try {
    const clientsCount = db.prepare('SELECT COUNT(*) as c FROM clients').get()?.c || 0;
    const quotesCount = db.prepare('SELECT COUNT(*) as c FROM quotes').get()?.c || 0;
    const contractsCount = db.prepare('SELECT COUNT(*) as c FROM contracts').get()?.c || 0;
    const visitsCount = db.prepare('SELECT COUNT(*) as c FROM technical_visits').get()?.c || 0;
    const legalizationsCount = db.prepare('SELECT COUNT(*) as c FROM network_legalizations').get()?.c || 0;
    const followupsCount = db.prepare('SELECT COUNT(*) as c FROM followups').get()?.c || 0;
    const productsCount = db.prepare('SELECT COUNT(*) as c FROM products').get()?.c || 0;
    const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get()?.c || 0;
    const logsCount = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get()?.c || 0;

    let dbSize = 0;
    if (fs.existsSync(dbPath)) {
      dbSize = fs.statSync(dbPath).size;
    }

    res.json({
      status: 'ok',
      database_size_bytes: dbSize,
      database_size_kb: Math.round(dbSize / 1024),
      cloud_provider: 'Supabase Storage & PostgreSQL',
      tables: {
        clients: clientsCount,
        quotes: quotesCount,
        contracts: contractsCount,
        visits: visitsCount,
        legalizations: legalizationsCount,
        followups: followupsCount,
        products: productsCount,
        users: usersCount,
        audit_logs: logsCount
      },
      last_check: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar estado de copia de seguridad: ' + err.message });
  }
});

/**
 * POST /api/backup/sync-now
 * Force an immediate cloud sync with Supabase (Admin only)
 */
router.post('/sync-now', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const success = await syncToSupabase();
    res.json({
      success,
      message: success 
        ? 'Base de datos sincronizada y respaldada exitosamente en Supabase Cloud.' 
        : 'La sincronización no pudo completarse o no hubo cambios para sincronizar.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al sincronizar con la nube: ' + err.message });
  }
});

export default router;
