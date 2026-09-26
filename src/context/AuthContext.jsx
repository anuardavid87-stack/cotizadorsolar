import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('solar_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn('Error parsing solar_user from localStorage:', e);
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('solar_token') || '';
    } catch (e) {
      return '';
    }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      if (user && token) {
        localStorage.setItem('solar_user', JSON.stringify(user));
        localStorage.setItem('solar_token', token);
      } else {
        localStorage.removeItem('solar_user');
        localStorage.removeItem('solar_token');
      }
    } catch (e) {
      console.warn('Error saving auth to localStorage:', e);
    }
  }, [user, token]);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${token}`
    };
    const targetUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const res = await fetch(targetUrl, { ...options, headers });
    if (res.status === 401) {
      logout();
      throw new Error('Sesión expirada. Por favor ingresa de nuevo.');
    }
    return res;
  };

  // Sync latest permissions and user data from server on startup/token change
  useEffect(() => {
    if (token) {
      authFetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user) {
            setUser((prev) => ({
              ...prev,
              ...data.user,
              permissions: data.user.permissions || prev?.permissions || []
            }));
          }
        })
        .catch(() => {});
    }
  }, [token]);

  const login = async (identifier, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier, email: identifier, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }
      setUser(data.user);
      setToken(data.token);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken('');
    try {
      localStorage.removeItem('solar_user');
      localStorage.removeItem('solar_token');
    } catch (e) {}
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const next = { ...prev, ...updatedFields };
      try {
        localStorage.setItem('solar_user', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const role = (user?.role || 'asesor').toLowerCase();
  const isAdmin = role === 'admin';
  const isAdvisor = role === 'asesor';
  const isComercial = role === 'comercial';
  const isSeller = isComercial;
  const isEngineer = role === 'ingeniero';
  const isTechnician = role === 'tecnico' || role === 'ingeniero';
  const isCommercial = isAdmin || isAdvisor;

  const hasPermission = (permKey) => {
    if (isAdmin) return true;
    if (user?.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
      return user.permissions.includes(permKey);
    }
    // Fallback checks if permissions array is not yet loaded or empty
    if (isAdvisor) {
      return ['dashboard', 'visits', 'quotes', 'clients', 'crm', 'contracts', 'products', 'users', 'jobs'].includes(permKey);
    }
    if (isEngineer) {
      return ['dashboard', 'visits', 'quotes', 'clients', 'legalizations', 'jobs'].includes(permKey);
    }
    if (isTechnician) {
      return ['visits', 'clients', 'legalizations', 'jobs'].includes(permKey);
    }
    if (isComercial || role === 'venta') {
      return ['clients', 'jobs'].includes(permKey);
    }
    return false;
  };

  const canViewDashboard = hasPermission('dashboard');
  const canViewVisits = hasPermission('visits');
  const canViewJobs = hasPermission('jobs');
  const canQuote = hasPermission('quotes');
  const canViewClients = hasPermission('clients');
  const canViewCRM = hasPermission('crm');
  const canViewContracts = hasPermission('contracts');
  const canManageLegalizations = hasPermission('legalizations');
  const canViewProducts = hasPermission('products');
  const canManageUsers = hasPermission('users');
  const canManageSettings = hasPermission('company_settings');
  const canManageLogs = hasPermission('logs');

  const defaultRoute = canViewDashboard ? "/" :
                       canViewVisits ? "/visitas" :
                       canViewClients ? "/clientes" :
                       canViewJobs ? "/trabajos" :
                       canQuote ? "/cotizaciones" :
                       canViewCRM ? "/seguimiento" :
                       canViewContracts ? "/contratos" :
                       canManageLegalizations ? "/legalizaciones" :
                       canViewProducts ? "/productos" : "/login";

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      updateUser,
      authFetch,
      role,
      isAdmin,
      isAdvisor,
      isComercial,
      isSeller,
      isEngineer,
      isTechnician,
      isCommercial,
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
      canManageSettings,
      canManageLogs,
      defaultRoute
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
