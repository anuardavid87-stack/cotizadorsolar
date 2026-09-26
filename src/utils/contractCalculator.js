/**
 * Utilities for Solar Construction Contracts Payment Schedule and Financing
 */

/**
 * Adds months to a Date string (YYYY-MM-DD)
 */
export function addMonthsToDate(dateStr, months) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1 + months, day);
  
  // Guard against month overflow (e.g. Feb 30)
  if (d.getDate() !== day) {
    d.setDate(0); // Last day of previous month
  }
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generate installments schedule for 1 to 60 cuotas
 */
export function generateInstallmentsSchedule({
  financedAmount = 0,
  installmentsCount = 1,
  hasInterest = false,
  monthlyRate = 0, // e.g. 0.02 for 2.0%
  firstDate = new Date().toISOString().split('T')[0]
}) {
  const n = Math.max(1, Math.min(60, parseInt(installmentsCount) || 1));
  const principalTotal = Math.max(0, parseFloat(financedAmount) || 0);
  const rate = hasInterest ? Math.max(0, parseFloat(monthlyRate) || 0) : 0;

  const schedule = [];

  if (principalTotal === 0) {
    for (let i = 1; i <= n; i++) {
      schedule.push({
        installment_number: i,
        due_date: addMonthsToDate(firstDate, i - 1),
        amount: 0,
        principal: 0,
        interest: 0,
        remaining_balance: 0
      });
    }
    return schedule;
  }

  // 1. Case WITHOUT interest (0% Tasa de Interés)
  if (!hasInterest || rate === 0) {
    const baseCuota = Math.floor(principalTotal / n);
    let remainder = principalTotal - (baseCuota * n);
    let balance = principalTotal;

    for (let i = 1; i <= n; i++) {
      // Add remainder peso by peso or distribute to first installments
      let currentCuota = baseCuota;
      if (remainder > 0) {
        currentCuota += 1;
        remainder -= 1;
      }

      balance = Math.max(0, balance - currentCuota);
      if (i === n) balance = 0; // Exactly 0 on last installment

      schedule.push({
        installment_number: i,
        due_date: addMonthsToDate(firstDate, i - 1),
        amount: currentCuota,
        principal: currentCuota,
        interest: 0,
        remaining_balance: balance
      });
    }

    return schedule;
  }

  // 2. Case WITH interest (Sistema Francés de Cuota Fija)
  // PMT = P * [ r / (1 - (1 + r)^(-n)) ]
  const pmt = Math.round(
    principalTotal * (rate / (1 - Math.pow(1 + rate, -n)))
  );

  let currentBalance = principalTotal;

  for (let i = 1; i <= n; i++) {
    const interestPart = Math.round(currentBalance * rate);
    let principalPart = pmt - interestPart;

    if (i === n || principalPart > currentBalance) {
      principalPart = currentBalance;
    }

    const totalAmount = principalPart + interestPart;
    currentBalance = Math.max(0, currentBalance - principalPart);

    schedule.push({
      installment_number: i,
      due_date: addMonthsToDate(firstDate, i - 1),
      amount: totalAmount,
      principal: principalPart,
      interest: interestPart,
      remaining_balance: currentBalance
    });
  }

  return schedule;
}

/**
 * Validate that the sum of cuotas matches the financed balance or target total
 */
export function validateInstallmentsSum(installments, targetFinancedAmount, hasInterest = false) {
  if (!Array.isArray(installments) || installments.length === 0) {
    return {
      isValid: false,
      totalSum: 0,
      targetAmount: targetFinancedAmount,
      difference: -targetFinancedAmount
    };
  }

  // When interest is 0, the sum of amounts must equal targetFinancedAmount.
  // When interest is applied, the sum of 'principal' must equal targetFinancedAmount,
  // OR the user is editing the total payment amounts directly.
  const totalSum = installments.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
  const totalPrincipal = installments.reduce((acc, item) => acc + (parseFloat(item.principal !== undefined ? item.principal : item.amount) || 0), 0);
  
  const target = Math.round(targetFinancedAmount);
  // Compare either totalSum (if 0% interest) or totalPrincipal
  const compareValue = hasInterest ? totalPrincipal : totalSum;
  const difference = Math.round(compareValue - target);

  return {
    isValid: Math.abs(difference) <= 5, // tolerance of 5 pesos for rounding
    totalSum: Math.round(totalSum),
    totalPrincipal: Math.round(totalPrincipal),
    targetAmount: target,
    difference
  };
}

/**
 * Auto adjust the last installment so the sum equals targetAmount exactly
 */
export function adjustLastInstallmentToBalance(installments, targetAmount) {
  if (!Array.isArray(installments) || installments.length === 0) return installments;
  
  const cloned = installments.map(item => ({ ...item }));
  const sumExceptLast = cloned.slice(0, -1).reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
  const requiredLast = Math.max(0, Math.round(targetAmount - sumExceptLast));
  
  cloned[cloned.length - 1].amount = requiredLast;
  cloned[cloned.length - 1].principal = requiredLast;
  cloned[cloned.length - 1].remaining_balance = 0;
  
  return cloned;
}

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DECENAS = [
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'
];
const DIEZ_DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
];

function leerTresDigitos(n) {
  let output = '';
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;

  if (n === 100) return 'CIEN';
  if (c > 0) output += CENTENAS[c] + ' ';

  const resto = n % 100;
  if (resto >= 10 && resto <= 29) {
    output += DECENAS[resto - 10] + ' ';
  } else if (resto > 29) {
    output += DIEZ_DECENAS[d];
    if (u > 0) output += ' Y ' + UNIDADES[u];
    output += ' ';
  } else if (u > 0) {
    output += UNIDADES[u] + ' ';
  }
  return output.trim();
}

/**
 * Converts a number to its Spanish text representation
 * e.g. 54600000 -> "CINCUENTA Y CUATRO MILLONES SEISCIENTOS MIL"
 */
export function numeroALetras(num) {
  const entero = Math.floor(Math.abs(num || 0));
  if (entero === 0) return 'CERO';

  const millones = Math.floor(entero / 1000000);
  const miles = Math.floor((entero % 1000000) / 1000);
  const unidades = entero % 1000;

  let resultado = '';

  if (millones > 0) {
    if (millones === 1) {
      resultado += 'UN MILLÓN ';
    } else {
      resultado += leerTresDigitos(millones) + ' MILLONES ';
    }
  }

  if (miles > 0) {
    if (miles === 1) {
      resultado += 'MIL ';
    } else {
      resultado += leerTresDigitos(miles) + ' MIL ';
    }
  }

  if (unidades > 0) {
    resultado += leerTresDigitos(unidades) + ' ';
  }

  return resultado.trim();
}

/**
 * Formats a currency amount into written Spanish words + PESOS
 * e.g. 54600000 -> "CINCUENTA Y CUATRO MILLONES SEISCIENTOS MIL PESOS"
 */
export function formatoMonedaLetras(num) {
  const entero = Math.round(num || 0);
  const letras = numeroALetras(entero);
  const endsWithMillion = letras.endsWith('MILLÓN') || letras.endsWith('MILLONES');
  return `${letras} ${endsWithMillion ? 'DE PESOS' : 'PESOS'}`;
}

