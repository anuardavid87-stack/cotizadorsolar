/**
 * Solar Quotation Calculation Engine for SolarQuote Pro
 * Implements the mathematical formulas from the client's Excel models
 */

export const BOMBA_SUGGESTIONS = {
  1: { hp: 1, kw: 0.75, panels: 5, accessories: 2000000 },
  2: { hp: 2, kw: 1.5, panels: 5, accessories: 2000000 },
  3: { hp: 3, kw: 2.25, panels: 6, accessories: 2500000 },
  5: { hp: 5, kw: 3.75, panels: 10, accessories: 3000000 },
  7.5: { hp: 7.5, kw: 5.625, panels: 16, accessories: 4000000 },
  10: { hp: 10, kw: 7.5, panels: 22, accessories: 5000000 },
  15: { hp: 15, kw: 11.25, panels: 32, accessories: 7000000 }
};

export function getBombaSpecs(hpInput) {
  const hp = parseFloat(hpInput);
  if (BOMBA_SUGGESTIONS[hp]) {
    return BOMBA_SUGGESTIONS[hp];
  }
  const kw = parseFloat(((hp || 0) * 0.75).toFixed(3));
  return {
    hp: hp || 0,
    kw,
    panels: Math.ceil((kw * 1.6 * 1000) / 720),
    accessories: 2000000
  };
}

