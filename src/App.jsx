import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { PWAProvider } from './context/PWAContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import MobileDrawer from './components/MobileDrawer';
import Notification from './components/Notification';
import PWAInstallBanner from './components/PWAInstallBanner';
import ErrorBoundary from './components/ErrorBoundary';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cotizador from './pages/Cotizador';
import CotizacionesList from './pages/CotizacionesList';
import CotizacionView from './pages/CotizacionView';
import Clientes from './pages/Clientes';
import Seguimiento from './pages/Seguimiento';
import Productos from './pages/Productos';
import Usuarios from './pages/Usuarios';
import Visitas from './pages/Visitas';
import ContratosList from './pages/ContratosList';
import ContratoEditor from './pages/ContratoEditor';
import ContratoView from './pages/ContratoView';
import Legalizaciones from './pages/Legalizaciones';
import ProgramacionTrabajos from './pages/ProgramacionTrabajos';

function ProtectedLayout({ children, pendingStats, onStatsUpdate }) {
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-['Plus_Jakarta_Sans',sans-serif] transition-colors duration-200">
      <Sidebar pendingCounts={pendingStats} />
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        pendingCounts={pendingStats}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Navbar
          pendingStats={pendingStats}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
        />
        <main className="flex-1 p-3 sm:p-6 md:p-8 pb-24 md:pb-8">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        <BottomNav
          pendingStats={pendingStats}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
        />
      </div>
    </div>
  );
}

function AppRoutes() {
  const {
    user,
    authFetch,
    isAdmin,
    hasPermission,
    canViewDashboard,
    canViewVisits,
    canViewJobs,
    canQuote,
    canViewClients,
    canViewCRM,
    canViewContracts,
    canManageLegalizations,
    canViewProducts,
    canManageUsers,
    defaultRoute
  } = useAuth();
  const [notification, setNotification] = useState(null);
  const [pendingStats, setPendingStats] = useState({
    today_count: 0,
    overdue_count: 0,
    pending_visits_to_quote_count: 0,
    scheduled_visits_count: 0,
    pending_contracts_count: 0,
    overdue_jobs_count: 0,
    today_jobs_count: 0
  });

  const notify = ({ type = 'info', message }) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // Poll / refresh pending stats periodically
  const refreshStats = async () => {
    if (!user) return;
    try {
      const res = await authFetch('/api/settings/dashboard-stats');
      if (res.ok) {
        const data = await res.json();
        setPendingStats({
          today_count: data.pending_today_count || 0,
          overdue_count: data.overdue_count || 0,
          pending_visits_to_quote_count: data.pending_visits_to_quote_count || 0,
          scheduled_visits_count: data.scheduled_visits_count || 0,
          overdue_visits_count: data.overdue_visits_count || 0,
          today_visits_count: data.today_visits_count || 0,
          pending_contracts_count: data.pending_contracts_count || 0,
          overdue_jobs_count: data.overdue_jobs_count || 0,
          today_jobs_count: data.today_jobs_count || 0
        });
      }
    } catch (e) {
      // ignore silently
    }
  };

  useEffect(() => {
    if (user) {
      refreshStats();
    }
  }, [user]);

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={defaultRoute} replace /> : <Login />} />

        <Route
          path="/"
          element={
            canViewDashboard ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <Dashboard onStatsUpdate={setPendingStats} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/visitas"
          element={
            canViewVisits ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <Visitas onNotify={notify} onStatsUpdate={setPendingStats} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/cotizador"
          element={
            canQuote ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <Cotizador onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/cotizaciones"
          element={
            canQuote ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <CotizacionesList onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/cotizacion/:id"
          element={
            (canQuote || canViewContracts || canViewCRM || canViewVisits) ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <CotizacionView onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/clientes"
          element={
            canViewClients ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <Clientes onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/seguimiento"
          element={
            canViewCRM ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <Seguimiento onNotify={notify} onStatsUpdate={setPendingStats} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/productos"
          element={
            canViewProducts ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <Productos onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/usuarios"
          element={
            canManageUsers ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <Usuarios onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/legalizaciones"
          element={
            canManageLegalizations ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <Legalizaciones onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/trabajos"
          element={
            canViewJobs ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <ProgramacionTrabajos onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/contratos"
          element={
            canViewContracts ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <ContratosList onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/contrato/nuevo"
          element={
            canViewContracts ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <ContratoEditor onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/contrato/nuevo/:quoteId"
          element={
            canViewContracts ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <ContratoEditor onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/contrato/editar/:id"
          element={
            canViewContracts ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <ContratoEditor onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route
          path="/contrato/:id"
          element={
            canViewContracts ? (
              <ProtectedLayout pendingStats={pendingStats} onStatsUpdate={setPendingStats}>
                <ContratoView onNotify={notify} />
              </ProtectedLayout>
            ) : (
              <Navigate to={defaultRoute} replace />
            )
          }
        />

        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>

      <PWAInstallBanner />

      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PWAProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ThemeProvider>
      </PWAProvider>
    </BrowserRouter>
  );
}
