# SolarQuote Pro - Cotizador Solar & CRM Comercial

Sistema integral desarrollado para empresas instaladoras de energía solar fotovoltaica. Permite dimensionar y cotizar proyectos según fórmulas técnicas y comerciales exactas, gestionar clientes, llevar una bitácora de seguimiento didáctica (CRM) con calificación de interés del 1 al 10, y administrar inventario de productos y accesos de usuarios por roles.

---

## ☀️ Características Principales

### 1. Motor de Cotizaciones Multi-Sistema
- **1. Sistemas On-Grid (Conectados a red):** Proyección según consumo (kWh), cálculo de inversores de red (Huawei, Solis, Growatt, SRNE), estructura, mano de obra ($400.000/kWp), caja AC y legalización RETIE por escalas de potencia.
- **2. Sistemas On-Grid con Baterías (Híbridos):** Todo lo anterior + inversores híbridos + banco de baterías de litio (SRNE 48V 100Ah/200Ah/300Ah, Green P 24V, Powerwall) y protecciones DC adicionales.
- **3. Sistemas Off-Grid (Aislados):** Para fincas y zonas no interconectadas con inversores aislados y bancos de baterías.
- **4. Bombeo Solar:** Dimensionamiento con bombas sumergibles y variadores solares automáticos MPPT.
- **Ajuste Técnico en Tiempo Real:** El técnico puede modificar los paneles a instalar reales y recalcular al instante la potencia en kWp y el presupuesto.
- **Simulador Financiero:** Cuota inicial, plazo en meses y cuota mensual calculada con amortización francesa.

### 2. CRM de Seguimiento Didáctico y Amigable
- **Semáforo comercial:** Filtros rápidos para "🔔 Pendientes Hoy", "⚠️ Vencidos / Atrasados", "🔥 Clientes Calientes (Score 8 al 10)" y "⏳ Próximos 7 días".
- **Calificación de Interés (1 al 10):** Termómetro visual de temperatura comercial.
- **Bitácora de Interacciones:** Registro de llamadas, mensajes de WhatsApp, visitas y reuniones con comentarios detallados.
- **Acciones Rápidas:**
  - 📅 **Programar Nueva Fecha de Seguimiento**
  - 🛑 **Cliente Desiste (Archivar):** Registra el motivo (falta de presupuesto, competencia, etc.) y lo archiva para no saturar los pendientes activos.
  - 🏆 **Proyecto Ganado / Cerrado:** Convierte la cotización en proyecto aprobado.
  - 💬 **WhatsApp Directo:** Botón con mensaje comercial prellenado listo para enviar.

### 3. Propuesta Comercial Ejecutiva (Print / PDF)
- Membrete con logo de la empresa, NIT, teléfono y datos del cliente.
- Resumen técnico (kWp, paneles, inversores, generación mensual estimada y ahorro en $).
- Tabla detallada de costos y desglose presupuestal.
- Planes de pago (Contado vs Financiación).
- Garantías técnicas formales (25 años paneles, 10 años baterías, 5 años inversores).
- Firmas de aceptación del cliente y del asesor técnico.

### 4. Catálogo de Productos y Precios Parametrizable
- Paneles solares, Inversores, Baterías, Bombas, Estructuras, Mano de Obra, Legalización/RETIE y Accesorios.
- Modificación directa de precios de venta, costos y datos técnicos.
- Activación/desactivación de artículos en tiempo real.

### 5. Módulo Administrativo & Seguridad
- Usuarios del sistema con contraseñas seguras (bcrypt) y roles:
  - **Administrador:** Acceso completo, edición de precios y usuarios.
  - **Asesor Comercial:** Creación de clientes, cotizaciones y seguimiento CRM.
  - **Ingeniero Técnico:** Dimensionamiento técnico y consulta de catálogo.
- Configuración de la empresa y políticas de garantía.

---

## 🚀 Cómo Iniciar la Aplicación

### Opción 1: Con el archivo de inicio rápido (Recomendado)
Haz doble clic en el archivo `iniciar.bat`.

### Opción 2: Desde la terminal
```bash
cd C:\Users\anuar\.gemini\antigravity\scratch\cotizador-solar-pro
npm run dev
```

Esto iniciará:
- **API REST (Backend):** `http://localhost:3001`
- **Interfaz Web (Frontend):** `http://localhost:5173`

Abre tu navegador en: **`http://localhost:5173`**

---

## 🔑 Credenciales de Acceso Iniciales

| Rol | Correo Electrónico | Contraseña | Permisos |
|---|---|---|---|
| **Administrador** | `admin@solar.com` | `admin123` | Control total, usuarios y precios |
| **Asesor Comercial** | `comercial@solar.com` | `asesor123` | Cotizador, clientes y CRM |
| **Ingeniero Técnico** | `tecnico@solar.com` | `tecnico123` | Dimensionamiento y cotizaciones |

*(La pantalla de inicio de sesión incluye botones de acceso rápido de prueba para cambiar entre roles con un solo clic)*