export function calculateSolarQuote({
  systemType = 'ongrid',
  clientConsumptionKwh = 0,
  radiationCoefficient = 10.1,
  pumpHp = 0,
  pumpKw = 0,
  panelPowerW = 720,
  panelUnitPrice = 470000,
  installedPanels = 0,
  selectedInverters = [],
  selectedBatteries = [],
  selectedPumps = [],
  structureType = 'Estructura de aluminio sobre tejado',
  structureUnitPrice = 280000,
  mdoUnitPrice = null,
  retieTiers = [],
  legalizationIncluded = true,
  cajaAcPrice = 2000000,
  accessoriesPrice = 3000000,
  tramitePrice = 1400000,
  bidiPrice = 1890000,
  retieCertPrice = 3820000,
  discountPercent = 0,
  financingDownPaymentPercent = 0,
  financingTermMonths = 48,
  monthlyInterestRate = 0.02 // 2.0% mensual por defecto para créditos de energía solar
}) {
  const consumption = parseFloat(clientConsumptionKwh) || 0;
  const radCoef = parseFloat(radiationCoefficient) || 10.1;
  const panelW = parseFloat(panelPowerW) || 720;
  const panelPrice = parseFloat(panelUnitPrice) || 470000;
  const panelsCount = parseInt(installedPanels) || 0;

  // 1. Proyección teórica según tipo de sistema:
  let requiredPowerKwp = 0;
  let suggestedPanels = 0;

  if (systemType === 'bombeo') {
    // Bombeo Solar: Se omite consumo y radiación.
    // La potencia requerida en paneles se calcula: kW de la bomba * 1.6
    let kw = parseFloat(pumpKw) || 0;
    const hp = parseFloat(pumpHp) || 0;
    if (hp > 0 && BOMBA_SUGGESTIONS[hp]) {
      kw = BOMBA_SUGGESTIONS[hp].kw;
    } else if (!kw && hp > 0) {
      kw = parseFloat((hp * 0.75).toFixed(3));
    }

    if (kw > 0) {
      requiredPowerKwp = parseFloat((kw * 1.6).toFixed(3));
      if (hp > 0 && BOMBA_SUGGESTIONS[hp]) {
        suggestedPanels = BOMBA_SUGGESTIONS[hp].panels;
      } else {
        suggestedPanels = Math.ceil((requiredPowerKwp * 1000) / panelW);
      }
    }
  } else if (consumption > 0) {
    // On-grid / Híbrido / Off-grid basado en consumo mensual:
    const requiredWp = Math.round((consumption / radCoef) * 102);
    requiredPowerKwp = parseFloat((requiredWp / 1000).toFixed(2));
    suggestedPanels = Math.ceil(requiredWp / panelW);
  }

  // 2. Potencia real a instalar definida por el técnico/asesor:
  const installedPowerKwp = parseFloat(((panelsCount * panelW) / 1000).toFixed(2));

  // 3. Mano de Obra (MDO): Bombeo Solar tarifa por defecto $450.000, otros sistemas $400.000
  const defaultMdoTariff = systemType === 'bombeo' ? 450000 : 400000;
  const mdoTariff = mdoUnitPrice !== null && mdoUnitPrice !== undefined && mdoUnitPrice !== '' 
    ? parseFloat(mdoUnitPrice) 
    : defaultMdoTariff;
  const mdoTotal = Math.round(installedPowerKwp * mdoTariff);

  // 4. Estructura = Cantidad de paneles * Costo estructura por panel
  // Bombeo Solar: < 700W = $380.000, >= 700W = $450.000. Otros sistemas = $280.000 por defecto
  const defaultStructureRate = systemType === 'bombeo' 
    ? (panelW < 700 ? 380000 : 450000) 
    : 280000;
  const structPrice = structureUnitPrice !== null && structureUnitPrice !== undefined && structureUnitPrice !== ''
    ? parseFloat(structureUnitPrice)
    : defaultStructureRate;
  const structureTotal = Math.round(panelsCount * structPrice);

  // 5. Paneles = Cantidad de paneles * Precio unitario del panel
  // En el Excel: 12 * 470.000 = $5.640.000
  const panelsTotal = Math.round(panelsCount * panelPrice);

  // 6. Inversores = Suma de cada inversor (cantidad * precio unitario)
  const invertersTotal = (selectedInverters || []).reduce((acc, inv) => {
    return acc + ((parseInt(inv.qty) || 0) * (parseFloat(inv.price) || 0));
  }, 0);

  // 7. Baterías = Suma de cada batería (cantidad * precio unitario)
  const batteriesTotal = (selectedBatteries || []).reduce((acc, bat) => {
    return acc + ((parseInt(bat.qty) || 0) * (parseFloat(bat.price) || 0));
  }, 0);

  // 8. Bombeo = Suma de equipos de bombeo
  const pumpsTotal = (selectedPumps || []).reduce((acc, pmp) => {
    return acc + ((parseInt(pmp.qty) || 0) * (parseFloat(pmp.price) || 0));
  }, 0);

  // 9. Legalización y RETIE:
  // Escala de diseño de ingeniería según kWp instalado:
  let designPrice = 1915900; // Hasta 11 kW por defecto
  if (retieTiers && retieTiers.length > 0) {
    const matchedTier = retieTiers.find(t => installedPowerKwp >= t.min_kw && installedPowerKwp <= t.max_kw);
    if (matchedTier) {
      designPrice = matchedTier.price;
    } else if (installedPowerKwp > 99) {
      designPrice = 9350000;
    }
  } else {
    // Fallback con los valores exactos del Excel
    if (installedPowerKwp <= 11) designPrice = 1915900;
    else if (installedPowerKwp <= 30) designPrice = 2490670;
    else if (installedPowerKwp <= 60) designPrice = 3448620;
    else if (installedPowerKwp <= 99) designPrice = 5747700;
    else designPrice = 9350000;
  }

  const parseOrZero = (v) => parseFloat(v) || 0;
  const tramite = parseOrZero(tramitePrice);
  const bidi = parseOrZero(bidiPrice);
  const retieCert = parseOrZero(retieCertPrice);
  const cajaAc = parseOrZero(cajaAcPrice);
  const accessories = parseOrZero(accessoriesPrice);

  let legalizationTotal = 0;
  if (legalizationIncluded && (systemType === 'ongrid' || systemType === 'hibrido')) {
    // Exact match from Excel: Diseño + Trámite + Medidor Bidi + Certif Retie
    // Ej: 2.490.670 + 1.400.000 + 1.890.000 + 3.820.000 = $9.600.670
    legalizationTotal = designPrice + tramite + bidi + retieCert;
  }

  // 10. Subtotal general:
  let subtotal = mdoTotal + structureTotal + panelsTotal + invertersTotal + batteriesTotal + pumpsTotal;
  if (legalizationIncluded && (systemType === 'ongrid' || systemType === 'hibrido')) {
    subtotal += legalizationTotal + cajaAc + accessories;
  } else {
    // Offgrid o Bombeo sin RETIE de operador de red, pero con protecciones/accesorios
    subtotal += cajaAc + accessories;
  }

  // Descuento comercial
  const discountRate = parseFloat(discountPercent) || 0;
  const discountAmount = Math.round(subtotal * (discountRate / 100));
  const totalPrice = Math.max(0, subtotal - discountAmount);

  // 11. Financiación:
  const downPaymentPercent = parseFloat(financingDownPaymentPercent) || 0;
  const downPaymentAmount = Math.round(totalPrice * (downPaymentPercent / 100));
  const financingAmount = Math.max(0, totalPrice - downPaymentAmount);
  const termMonths = parseInt(financingTermMonths) || 48;
  
  // Cálculo de cuota mensual sistema amortización francés: P * [ i * (1 + i)^n ] / [ (1 + i)^n – 1]
  let monthlyFee = 0;
  if (financingAmount > 0 && termMonths > 0) {
    const r = monthlyInterestRate;
    monthlyFee = Math.round((financingAmount * (r * Math.pow(1 + r, termMonths))) / (Math.pow(1 + r, termMonths) - 1));
  }

  return {
    consumption,
    radCoef,
    requiredPowerKwp,
    suggestedPanels,
    installedPanels: panelsCount,
    installedPowerKwp,
    mdoTotal,
    structureTotal,
    panelsTotal,
    invertersTotal,
    batteriesTotal,
    pumpsTotal,
    designPrice,
    tramitePrice: tramite,
    bidiPrice: bidi,
    retieCertPrice: retieCert,
    cajaAcPrice: cajaAc,
    accessoriesPrice: accessories,
    legalizationTotal,
    subtotal,
    discountPercent: discountRate,
    discountAmount,
    totalPrice,
    financingDownPaymentPercent: downPaymentPercent,
    financingDownPaymentAmount: downPaymentAmount,
    financingAmount,
    financingTermMonths: termMonths,
    financingMonthlyFee: monthlyFee
  };
}
