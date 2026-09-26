import bcrypt from 'bcryptjs';
import { db, initDatabase } from './db.js';

export function seed() {
  initDatabase();

  console.log('Seeding initial data...');

  // 1. Seed Users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const salt = bcrypt.genSaltSync(10);
  const passAnuar = bcrypt.hashSync('anuar316791', salt);
  const passAsesor = bcrypt.hashSync('asesor123', salt);
  const passTecnico = bcrypt.hashSync('tecnico123', salt);

  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (name, username, email, password, role, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    insertUser.run('Anuar David', 'anuardavid', 'anuardavid@hotmail.com', passAnuar, 'admin');
    insertUser.run('Administrador General', 'admin', 'admin@solar.com', passAnuar, 'admin');
    insertUser.run('Asesor Comercial', 'comercial', 'comercial@solar.com', passAsesor, 'asesor');
    insertUser.run('Ingeniero Técnico Solar', 'tecnico', 'tecnico@solar.com', passTecnico, 'tecnico');
    console.log('Users seeded with usernames.');
  }

  // Ensure default admin anuardavid exists with requested password anuar316791
  try {
    const anuar = db.prepare("SELECT id, username FROM users WHERE username IN ('anuar', 'anuardavid') OR email = 'anuardavid@hotmail.com'").get();
    if (!anuar) {
      db.prepare('INSERT INTO users (name, username, email, password, role, active) VALUES (?, ?, ?, ?, ?, 1)')
        .run('Anuar David', 'anuardavid', 'anuardavid@hotmail.com', passAnuar, 'admin');
    } else {
      db.prepare("UPDATE users SET username = 'anuardavid', password = ?, role = 'admin', active = 1 WHERE id = ?")
        .run(passAnuar, anuar.id);
    }
  } catch (e) {
    console.warn('Error configuring admin user anuardavid:', e.message);
  }

  // 2. Seed RETIE Design Tiers
  const tierCount = db.prepare('SELECT COUNT(*) as count FROM retie_design_tiers').get().count;
  if (tierCount === 0) {
    const insertTier = db.prepare(`
      INSERT INTO retie_design_tiers (min_kw, max_kw, name, price)
      VALUES (?, ?, ?, ?)
    `);

    insertTier.run(0, 11, 'DISEÑO HASTA 11 kW', 1915900);
    insertTier.run(11.01, 30, 'DISEÑO 11-30 kW', 2490670);
    insertTier.run(30.01, 60, 'DISEÑO 31-60 kW', 3448620);
    insertTier.run(60.01, 99, 'DISEÑO 60-99 kW', 5747700);
    insertTier.run(99.01, 250, 'DISEÑO 99-250 kW', 9350000);
    console.log('RETIE design tiers seeded.');
  }

  // 3. Seed Products
  const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (prodCount === 0) {
    const insertProd = db.prepare(`
      INSERT INTO products (category, name, brand, model, power_w, voltage, capacity_ah, system_type, unit_price, cost_price, unit, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Paneles Solares
    insertProd.run('paneles', 'Panel Solar 720W Monocristalino Tier 1', 'Jinko / Longi', '720W Bifacial/Mono', 720, '48V', 0, 'all', 470000, 390000, 'panel', 'Panel de ultra alta eficiencia de 720 Wp con garantía de 25 años de producción lineal.');
    insertProd.run('paneles', 'Panel Solar 720W Premium Ultra', 'Canadian Solar', 'CS7N-720MS', 720, '48V', 0, 'all', 520000, 440000, 'panel', 'Panel solar de 720W alta resistencia climática y máxima captación.');
    insertProd.run('paneles', 'Panel Solar 550W Monocristalino Half-Cell', 'JA Solar', 'JAM72S30-550', 550, '48V', 0, 'all', 380000, 310000, 'panel', 'Panel estándar para cubiertas residenciales y comerciales.');
    insertProd.run('paneles', 'Panel Solar 600W Monocristalino', 'Trina Solar', 'Vertex TSM-600', 600, '48V', 0, 'all', 430000, 350000, 'panel', 'Panel solar de 600W de alto rendimiento.');

    // Inversores (from user sheets)
    insertProd.run('inversores', 'SRNE HIBRIDO 12K', 'SRNE', 'HES-12000-48', 12000, '220V/48V', 0, 'hybrid', 9750000, 8100000, 'unidad', 'Inversor cargador híbrido de 12 kW con controlador MPPT dual y soporte de baterías de litio.');
    insertProd.run('inversores', 'SRNE HIBRIDO 8K', 'SRNE', 'HES-8000-48', 8000, '220V/48V', 0, 'hybrid', 9000000, 7500000, 'unidad', 'Inversor híbrido de 8 kW de alta fiabilidad.');
    insertProd.run('inversores', 'SRNE HIBRIDO 6K', 'SRNE', 'HES-6000-48', 6000, '220V/48V', 0, 'hybrid', 7500000, 6200000, 'unidad', 'Inversor híbrido residencial de 6 kW.');
    insertProd.run('inversores', 'SRNE OFF GRID 5K', 'SRNE', 'HF4850S80', 5000, '120V/220V/48V', 0, 'offgrid', 4750000, 3900000, 'unidad', 'Inversor cargador aislado para fincas y zonas no interconectadas de 5 kW.');
    insertProd.run('inversores', 'SRNE TRIFASICO 18KW', 'SRNE', 'TP-18K-48', 18000, '220V/380V', 0, 'ongrid', 21900000, 18500000, 'unidad', 'Inversor trifásico para proyectos comerciales e industriales de 18 kW.');
    insertProd.run('inversores', 'SOLIS 16KW BIFASICO', 'Solis', 'S5-GR1P16K', 16000, '240V Bifásico', 0, 'ongrid', 9750000, 8200000, 'unidad', 'Inversor de red bifásico Solis de 16 kW con monitoreo WiFi.');
    insertProd.run('inversores', 'HUAWEI SUN2000-6KTL', 'Huawei', 'SUN2000-6KTL-L1', 6000, '220V/240V', 0, 'ongrid', 4037500, 3350000, 'unidad', 'Inversor inteligente Huawei de 6 kW, compatible con optimizadores.');
    insertProd.run('inversores', 'HUAWEI SUN2000-10KTL', 'Huawei', 'SUN2000-10KTL-M1', 10000, '220V Trifásico', 0, 'ongrid', 5680000, 4800000, 'unidad', 'Inversor de red trifásico Huawei de 10 kW.');
    insertProd.run('inversores', 'GROWATT 10K MIN', 'Growatt', 'MIN 10000TL-X', 10000, '220V Bifásico', 0, 'ongrid', 5200000, 4300000, 'unidad', 'Inversor de conexión a red de 10 kW.');

    // Baterías (from user sheets)
    insertProd.run('baterias', 'Litio 100 ah 48V SRNE', 'SRNE', 'LP-48100', 4800, '48V', 100, 'hybrid', 6500000, 5200000, 'unidad', 'Batería de fosfato de hierro y litio (LiFePO4) 48V 100Ah (4.8 kWh) con BMS inteligente.');
    insertProd.run('baterias', 'Litio 200 ah 48V SRNE', 'SRNE', 'LP-48200', 9600, '48V', 200, 'hybrid', 8500000, 7100000, 'unidad', 'Batería LiFePO4 48V 200Ah (9.6 kWh) más de 6000 ciclos de vida.');
    insertProd.run('baterias', 'Litio 300 ah 48V SRNE', 'SRNE', 'LP-48300', 14400, '48V', 300, 'hybrid', 10700000, 8900000, 'unidad', 'Batería LiFePO4 48V 300Ah (14.4 kWh) para alta autonomía.');
    insertProd.run('baterias', 'Litio 100 ah 24v Green P', 'Green P', 'GP-24100', 2400, '24V', 100, 'offgrid', 2100000, 1650000, 'unidad', 'Batería de litio compacta 24V 100Ah para sistemas solares pequeños y medianos.');
    insertProd.run('baterias', 'Litio 120 ah 24v Green P', 'Green P', 'GP-24120', 2880, '24V', 120, 'offgrid', 2380000, 1890000, 'unidad', 'Batería de litio 24V 120Ah ciclo profundo.');
    insertProd.run('baterias', 'BATERIA 100 AH 5KW 48 V', 'PowerTech', 'PT-48100-WALL', 5120, '48V', 100, 'hybrid', 4165000, 3300000, 'unidad', 'Batería de pared tipo Powerwall 48V 100Ah 5.12 kWh.');

    // Bombeo Solar
    insertProd.run('bombas', 'Bomba Solar Sumergible 2 HP 220V', 'AquaSolar', 'SP-2HP-30M', 1500, '220V AC', 0, 'bombeo', 3200000, 2400000, 'unidad', 'Bomba sumergible en acero inoxidable para pozos profundos de hasta 70 metros de profundidad.');
    insertProd.run('bombas', 'Bomba Solar Sumergible 3 HP 220V/380V', 'AquaSolar', 'SP-3HP-50M', 2200, '220V/380V', 0, 'bombeo', 4500000, 3600000, 'unidad', 'Bomba solar de alto caudal para riego agrícola y ganadería.');
    // Variadores de Frecuencia Solar
    insertProd.run('variadores', 'Variador de Frecuencia Solar 1 HP (0.75 kW)', 'INVT / Veichi', 'VFD-SOLAR-1HP', 750, '220V AC', 0, 'bombeo', 2000000, 1400000, 'unidad', 'Variador de frecuencia solar MPPT para bomba de agua de 1 HP (0.75 kW). Permite arranque suave y operación directa con paneles solares.');
    insertProd.run('variadores', 'Variador de Frecuencia Solar 2 HP (1.5 kW)', 'INVT / Veichi', 'VFD-SOLAR-2HP', 1500, '220V AC', 0, 'bombeo', 2000000, 1400000, 'unidad', 'Variador de frecuencia solar MPPT para bomba de agua de 2 HP (1.5 kW). Control automático de presión y caudal con radiación solar.');
    insertProd.run('variadores', 'Variador de Frecuencia Solar 3 HP (2.2 kW)', 'INVT / Veichi', 'VFD-SOLAR-3HP', 2200, '220V AC', 0, 'bombeo', 2000000, 1400000, 'unidad', 'Variador de frecuencia solar MPPT para bomba de agua de 3 HP (2.2 kW). Protección por pozo seco y sobretensión.');
    insertProd.run('variadores', 'Variador de Frecuencia Solar 5 HP (3.7 kW)', 'INVT / Veichi', 'VFD-SOLAR-5HP', 3700, '220V/380V', 0, 'bombeo', 2000000, 1400000, 'unidad', 'Variador de frecuencia solar MPPT para bomba de agua de 5 HP (3.7 kW). Alto rendimiento para riego tecnificado y ganadería.');
    insertProd.run('variadores', 'Variador de Frecuencia Solar 7.5 HP (5.5 kW)', 'INVT / Veichi', 'VFD-SOLAR-7.5HP', 5500, '220V/380V', 0, 'bombeo', 2000000, 1400000, 'unidad', 'Variador de frecuencia solar MPPT para bomba de agua de 7.5 HP (5.5 kW). Control trifásico industrial.');
    insertProd.run('variadores', 'Variador de Frecuencia Solar 10 HP (7.5 kW)', 'INVT / Veichi', 'VFD-SOLAR-10HP', 7500, '220V/380V', 0, 'bombeo', 2000000, 1400000, 'unidad', 'Variador de frecuencia solar MPPT para bomba de agua de 10 HP (7.5 kW). Para pozos de gran profundidad y caudal.');
    insertProd.run('variadores', 'Variador de Frecuencia Solar 15 HP (11 kW)', 'INVT / Veichi', 'VFD-SOLAR-15HP', 11000, '380V/440V', 0, 'bombeo', 2000000, 1400000, 'unidad', 'Variador de frecuencia solar MPPT para bomba de agua de 15 HP (11 kW). Operación continua para proyectos agrícolas a gran escala.');


    // Estructuras
    insertProd.run('estructuras', 'Estructura de aluminio sobre tejado', 'SolarFix', 'SF-ROOF-ALU', 0, '', 0, 'all', 280000, 190000, 'panel', 'Estructura coplanar en aluminio para instalación sobre cubierta / tejado.');
    insertProd.run('estructuras', 'Estructura en acero a piso', 'SolarFix', 'SF-GROUND-STEEL', 0, '', 0, 'all', 380000, 270000, 'panel', 'Estructura reforzada en acero galvanizado para montaje sobre suelo / piso.');

    // Mano de Obra y Servicios
    insertProd.run('mdo', 'Mano de Obra Instalación y Montaje Certificado', 'Servicio', 'MDO-KWP', 0, '', 0, 'all', 400000, 250000, 'kWp', 'Instalación mecánica, eléctrica DC/AC, puesta en marcha y pruebas bajo norma RETIE.');

    // Legalización & RETIE
    insertProd.run('legalizacion', 'Trámite Operador de Red', 'Trámite', 'TRAM-OR', 0, '', 0, 'ongrid', 1400000, 800000, 'global', 'Gestión completa de punto de conexión, factibilidad y dictamen de conexión.');
    insertProd.run('legalizacion', 'Medidor Bidireccional Homologado', 'Equipos', 'MED-BIDI', 0, '', 0, 'ongrid', 1890000, 1350000, 'unidad', 'Contador bidireccional electrónico homologado con protocolo de calibración y sellos.');
    insertProd.run('legalizacion', 'Certificación RETIE Organismo Inspección', 'Certificación', 'CERT-RETIE', 0, '', 0, 'ongrid', 3820000, 2900000, 'global', 'Dictamen técnico por organismo de inspección ONAC acreditado.');

    // Accesorios
    insertProd.run('accesorios', 'Caja AC y Protecciones Bifásica/Trifásica', 'Schneider / ABB', 'BOX-AC-PROT', 0, '', 0, 'all', 2000000, 1400000, 'global', 'Tablero de protecciones AC con breaker, DPS Tipo II y caja IP65.');
    insertProd.run('accesorios', 'Accesorios de Conexión, Cable Solar y Bandejas', 'Varios', 'ACC-SOLAR-SET', 0, '', 0, 'all', 5000000, 3600000, 'global', 'Cable solar 4mm/6mm con protección UV, conectores MC4, tubería EMT y puestas a tierra.');
    insertProd.run('accesorios', 'Accesorios Conexión Básica', 'Varios', 'ACC-BASIC', 0, '', 0, 'all', 3000000, 2100000, 'global', 'Kit de accesorios y protecciones para sistemas compactos.');

    console.log('Products seeded.');
  }

  // 4. Seed Initial Settings
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM company_settings').get().count;
  if (settingsCount === 0) {
    db.prepare(`
      INSERT INTO company_settings (id, company_name, nit, phone, email, address, website, demo_data_seeded)
      VALUES (1, 'SOLAR ENERGY COLOMBIA SAS', '901.234.567-8', '+57 310 456 7890', 'ventas@solarenergy.co', 'Calle 100 # 15-20 Oficina 402, Bogotá D.C.', 'www.solarenergy.co', 0)
    `).run();
    console.log('Company settings seeded.');
  }

  // 5. Permanent protection: Never seed demo data (production clients & quotes only)
  try {
    db.prepare('UPDATE company_settings SET demo_data_seeded = 1 WHERE id = 1').run();
  } catch (e) {}

  console.log('Seeding complete: Real business data preserved. Demo seeding disabled.');
}

// If executed directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed();
}
