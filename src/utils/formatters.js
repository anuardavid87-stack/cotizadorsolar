/**
 * Currency, Date and Number Formatters for SolarQuote Pro
 */

export function formatCOP(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatKW(kw) {
  if (kw === undefined || kw === null || isNaN(kw)) return '0 kWp';
  return `${parseFloat(kw).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kWp`;
}

export function formatDate(dateString) {
  if (!dateString) return 'Sin fecha';
  try {
    const cleanDate = String(dateString).split('T')[0].split(' ')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateString);
    return d.toLocaleDateString('es-CO');
  } catch (e) {
    return dateString;
  }
}

export function getSystemTypeName(type) {
  switch (type) {
    case 'ongrid':
      return '☀️ On-Grid (Interconectado)';
    case 'hibrido':
      return '🔋 On-Grid con Baterías (Híbrido)';
    case 'offgrid':
      return '⚡ Off-Grid (Aislado Rural)';
    case 'bombeo':
      return '💧 Bombeo Solar';
    default:
      return type;
  }
}

export function getInterestBadgeInfo(score) {
  const num = parseInt(score) || 5;
  if (num >= 8) {
    return {
      label: '🔥 Muy Alto (Probable)',
      shortLabel: `${num}/10 Probable`,
      color: 'bg-red-50 text-red-700 border-red-200',
      badgeBg: 'bg-red-500 text-white',
      textColor: 'text-red-600',
      urgency: 'Prioridad Alta'
    };
  } else if (num >= 5) {
    return {
      label: '☀️ Moderado (Tibio)',
      shortLabel: `${num}/10 Tibio`,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeBg: 'bg-amber-500 text-white',
      textColor: 'text-amber-600',
      urgency: 'Prioridad Media'
    };
  } else {
    return {
      label: '❄️ Bajo (Frío)',
      shortLabel: `${num}/10 Frío`,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeBg: 'bg-blue-500 text-white',
      textColor: 'text-blue-600',
      urgency: 'Prioridad Baja'
    };
  }
}

export function getStatusBadgeInfo(status) {
  switch (status) {
    case 'aprobada':
      return {
        label: 'Aprobada / Ganada',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300'
      };
    case 'desistida':
      return {
        label: 'Desistida / Archivada',
        color: 'bg-slate-200 text-slate-700 border-slate-300'
      };
    case 'revision':
      return {
        label: 'En Revisión Técnica',
        color: 'bg-purple-100 text-purple-800 border-purple-300'
      };
    case 'pendiente':
    default:
      return {
        label: 'Pendiente de Seguimiento',
        color: 'bg-amber-100 text-amber-800 border-amber-300'
      };
  }
}

export function getRoofTypeName(type) {
  switch (type) {
    case 'fibrocemento':
      return 'Fibrocemento';
    case 'metalica':
      return 'Metálica';
    case 'pvc':
      return 'PVC';
    case 'placa':
      return 'Placa';
    case 'suelo_natural':
    case 'suelo':
      return 'Suelo Natural';
    case 'teja_colonial_barro':
    case 'teja_barro':
      return 'Teja Colonial Barro';
    default:
      return type ? type.replace(/_/g, ' ') : 'No especificada';
  }
}

export function getRoleBadgeInfo(roleSlug, rolesList = []) {
  const clean = (roleSlug || '').toLowerCase().trim();
  const matched = Array.isArray(rolesList) ? rolesList.find(r => (r.slug || '').toLowerCase() === clean) : null;
  if (matched && matched.name) {
    let color = 'bg-slate-100 text-slate-800 border-slate-200';
    if (clean === 'admin') color = 'bg-amber-100 text-amber-800 border-amber-200';
    else if (clean === 'asesor') color = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    else if (clean === 'comercial') color = 'bg-teal-100 text-teal-800 border-teal-200';
    else if (clean === 'tecnico') color = 'bg-blue-100 text-blue-800 border-blue-200';
    else if (clean === 'ingeniero') color = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    return { name: matched.name, color, slug: clean };
  }

  const roleMap = {
    admin: { name: 'Administrador General', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    asesor: { name: 'Asesor Comercial', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    comercial: { name: 'Comercial', color: 'bg-teal-100 text-teal-800 border-teal-200' },
    tecnico: { name: 'Técnico de Campo', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    ingeniero: { name: 'Ingeniero Solar', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
  };

  return roleMap[clean] || {
    name: roleSlug ? (roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1).replace(/_/g, ' ')) : 'Usuario',
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    slug: clean
  };
}
