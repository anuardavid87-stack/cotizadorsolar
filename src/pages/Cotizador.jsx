import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  SunMedium,
  BatteryCharging,
  Zap,
  Droplets,
  Plus,
  Trash2,
  Calendar,
  Save,
  UserPlus,
  Info,
  DollarSign,
  Layers,
  Wrench,
  CheckCircle,
  HelpCircle,
  Sparkles,
  ClipboardCheck,
  Edit2,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { calculateSolarQuote, BOMBA_SUGGESTIONS, getBombaSpecs } from '../utils/solarCalculator';
import { formatCOP, formatKW, getRoofTypeName } from '../utils/formatters';
import Modal from '../components/Modal';

export default function Cotizador({ onNotify }) {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Editing existing quote state
  const [editingQuote, setEditingQuote] = useState(null);

  // Master Data
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [retieTiers, setRetieTiers] = useState([]);
  const [companySettings, setCompanySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveLockRef = useRef(false);

  // Modal new client
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    doc_type: 'CC',
    doc_number: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    operator: 'Afinia',
    client_type: 'Residencial',
    stratum: '4'
  });

  // Quotation State
  const [systemType, setSystemType] = useState('ongrid'); // ongrid, hibrido, offgrid, bombeo
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientConsumptionKwh, setClientConsumptionKwh] = useState(4320); // Default demo match
  const [radiationCoef, setRadiationCoef] = useState(10.1);
  const [selectedPanelId, setSelectedPanelId] = useState('');
  const [installedPanels, setInstalledPanels] = useState(12); // Default technician manual input

  // Bombeo Solar state
  const [bombeoHp, setBombeoHp] = useState(3);
  const [bombeoKw, setBombeoKw] = useState(2.25);

  // Equipment multi-selections
  const [selectedInverters, setSelectedInverters] = useState([]);
  const [selectedBatteries, setSelectedBatteries] = useState([]);
  const [selectedPumps, setSelectedPumps] = useState([]);

  // Structure & Labor rates
  const [structureType, setStructureType] = useState('Estructura de aluminio sobre tejado');
  const [structureUnitPrice, setStructureUnitPrice] = useState(280000);
  const [mdoUnitPrice, setMdoUnitPrice] = useState(400000);

  // Legalization & Services
  const [legalizationIncluded, setLegalizationIncluded] = useState(true);
  const [cajaAcPrice, setCajaAcPrice] = useState(2500000);
  const [accessoriesPrice, setAccessoriesPrice] = useState(3000000);
  const [tramitePrice, setTramitePrice] = useState(1400000);
  const [bidiPrice, setBidiPrice] = useState(1890000);
  const [retieCertPrice, setRetieCertPrice] = useState(3820000);

  // Commercial & Follow-up
  const [discountPercent, setDiscountPercent] = useState(0);
  const [financingDownPaymentPercent, setFinancingDownPaymentPercent] = useState(0);
  const [financingTermMonths, setFinancingTermMonths] = useState(48);
  const [monthlyInterestRatePercent, setMonthlyInterestRatePercent] = useState(2.0);
  const [interestScore, setInterestScore] = useState(8); // 1 to 10
  const [linkedVisit, setLinkedVisit] = useState(null);
  
  // Followup date (default to 3 days from now)
  const defaultFollowup = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  }, []);
  const [followupDate, setFollowupDate] = useState(defaultFollowup);
  const [notes, setNotes] = useState('');

  // Fetch initial master data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [resClients, resProds, resTiers, resSettings] = await Promise.all([
          authFetch('/api/clients'),
          authFetch('/api/products?active=1'),
          authFetch('/api/products/retie-tiers'),
          authFetch('/api/settings')
        ]);

        const dataClients = await resClients.json();
        const dataProds = await resProds.json();
        const dataTiers = await resTiers.json();
        const dataSettings = await resSettings.json();

        setClients(dataClients.clients || []);
        setProducts(dataProds.products || []);
        setRetieTiers(dataTiers.tiers || []);
        setCompanySettings(dataSettings.settings || null);

        // Preselect first panel
        const panels = (dataProds.products || []).filter(p => p.category === 'paneles');
        if (panels.length > 0) {
          setSelectedPanelId(panels[0].id.toString());
        }

        // Check URL params for clientId or system
        const paramClientId = searchParams.get('clientId');
        if (paramClientId) setSelectedClientId(paramClientId);

        const paramSystem = searchParams.get('system');
        if (paramSystem && ['ongrid', 'hibrido', 'offgrid', 'bombeo'].includes(paramSystem)) {
          setSystemType(paramSystem);
        }

        // Check URL params for visitId (pre-loading technical visit data)
        const paramVisitId = searchParams.get('visitId');
        if (paramVisitId) {
          try {
            const resVisit = await authFetch(`/api/visits/${paramVisitId}`);
            if (resVisit.ok) {
              const dataVisit = await resVisit.json();
              if (dataVisit.visit) {
                const v = dataVisit.visit;
                setLinkedVisit(v);
                if (v.client_id) setSelectedClientId(v.client_id.toString());
                if (v.client_consumption_kwh > 0) setClientConsumptionKwh(v.client_consumption_kwh);
                if (v.recommended_system_type && ['ongrid', 'hibrido', 'offgrid', 'bombeo'].includes(v.recommended_system_type)) {
                  setSystemType(v.recommended_system_type);
                }
                if (v.recommended_structure_type) setStructureType(v.recommended_structure_type);
                setNotes(`Cotización elaborada a partir del Levantamiento Técnico ${v.visit_code}.\nCubierta: ${getRoofTypeName(v.roof_type)}, Área útil: ${v.available_area_m2 || 0} m² (${v.estimated_panels_total || 0} paneles est.), Acometida: ${v.voltage_level || 'N/A'}.\nNotas del Técnico: ${v.technician_notes || 'Sin observaciones'}`);
              }
            }
          } catch (errVisit) {
            console.warn('Error loading visit for quote:', errVisit);
          }
        }

        // Check URL params for editQuoteId or quoteId (pre-loading existing quote for editing)
        const paramEditQuoteId = searchParams.get('editQuoteId') || searchParams.get('quoteId');
        if (paramEditQuoteId) {
          try {
            const resQuote = await authFetch(`/api/quotes/${paramEditQuoteId}`);
            if (resQuote.ok) {
              const dataQuote = await resQuote.json();
              if (dataQuote.quote) {
                const q = dataQuote.quote;
                setEditingQuote(q);
                if (q.client_id) setSelectedClientId(q.client_id.toString());
                if (q.system_type) setSystemType(q.system_type);
                if (q.client_consumption_kwh !== undefined) setClientConsumptionKwh(q.client_consumption_kwh);
                if (q.radiation_coefficient !== undefined) setRadiationCoef(q.radiation_coefficient);
                if (q.panel_model_id) setSelectedPanelId(q.panel_model_id.toString());
                if (q.installed_panels !== undefined) setInstalledPanels(q.installed_panels);
                if (q.selected_inverters && Array.isArray(q.selected_inverters)) setSelectedInverters(q.selected_inverters);
                if (q.selected_batteries && Array.isArray(q.selected_batteries)) setSelectedBatteries(q.selected_batteries);
                if (q.selected_pumps && Array.isArray(q.selected_pumps)) setSelectedPumps(q.selected_pumps);
                if (q.structure_type) setStructureType(q.structure_type);
                if (q.structure_unit_price !== undefined) setStructureUnitPrice(q.structure_unit_price);
                if (q.mdo_unit_price !== undefined) setMdoUnitPrice(q.mdo_unit_price);
                if (q.legalization_included !== undefined) setLegalizationIncluded(q.legalization_included === 1);
                if (q.caja_ac_price !== undefined) setCajaAcPrice(q.caja_ac_price);
                if (q.accessories_price !== undefined) setAccessoriesPrice(q.accessories_price);
                if (q.legalization_tramite_price !== undefined) setTramitePrice(q.legalization_tramite_price);
                if (q.legalization_bidi_price !== undefined) setBidiPrice(q.legalization_bidi_price);
                if (q.legalization_retie_price !== undefined) setRetieCertPrice(q.legalization_retie_price);
                if (q.discount_percent !== undefined) setDiscountPercent(q.discount_percent);
                if (q.financing_down_payment_percent !== undefined) setFinancingDownPaymentPercent(q.financing_down_payment_percent);
                if (q.financing_term_months !== undefined) setFinancingTermMonths(q.financing_term_months);
                if (q.financing_monthly_rate !== undefined) setMonthlyInterestRatePercent(Number((q.financing_monthly_rate * 100).toFixed(2)));
                if (q.interest_score !== undefined) setInterestScore(q.interest_score);
                if (q.followup_date) setFollowupDate(q.followup_date.split('T')[0]);
                if (q.notes) setNotes(q.notes);
              }
            }
          } catch (errQuote) {
            console.warn('Error loading quote for edit:', errQuote);
          }
        }
      } catch (err) {
        console.error('Error loading cotizador data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filtered product lists
  const availablePanels = useMemo(() => products.filter(p => p.category === 'paneles'), [products]);
  const availableInverters = useMemo(() => products.filter(p => p.category === 'inversores'), [products]);
  const availableVFDs = useMemo(() => {
    return products.filter(p => 
      p.category === 'variadores' || 
      (p.category === 'bombas' && p.name.toLowerCase().includes('variador'))
    );
  }, [products]);
  const availableBatteries = useMemo(() => products.filter(p => p.category === 'baterias'), [products]);
  const availablePumps = useMemo(() => products.filter(p => p.category === 'bombas' && !p.name.toLowerCase().includes('variador')), [products]);
  const availableStructures = useMemo(() => products.filter(p => p.category === 'estructuras'), [products]);

  // Active panel details
  const currentPanel = useMemo(() => {
    return availablePanels.find(p => p.id.toString() === selectedPanelId.toString()) || availablePanels[0] || { power_w: 720, unit_price: 470000 };
  }, [availablePanels, selectedPanelId]);

  // Adjust structure price when changing structure type
  const handleStructureTypeChange = (e) => {
    const selectedName = e.target.value;
    setStructureType(selectedName);
    const found = availableStructures.find(s => s.name === selectedName);
    if (found) {
      setStructureUnitPrice(found.unit_price);
    } else if (systemType === 'bombeo') {
      const pw = currentPanel?.power_w || 720;
      setStructureUnitPrice(pw < 700 ? 380000 : 450000);
    } else if (selectedName === 'Estructura en acero a piso') {
      setStructureUnitPrice(380000);
    } else {
      setStructureUnitPrice(280000);
    }
  };

  // Panel selection handler (adapts structure price in Bombeo Solar: <700W $380k, >=700W $450k)
  const handlePanelChange = (panelId) => {
    setSelectedPanelId(panelId);
    const panel = availablePanels.find(p => p.id.toString() === panelId.toString());
    if (systemType === 'bombeo' && panel) {
      const pw = panel.power_w || 0;
      setStructureUnitPrice(pw < 700 ? 380000 : 450000);
    }
  };

  // Bombeo HP selection handler
  const handleSelectBombeoHp = (hp) => {
    const validHp = parseFloat(hp) || 0;
    const specs = getBombaSpecs(validHp);
    setBombeoHp(validHp);
    setBombeoKw(specs.kw);
    setInstalledPanels(specs.panels);
    setAccessoriesPrice(specs.accessories);

    // Auto-select matching VFD in Step 3
    if (availableVFDs.length > 0 && validHp > 0) {
      const matchingVfd = availableVFDs.find(v => 
        v.name.includes(`${validHp} HP`) || 
        v.name.includes(`${validHp}HP`) ||
        (v.power_w && Math.abs(v.power_w - specs.kw * 1000) < 300)
      ) || availableVFDs[0];

      if (matchingVfd) {
        setSelectedInverters([{
          productId: matchingVfd.id,
          name: matchingVfd.name,
          power: matchingVfd.power_w,
          qty: 1,
          price: matchingVfd.unit_price
        }]);
      }
    }
  };

  // System type selection handler
  const handleSelectSystemType = (newType) => {
    setSystemType(newType);
    if (newType === 'bombeo') {
      setMdoUnitPrice(450000);
      setCajaAcPrice(0);
      setLegalizationIncluded(false);
      const panel = availablePanels.find(p => p.id.toString() === selectedPanelId.toString()) || availablePanels[0];
      const pw = panel?.power_w || 720;
      setStructureUnitPrice(pw < 700 ? 380000 : 450000);
      handleSelectBombeoHp(bombeoHp || 3);
    } else {
      if (mdoUnitPrice === 450000) setMdoUnitPrice(400000);
      if (cajaAcPrice === 0) setCajaAcPrice(2500000);
      if (structureUnitPrice === 380000 || structureUnitPrice === 450000) setStructureUnitPrice(280000);
      if (newType === 'hibrido') {
        setAccessoriesPrice(5000000);
        setLegalizationIncluded(true);
      } else if (newType === 'ongrid') {
        setAccessoriesPrice(3000000);
        setLegalizationIncluded(true);
      } else if (newType === 'offgrid') {
        setAccessoriesPrice(4000000);
        setLegalizationIncluded(false);
      }
    }
  };

  // Inverter / VFD management
  const addInverter = (prodId) => {
    const list = systemType === 'bombeo' ? availableVFDs : availableInverters;
    const prod = list.find(p => p.id.toString() === prodId.toString()) || products.find(p => p.id.toString() === prodId.toString());
    if (!prod) return;
    const existing = selectedInverters.find(item => item.productId === prod.id);
    if (existing) {
      setSelectedInverters(selectedInverters.map(item => item.productId === prod.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setSelectedInverters([...selectedInverters, {
        productId: prod.id,
        name: prod.name,
        power: prod.power_w,
        qty: 1,
        price: prod.unit_price
      }]);
    }
  };

  const updateInverterQty = (productId, qty) => {
    const q = parseInt(qty) || 0;
    if (q <= 0) {
      setSelectedInverters(selectedInverters.filter(i => i.productId !== productId));
    } else {
      setSelectedInverters(selectedInverters.map(i => i.productId === productId ? { ...i, qty: q } : i));
    }
  };

  const removeInverter = (productId) => {
    setSelectedInverters(selectedInverters.filter(i => i.productId !== productId));
  };

  // Battery management
  const addBattery = (prodId) => {
    const prod = availableBatteries.find(p => p.id.toString() === prodId.toString());
    if (!prod) return;
    const existing = selectedBatteries.find(item => item.productId === prod.id);
    if (existing) {
      setSelectedBatteries(selectedBatteries.map(item => item.productId === prod.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setSelectedBatteries([...selectedBatteries, {
        productId: prod.id,
        name: prod.name,
        voltage: prod.voltage,
        ah: prod.capacity_ah,
        qty: 1,
        price: prod.unit_price
      }]);
    }
  };

  const updateBatteryQty = (productId, qty) => {
    const q = parseInt(qty) || 0;
    if (q <= 0) {
      setSelectedBatteries(selectedBatteries.filter(b => b.productId !== productId));
    } else {
      setSelectedBatteries(selectedBatteries.map(b => b.productId === productId ? { ...b, qty: q } : b));
    }
  };

  const removeBattery = (productId) => {
    setSelectedBatteries(selectedBatteries.filter(b => b.productId !== productId));
  };

  // Pump management
  const addPump = (prodId) => {
    const prod = availablePumps.find(p => p.id.toString() === prodId.toString());
    if (!prod) return;
    const existing = selectedPumps.find(item => item.productId === prod.id);
    if (existing) {
      setSelectedPumps(selectedPumps.map(item => item.productId === prod.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setSelectedPumps([...selectedPumps, {
        productId: prod.id,
        name: prod.name,
        qty: 1,
        price: prod.unit_price
      }]);
    }
  };

  const updatePumpQty = (productId, qty) => {
    const q = parseInt(qty) || 0;
    if (q <= 0) {
      setSelectedPumps(selectedPumps.filter(p => p.productId !== productId));
    } else {
      setSelectedPumps(selectedPumps.map(p => p.productId === productId ? { ...p, qty: q } : p));
    }
  };

  const removePump = (productId) => {
    setSelectedPumps(selectedPumps.filter(p => p.productId !== productId));
  };

  // Run Calculations
  const quoteCalculation = useMemo(() => {
    return calculateSolarQuote({
      systemType,
      clientConsumptionKwh,
      radiationCoefficient: radiationCoef,
      pumpHp: bombeoHp,
      pumpKw: bombeoKw,
      panelPowerW: currentPanel?.power_w || 720,
      panelUnitPrice: currentPanel?.unit_price || 470000,
      installedPanels,
      selectedInverters,
      selectedBatteries,
      selectedPumps,
      structureType,
      structureUnitPrice,
      mdoUnitPrice,
      retieTiers,
      legalizationIncluded: systemType === 'ongrid' || systemType === 'hibrido' ? legalizationIncluded : false,
      cajaAcPrice,
      accessoriesPrice,
      tramitePrice,
      bidiPrice,
      retieCertPrice,
      discountPercent,
      financingDownPaymentPercent,
      financingTermMonths,
      monthlyInterestRate: (parseFloat(monthlyInterestRatePercent) || 0) / 100
    });
  }, [
    systemType,
    clientConsumptionKwh,
    radiationCoef,
    bombeoHp,
    bombeoKw,
    currentPanel,
    installedPanels,
    selectedInverters,
    selectedBatteries,
    selectedPumps,
    structureType,
    structureUnitPrice,
    mdoUnitPrice,
    retieTiers,
    legalizationIncluded,
    cajaAcPrice,
    accessoriesPrice,
    tramitePrice,
    bidiPrice,
    retieCertPrice,
    discountPercent,
    financingDownPaymentPercent,
    financingTermMonths,
    monthlyInterestRatePercent
  ]);

  // Pre-fill inverters / variador when system type is toggled if empty
  useEffect(() => {
    if (selectedInverters.length === 0) {
      if (systemType === 'ongrid' && availableInverters.length > 0) {
        const inv = availableInverters.find(i => i.name.includes('HUAWEI') && i.name.includes('6K')) || availableInverters[0];
        if (inv) setSelectedInverters([{ productId: inv.id, name: inv.name, power: inv.power_w, qty: 1, price: inv.unit_price }]);
      } else if (systemType === 'hibrido' && availableInverters.length > 0) {
        const inv = availableInverters.find(i => i.name.includes('SRNE HIBRIDO 12K')) || availableInverters[0];
        if (inv) setSelectedInverters([{ productId: inv.id, name: inv.name, power: inv.power_w, qty: 1, price: inv.unit_price }]);
      } else if (systemType === 'offgrid' && availableInverters.length > 0) {
        const inv = availableInverters.find(i => i.name.includes('OFF GRID')) || availableInverters[0];
        if (inv) setSelectedInverters([{ productId: inv.id, name: inv.name, power: inv.power_w, qty: 1, price: inv.unit_price }]);
      } else if (systemType === 'bombeo' && availableVFDs.length > 0) {
        const vfd = availableVFDs.find(v => v.name.includes(`${bombeoHp || 3} HP`) || v.name.includes(`${bombeoHp || 3}HP`)) || availableVFDs[0];
        if (vfd) setSelectedInverters([{ productId: vfd.id, name: vfd.name, power: vfd.power_w, qty: 1, price: vfd.unit_price }]);
      }
    }
  }, [systemType, availableInverters, availableVFDs, bombeoHp]);

  // Pre-fill batteries when switching to hybrid if empty
  useEffect(() => {
    if ((systemType === 'hibrido' || systemType === 'offgrid') && selectedBatteries.length === 0 && availableBatteries.length > 0) {
      const bat = availableBatteries.find(b => b.name.includes('Litio 200') || b.name.includes('Litio 100')) || availableBatteries[0];
      if (bat) setSelectedBatteries([{ productId: bat.id, name: bat.name, voltage: bat.voltage, ah: bat.capacity_ah, qty: 1, price: bat.unit_price }]);
    }
  }, [systemType, availableBatteries]);

  // Handle Quick Create Client
  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify(newClientData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear cliente');

      setClients([data.client, ...clients]);
      setSelectedClientId(data.client.id.toString());
      setIsClientModalOpen(false);
      setNewClientData({
        name: '', doc_type: 'CC', doc_number: '', phone: '', email: '',
        address: '', city: '', operator: 'Afinia', client_type: 'Residencial', stratum: '4'
      });
      if (onNotify) onNotify({ type: 'success', message: 'Cliente registrado exitosamente' });
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  // Submit and save quote
  const handleSaveQuote = async () => {
    if (saveLockRef.current) return;

    if (!selectedClientId) {
      if (onNotify) onNotify({ type: 'warning', message: 'Debes seleccionar un cliente para guardar la cotización.' });
      return;
    }

    if (!followupDate) {
      if (onNotify) onNotify({ type: 'warning', message: 'La fecha de seguimiento es obligatoria.' });
      return;
    }

    try {
      saveLockRef.current = true;
      setSaving(true);
      const payload = {
        client_id: parseInt(selectedClientId),
        system_type: systemType,
        interest_score: interestScore,
        followup_date: followupDate,
        client_consumption_kwh: clientConsumptionKwh,
        radiation_coefficient: radiationCoef,
        required_power_kwp: quoteCalculation.requiredPowerKwp,
        panel_model_id: currentPanel ? currentPanel.id : null,
        panel_power_w: currentPanel ? currentPanel.power_w : 720,
        panel_unit_price: currentPanel ? currentPanel.unit_price : 470000,
        suggested_panels: quoteCalculation.suggestedPanels,
        installed_panels: quoteCalculation.installedPanels,
        installed_power_kwp: quoteCalculation.installedPowerKwp,
        selected_inverters: selectedInverters,
        selected_batteries: selectedBatteries,
        selected_pumps: selectedPumps,
        mdo_unit_price: mdoUnitPrice,
        mdo_total: quoteCalculation.mdoTotal,
        structure_type: structureType,
        structure_unit_price: structureUnitPrice,
        structure_total: quoteCalculation.structureTotal,
        panels_total: quoteCalculation.panelsTotal,
        inverters_total: quoteCalculation.invertersTotal,
        batteries_total: quoteCalculation.batteriesTotal,
        pumps_total: quoteCalculation.pumpsTotal,
        legalization_included: legalizationIncluded,
        legalization_design_price: quoteCalculation.designPrice,
        legalization_tramite_price: quoteCalculation.tramitePrice,
        legalization_bidi_price: quoteCalculation.bidiPrice,
        legalization_retie_price: quoteCalculation.retieCertPrice,
        caja_ac_price: quoteCalculation.cajaAcPrice,
        accessories_price: quoteCalculation.accessoriesPrice,
        legalization_total: quoteCalculation.legalizationTotal,
        subtotal: quoteCalculation.subtotal,
        discount_percent: quoteCalculation.discountPercent,
        discount_amount: quoteCalculation.discountAmount,
        total_price: quoteCalculation.totalPrice,
        financing_down_payment_percent: quoteCalculation.financingDownPaymentPercent,
        financing_down_payment_amount: quoteCalculation.financingDownPaymentAmount,
        financing_amount: quoteCalculation.financingAmount,
        financing_term_months: quoteCalculation.financingTermMonths,
        financing_monthly_fee: quoteCalculation.financingMonthlyFee,
        financing_monthly_rate: (parseFloat(monthlyInterestRatePercent) || 0) / 100,
        visit_id: linkedVisit?.id || (searchParams.get('visitId') ? parseInt(searchParams.get('visitId')) : null),
        notes
      };

      const url = editingQuote ? `/api/quotes/${editingQuote.id}` : '/api/quotes';
      const method = editingQuote ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar la cotización');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: editingQuote
            ? `Cotización ${data.quote_code} actualizada exitosamente.`
            : `Cotización ${data.quote_code} guardada con éxito.`
        });
      }
      navigate(`/cotizacion/${data.id}`);
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#2d8a58] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Editing Existing Quote Banner */}
      {editingQuote && (
        <div className="bg-slate-900 text-white px-6 py-4 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl border-2 border-[#2d8a58]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#2d8a58] text-white flex items-center justify-center font-bold shrink-0 shadow-md">
              <Edit2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-[11px] uppercase tracking-wider bg-[#2d8a58]/20 text-[#48bb78] px-2.5 py-0.5 rounded-full border border-[#2d8a58]/40">
                  Modo Edición de Cotización
                </span>
                <span className="font-mono font-bold text-xs text-amber-300">{editingQuote.quote_code}</span>
              </div>
              <p className="text-sm font-bold text-white mt-1">
                Editando cotización de: {editingQuote.client_name} ({editingQuote.client_city || 'Sitio'}) &bull; Total actual: {formatCOP(editingQuote.total_price)}
              </p>
              <p className="text-xs text-slate-300">
                Puedes ajustar cualquier parámetro, equipos, paneles o condiciones de financiación. Al guardar, se actualizará la propuesta existente.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/cotizacion/${editingQuote.id}`)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a la Propuesta</span>
          </button>
        </div>
      )}

      {/* Linked Visit Alert Banner */}
      {linkedVisit && !editingQuote && (
        <div className="bg-[#2d8a58] text-white px-6 py-4 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-[#2d8a58]/25 border border-[#48bb78]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white text-[#1c5c3a] flex items-center justify-center font-bold shrink-0 shadow-sm">
              <ClipboardCheck className="w-6 h-6 text-[#2d8a58]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-[11px] uppercase tracking-wider bg-black/30 text-white px-2.5 py-0.5 rounded-full">
                  Visita Técnica Vinculada
                </span>
                <span className="font-mono font-bold text-xs">{linkedVisit.visit_code}</span>
              </div>
              <p className="text-sm font-bold text-white mt-1">
                Cotizando para: {linkedVisit.client_name} ({linkedVisit.client_city || 'Sitio'}) &bull; Acometida: {linkedVisit.voltage_level || 'Bifásica'} &bull; Cubierta: {linkedVisit.roof_type || 'Teja'}
              </p>
              <p className="text-xs text-white/90">
                Al guardar y generar la propuesta, esta visita pasará automáticamente al <strong>Histórico de Visitas Cotizadas</strong> y se removerá la alerta pendiente.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLinkedVisit(null)}
            className="text-xs font-bold underline hover:text-white/80 text-white self-start sm:self-auto cursor-pointer"
          >
            Desvincular visita
          </button>
        </div>
      )}

      {/* Top Header & System Type Tabs */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <SunMedium className="w-7 h-7 text-[#2d8a58]" />
              {editingQuote ? `Editar Cotización ${editingQuote.quote_code}` : 'Cotizador Solar Inteligente'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Dimensionamiento fotovoltaico, desglose presupuestal, trámites RETIE y simulación financiera &bull; Renova Energy PRO
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsClientModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Nuevo Cliente</span>
            </button>

            <button
              onClick={handleSaveQuote}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-md shadow-[#2d8a58]/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : editingQuote ? 'Guardar Cambios en Cotización' : 'Guardar y Generar Propuesta'}</span>
            </button>
          </div>
        </div>

        {/* 4 System Type Selector Tabs */}
        <div className="mt-5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            1. Selecciona el Tipo de Sistema Solar a Cotizar:
          </label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { id: 'ongrid', title: '1. On-Grid', desc: 'Interconectado a red (Ahorro factura)', icon: SunMedium, color: 'text-[#2d8a58]' },
              { id: 'hibrido', title: '2. On-Grid con Baterías', desc: 'Híbrido (Ahorro + Respaldo ante cortes)', icon: BatteryCharging, color: 'text-emerald-500' },
              { id: 'offgrid', title: '3. Off-Grid Aislado', desc: 'Fincas y zonas no interconectadas', icon: Zap, color: 'text-blue-500' },
              { id: 'bombeo', title: '4. Bombeo Solar', desc: 'Pozos y riego agrícola con bomba y variador', icon: Droplets, color: 'text-cyan-500' }
            ].map((sys) => {
              const Icon = sys.icon;
              const isSelected = systemType === sys.id;
              return (
                <button
                  key={sys.id}
                  type="button"
                  onClick={() => handleSelectSystemType(sys.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#2d8a58] bg-[#2d8a58]/10 ring-2 ring-[#2d8a58]/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold ${isSelected ? 'text-[#1c5c3a]' : 'text-slate-800'}`}>
                      {sys.title}
                    </span>
                    <Icon className={`w-5 h-5 ${sys.color}`} />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    {sys.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid: Left Inputs & Right Live Calculation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Inputs & Equipment */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section: Client & Follow-up Information */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center">1</span>
              Datos del Cliente y Programación de Seguimiento
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cliente <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                >
                  <option value="">-- Selecciona un cliente registrado --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.doc_type} {c.doc_number}) - {c.city || 'Sin ciudad'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Fecha de Próximo Seguimiento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Interés Inicial del Cliente (1 al 10)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={interestScore}
                    onChange={(e) => setInterestScore(parseInt(e.target.value))}
                    className="flex-1 accent-amber-500 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                    interestScore >= 8 ? 'bg-red-100 text-red-700 border-red-200' :
                    interestScore >= 5 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    'bg-blue-100 text-blue-800 border-blue-200'
                  }`}>
                    {interestScore} / 10
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Solar Sizing & Panel Adjustment (Like user's Excel) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center">2</span>
              Proyección Solar & Ajuste Técnico de Paneles
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {systemType === 'bombeo' ? (
                <div className="sm:col-span-2 space-y-3">
                  <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                      <label className="text-xs font-black text-cyan-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Droplets className="w-4 h-4 text-cyan-600" />
                        Potencia de Bomba Solar Seleccionada
                      </label>
                      <span className="text-[11px] font-black text-cyan-800 bg-cyan-100/90 border border-cyan-200 px-2.5 py-0.5 rounded-full self-start">
                        Fórmula: kW Bomba × 1.6
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mb-3">
                      En sistemas de bombeo solar no se requiere consumo mensual ni coeficiente de radiación. Selecciona la potencia de la bomba a usar para dimensionar la potencia en paneles y auto-sugerir accesorios y variador:
                    </p>

                    {/* 7 Standard Buttons */}
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {[
                        { hp: 1, label: '1 HP', kw: 0.75 },
                        { hp: 2, label: '2 HP', kw: 1.5 },
                        { hp: 3, label: '3 HP', kw: 2.25 },
                        { hp: 5, label: '5 HP', kw: 3.75 },
                        { hp: 7.5, label: '7.5 HP', kw: 5.625 },
                        { hp: 10, label: '10 HP', kw: 7.5 },
                        { hp: 15, label: '15 HP', kw: 11.25 }
                      ].map((item) => {
                        const isSelected = Number(bombeoHp) === item.hp;
                        return (
                          <button
                            key={item.hp}
                            type="button"
                            onClick={() => handleSelectBombeoHp(item.hp)}
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-600 text-white border-cyan-700 shadow-sm ring-2 ring-cyan-400/40 font-black'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50 font-bold'
                            }`}
                          >
                            <div className="text-xs font-black">{item.label}</div>
                            <div className={`text-[10px] ${isSelected ? 'text-cyan-100' : 'text-slate-400'}`}>
                              {item.kw} kW
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Manual / Fine-tune HP & kW */}
                    <div className="mt-3 pt-3 border-t border-cyan-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">Ajuste Potencia:</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="50"
                            value={bombeoHp}
                            onChange={(e) => handleSelectBombeoHp(parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 bg-white border border-cyan-300 rounded-lg text-xs font-black text-center text-slate-800"
                          />
                          <span className="font-bold text-slate-600">HP</span>
                          <span className="text-slate-400 font-semibold">({bombeoKw} kW)</span>
                        </div>
                      </div>

                      <div className="text-xs text-cyan-950 font-bold">
                        Potencia en Paneles Requerida: <span className="text-sm font-black text-cyan-700">{formatKW(quoteCalculation.requiredPowerKwp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Consumo Cliente */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Consumo del Cliente (kWh/mes)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="10"
                        value={clientConsumptionKwh}
                        onChange={(e) => setClientConsumptionKwh(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        placeholder="Ej. 4320"
                      />
                      <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">kWh</span>
                    </div>
                    {/* Quick Touch Presets for Mobile */}
                    <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
                      {[250, 450, 750, 1200, 2500, 4320].map((kwh) => (
                        <button
                          key={kwh}
                          type="button"
                          onClick={() => setClientConsumptionKwh(kwh)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer shrink-0 ${
                            Number(clientConsumptionKwh) === kwh
                              ? 'bg-[#2d8a58] text-white border-[#2d8a58]'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {kwh} kWh
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Coeficiente de Radiación */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <span>Coeficiente de Radiación</span>
                      <span className="text-[10px] text-slate-400">(HSP / Factor)</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={radiationCoef}
                      onChange={(e) => setRadiationCoef(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Modelo de Panel */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Modelo de Panel Solar (Catálogo)
                </label>
                <select
                  value={selectedPanelId}
                  onChange={(e) => handlePanelChange(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {availablePanels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.power_w} Wp) - {formatCOP(p.unit_price)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sugerencia Automática vs Ajuste Técnico */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 sm:col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Potencia Requerida Sugerida
                  </span>
                  <div className="text-lg font-black text-slate-800 mt-0.5">
                    {formatKW(quoteCalculation.requiredPowerKwp)}
                  </div>
                  <div className="text-xs text-amber-700 font-semibold mt-1">
                    Sugerencia: {quoteCalculation.suggestedPanels} paneles
                    {systemType === 'bombeo' && (
                      <span className="text-slate-500 block text-[11px] font-normal">
                        ({bombeoKw} kW × 1.6 = {formatKW(quoteCalculation.requiredPowerKwp)})
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-l border-slate-200 pl-4">
                  <label className="block text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Paneles a Instalar (Técnico)
                  </label>
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setInstalledPanels(Math.max(1, (installedPanels || 1) - 1))}
                      className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-white font-black text-xl flex items-center justify-center shrink-0 active:scale-95 transition-all select-none cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="1000"
                      value={installedPanels}
                      onChange={(e) => setInstalledPanels(parseInt(e.target.value) || 0)}
                      className="w-full text-center px-2 py-2 rounded-xl border-2 border-amber-400 bg-white dark:bg-slate-900 font-black text-slate-900 dark:text-white text-base focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setInstalledPanels((installedPanels || 0) + 1)}
                      className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xl flex items-center justify-center shrink-0 shadow-xs active:scale-95 transition-all select-none cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-xs font-bold text-slate-600 mt-1">
                    Potencia real: <span className="text-emerald-700 font-black">{formatKW(quoteCalculation.installedPowerKwp)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Inverters / Variador Selection */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center">3</span>
                {systemType === 'bombeo' ? 'Variador de Frecuencia Solar' : 'Inversores Solares Seleccionados'}
              </h2>

              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addInverter(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>
                  {systemType === 'bombeo' ? '+ Agregar variador solar...' : '+ Agregar inversor...'}
                </option>
                {(systemType === 'bombeo' ? availableVFDs : availableInverters).map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} ({formatCOP(inv.unit_price)})
                  </option>
                ))}
              </select>
            </div>

            {selectedInverters.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                {systemType === 'bombeo'
                  ? 'No hay variador de frecuencia solar seleccionado. Elige uno del selector superior o pulsa en una de las potencias de bomba arriba.'
                  : 'No hay inversores agregados. Selecciona un inversor del selector superior.'}
              </div>
            ) : (
              <div className="space-y-2">
                {selectedInverters.map(inv => (
                  <div key={inv.productId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-800">{inv.name}</div>
                      <div className="text-[11px] text-slate-400">{formatCOP(inv.price)} c/u</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">Cant:</span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={inv.qty}
                          onChange={(e) => updateInverterQty(inv.productId, e.target.value)}
                          className="w-14 px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-center"
                        />
                      </div>

                      <div className="text-xs font-bold text-slate-900 w-24 text-right">
                        {formatCOP(inv.qty * inv.price)}
                      </div>

                      <button
                        onClick={() => removeInverter(inv.productId)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Batteries (Shown for Hybrid & Off-grid) */}
          {(systemType === 'hibrido' || systemType === 'offgrid') && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <BatteryCharging className="w-5 h-5 text-emerald-500" />
                  Banco de Baterías de Litio / Gel
                </h2>

                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addBattery(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>+ Agregar batería...</option>
                  {availableBatteries.map(bat => (
                    <option key={bat.id} value={bat.id}>
                      {bat.name} ({formatCOP(bat.unit_price)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBatteries.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                  No hay baterías seleccionadas. Agrega una batería para el sistema {systemType === 'hibrido' ? 'híbrido' : 'aislado'}.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedBatteries.map(bat => (
                    <div key={bat.productId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-800">{bat.name}</div>
                        <div className="text-[11px] text-slate-400">{bat.voltage} &bull; {bat.ah} Ah &bull; {formatCOP(bat.price)} c/u</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">Cant:</span>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={bat.qty}
                            onChange={(e) => updateBatteryQty(bat.productId, e.target.value)}
                            className="w-14 px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-center"
                          />
                        </div>

                        <div className="text-xs font-bold text-slate-900 w-24 text-right">
                          {formatCOP(bat.qty * bat.price)}
                        </div>

                        <button
                          onClick={() => removeBattery(bat.productId)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section: Bombeo Solar Equipment (Optional Submersible Pump Supply) */}
          {systemType === 'bombeo' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-cyan-600" />
                    Suministro de Bomba Sumergible y Sensores (Opcional)
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    El variador solar ya fue seleccionado en el Paso 3. Si la cotización incluye la venta física de la bomba sumergible o sensores de pozo, agrégalos aquí:
                  </p>
                </div>

                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addPump(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer self-start sm:self-auto shrink-0"
                  defaultValue=""
                >
                  <option value="" disabled>+ Incluir bomba / sensor...</option>
                  {availablePumps.map(pmp => (
                    <option key={pmp.id} value={pmp.id}>
                      {pmp.name} ({formatCOP(pmp.unit_price)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPumps.length === 0 ? (
                <div className="p-3.5 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-slate-50/50">
                  No se incluye bomba física en el presupuesto (el cliente utilizará su bomba sumergible existente en el pozo).
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedPumps.map(pmp => (
                    <div key={pmp.productId} className="flex items-center justify-between p-3 rounded-xl bg-cyan-50/30 border border-cyan-200/60">
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-800">{pmp.name}</div>
                        <div className="text-[11px] text-slate-400">{formatCOP(pmp.price)} c/u</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">Cant:</span>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={pmp.qty}
                            onChange={(e) => updatePumpQty(pmp.productId, e.target.value)}
                            className="w-14 px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-center"
                          />
                        </div>

                        <div className="text-xs font-bold text-cyan-900 w-24 text-right">
                          {formatCOP(pmp.qty * pmp.price)}
                        </div>

                        <button
                          onClick={() => removePump(pmp.productId)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section: Structures and Labor */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center">4</span>
              Estructura de Montaje, Mano de Obra y Accesorios
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Estructura
                </label>
                <select
                  value={structureType}
                  onChange={handleStructureTypeChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-semibold text-slate-800"
                >
                  {availableStructures.length > 0 ? (
                    availableStructures.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Estructura de aluminio sobre tejado">Estructura de aluminio sobre tejado</option>
                      <option value="Estructura en acero a piso">Estructura en acero a piso</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Costo Estructura por Panel (COP)
                </label>
                <input
                  type="number"
                  step="10000"
                  value={structureUnitPrice}
                  onChange={(e) => setStructureUnitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                {systemType === 'bombeo' && (
                  <p className="text-[10px] text-cyan-700 font-bold mt-1">
                    Sugerido Bombeo: {currentPanel?.power_w < 700 ? '$380.000 (<700W)' : '$450.000 (≥700W)'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tarifa Mano de Obra por kWp (COP)
                </label>
                <input
                  type="number"
                  step="20000"
                  value={mdoUnitPrice}
                  onChange={(e) => setMdoUnitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Caja AC y Protecciones (COP)
                </label>
                <input
                  type="number"
                  step="100000"
                  value={cajaAcPrice}
                  onChange={(e) => setCajaAcPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  Sugerido base: $2.500.000 COP
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Accesorios y Cableado Solar (COP) &bull; Modificable
                </label>
                <input
                  type="number"
                  step="100000"
                  value={accessoriesPrice}
                  onChange={(e) => setAccessoriesPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-semibold text-slate-900"
                  placeholder="Ej. 3000000"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Incluye cable solar fotovoltaico, conectores MC4, protecciones DC, tubería y canalización.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Notes & Commercial Conditions */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
              Notas y Observaciones de la Cotización
            </h2>
            <textarea
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles sobre orientación del techo, condiciones de entrega, garantía solicitada..."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Right Column (5 cols): Real-Time Budget & Financial Simulator */}
        <div className="lg:col-span-5 space-y-6 sticky top-20">
          {/* Presupuesto Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" />
                Presupuesto Desglosado
              </h3>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {quoteCalculation.installedPowerKwp} kWp
              </span>
            </div>

            {/* Breakdown Table */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">MANO DE OBRA ({quoteCalculation.installedPowerKwp} kWp @ {formatCOP(mdoUnitPrice)}):</span>
                <span className="font-bold text-slate-900">{formatCOP(quoteCalculation.mdoTotal)}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">ESTRUCTURA ({quoteCalculation.installedPanels} paneles @ {formatCOP(structureUnitPrice)}):</span>
                <span className="font-bold text-slate-900">{formatCOP(quoteCalculation.structureTotal)}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">PANELES ({quoteCalculation.installedPanels} un @ {formatCOP(currentPanel?.unit_price)}):</span>
                <span className="font-bold text-slate-900">{formatCOP(quoteCalculation.panelsTotal)}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">
                  {systemType === 'bombeo' ? 'VARIADOR SOLAR' : 'INVERSORES'} ({selectedInverters.reduce((a,b)=>a+b.qty, 0)} un):
                </span>
                <span className="font-bold text-slate-900">{formatCOP(quoteCalculation.invertersTotal)}</span>
              </div>

              {(systemType === 'hibrido' || systemType === 'offgrid') && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">BATERÍAS ({selectedBatteries.reduce((a,b)=>a+b.qty, 0)} un):</span>
                  <span className="font-bold text-emerald-700">{formatCOP(quoteCalculation.batteriesTotal)}</span>
                </div>
              )}

              {systemType === 'bombeo' && selectedPumps.length > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">BOMBA SUMERGIBLE ({selectedPumps.reduce((a,b)=>a+b.qty, 0)} un):</span>
                  <span className="font-bold text-cyan-700">{formatCOP(quoteCalculation.pumpsTotal)}</span>
                </div>
              )}

              {/* Legalization Row with toggle */}
              {(systemType === 'ongrid' || systemType === 'hibrido') && (
                <div className="py-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={legalizationIncluded}
                        onChange={(e) => setLegalizationIncluded(e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      <span>LEGALIZACIÓN & RETIE:</span>
                    </label>
                    <span>{formatCOP(quoteCalculation.legalizationTotal)}</span>
                  </div>

                  {legalizationIncluded && (
                    <div className="pl-5 space-y-1 text-[11px] text-slate-500">
                      <div className="flex justify-between">
                        <span>• Diseño Ingeniería ({quoteCalculation.installedPowerKwp <= 11 ? 'Hasta 11 kW' : quoteCalculation.installedPowerKwp <= 30 ? '11-30 kW' : '31-60 kW'}):</span>
                        <span>{formatCOP(quoteCalculation.designPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Trámite Operador de Red:</span>
                        <span>{formatCOP(quoteCalculation.tramitePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Contador Bidireccional:</span>
                        <span>{formatCOP(quoteCalculation.bidiPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Certificación RETIE:</span>
                        <span>{formatCOP(quoteCalculation.retieCertPrice)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {systemType !== 'bombeo' && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">CAJA AC & PROTECCIONES:</span>
                  <span className="font-bold text-slate-900">{formatCOP(quoteCalculation.cajaAcPrice)}</span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">ACCESORIOS & CABLEADO:</span>
                <span className="font-bold text-slate-900">{formatCOP(quoteCalculation.accessoriesPrice)}</span>
              </div>

              {/* Discount */}
              <div className="flex items-center justify-between py-1 text-slate-700">
                <div className="flex items-center gap-1">
                  <span>Descuento Comercial:</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="w-12 px-1 py-0.5 border rounded text-center text-xs font-bold"
                  />
                  <span>%</span>
                </div>
                <span className="font-bold text-rose-600">
                  -{formatCOP(quoteCalculation.discountAmount)}
                </span>
              </div>

              {/* Total Banner */}
              <div className="mt-4 p-4 rounded-2xl bg-slate-950 text-white flex items-center justify-between shadow-md">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    TOTAL PRESUPUESTO
                  </span>
                  <span className="text-xs text-amber-400">IVA incluido (Exento según Ley 1715)</span>
                </div>
                <div className="text-2xl font-black text-amber-400">
                  {formatCOP(quoteCalculation.totalPrice)}
                </div>
              </div>
            </div>
          </div>

          {/* Financing Simulation Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Simulador de Financiación
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Cuota Inicial (%):</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="90"
                    step="5"
                    value={financingDownPaymentPercent}
                    onChange={(e) => setFinancingDownPaymentPercent(e.target.value)}
                    className="w-14 px-2 py-1 border rounded-lg text-center font-bold"
                  />
                  <span className="text-slate-700 font-bold w-24 text-right">
                    {formatCOP(quoteCalculation.financingDownPaymentAmount)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">Saldo a Financiar:</span>
                <span className="font-bold text-slate-900">
                  {formatCOP(quoteCalculation.financingAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">Plazo (meses):</span>
                <select
                  value={financingTermMonths}
                  onChange={(e) => setFinancingTermMonths(parseInt(e.target.value))}
                  className="px-2.5 py-1 border rounded-lg font-bold text-slate-800"
                >
                  <option value="12">12 meses (1 año)</option>
                  <option value="24">24 meses (2 años)</option>
                  <option value="36">36 meses (3 años)</option>
                  <option value="48">48 meses (4 años)</option>
                  <option value="60">60 meses (5 años)</option>
                  <option value="72">72 meses (6 años)</option>
                </select>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">Tasa de Interés (% M.V.):</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.05"
                    value={monthlyInterestRatePercent}
                    onChange={(e) => setMonthlyInterestRatePercent(e.target.value)}
                    className="w-16 px-2 py-1 border rounded-lg text-center font-bold text-slate-800 bg-amber-50/40 border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-slate-600 font-bold">%</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Valor Cuota Mensual Estimada
                  </span>
                  <span className="text-[10px] text-slate-400">Tasa aplicada: {monthlyInterestRatePercent}% M.V.</span>
                </div>
                <div className="text-lg font-black text-emerald-600">
                  {formatCOP(quoteCalculation.financingMonthlyFee)} / mes
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleSaveQuote}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5" />
            <span>{saving ? 'Guardando...' : editingQuote ? 'Guardar Cambios en Cotización' : 'Generar Propuesta y Programar'}</span>
          </button>
        </div>
      </div>

      {/* Modal: Quick Add Client */}
      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title="Registrar Nuevo Cliente"
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre Completo o Razón Social <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newClientData.name}
                onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-sm"
                placeholder="Ej. Roberto Gómez Saldarriaga"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tipo Doc</label>
              <select
                value={newClientData.doc_type}
                onChange={(e) => setNewClientData({ ...newClientData, doc_type: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-sm"
              >
                <option value="CC">Cédula (CC)</option>
                <option value="NIT">NIT Empresa</option>
                <option value="CE">Cédula Extranjería</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Número Documento</label>
              <input
                type="text"
                value={newClientData.doc_number}
                onChange={(e) => setNewClientData({ ...newClientData, doc_number: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-sm"
                placeholder="71.234.567"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
              <input
                type="tel"
                value={newClientData.phone}
                onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-sm"
                placeholder="3124567890"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={newClientData.email}
                onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-sm"
                placeholder="cliente@gmail.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ciudad / Municipio</label>
              <input
                type="text"
                value={newClientData.city}
                onChange={(e) => setNewClientData({ ...newClientData, city: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-sm"
                placeholder="Villavicencio"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Operador de Red</label>
              <input
                type="text"
                value={newClientData.operator}
                onChange={(e) => setNewClientData({ ...newClientData, operator: e.target.value })}
                className="w-full px-3.5 py-2 border rounded-xl text-sm"
                placeholder="Afinia, Air-e, Celsia, EPM..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsClientModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-xl shadow"
            >
              Guardar Cliente
            </button>
          </div>
        </form>
      </Modal>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 shadow-2xl transition-colors no-print">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block truncate">
              Total ({formatKW(quoteCalculation.installedPowerKwp)})
            </span>
            <span className="text-base font-black text-[#2d8a58] dark:text-[#48bb78] block truncate">
              {formatCOP(quoteCalculation.totalPrice)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSaveQuote}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] active:scale-95 text-white font-bold text-xs shadow-md shadow-[#2d8a58]/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : editingQuote ? 'Guardar' : 'Guardar Cotización'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
