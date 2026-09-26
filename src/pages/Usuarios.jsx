import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  UserPlus,
  Lock,
  Mail,
  User,
  Building2,
  Save,
  CheckCircle2,
  KeyRound,
  Edit2,
  Trash2,
  AlertTriangle,
  Eye,
  EyeOff,
  Cloud,
  RefreshCw,
  Check,
  X,
  History,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  FileSpreadsheet,
  Users as UsersIcon,
  Activity,
  FileClock,
  Clock,
  ChevronLeft,
  ChevronRight,
  Terminal,
  ShieldAlert,
  Shield,
  Plus,
  CheckSquare,
  Square,
  Database,
  HardDrive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { getRoleBadgeInfo } from '../utils/formatters';

export default function Usuarios({ onNotify }) {
  const { authFetch, isAdmin, user, updateUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Backup State
  const [backupStatus, setBackupStatus] = useState(null);
  const [loadingBackupStatus, setLoadingBackupStatus] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingDb, setDownloadingDb] = useState(false);
  const [isForcingSync, setIsForcingSync] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (isAdmin && searchParams.get('tab')) ? searchParams.get('tab') : 'users';

  // Tab: 'users', 'roles', 'company', 'logs', or 'backup'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isAdmin && tab && ['users', 'roles', 'company', 'logs', 'backup'].includes(tab)) {
      setActiveTab(tab);
    } else if (!isAdmin) {
      setActiveTab('users');
    }
  }, [searchParams, isAdmin]);

  // Roles & Permissions State
  const [roles, setRoles] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    slug: '',
    description: '',
    permissions: []
  });
  const [savingRole, setSavingRole] = useState(false);

  // Modal User
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'asesor',
    active: 1
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Modal Delete User
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [reassignUserId, setReassignUserId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Dedicated Password Change Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [userForPassword, setUserForPassword] = useState(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Multi-Company State
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({
    company_name: '',
    nit: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    legal_rep_name: '',
    legal_rep_doc: '',
    bank_name: '',
    bank_account_type: 'Cuenta de Ahorros',
    bank_account_number: '',
    city: '',
    department: '',
    set_as_default: false
  });

  // Logs & History State
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsStats, setLogsStats] = useState({
    totalLogs: 0,
    todayLogs: 0,
    userEvents: 0,
    quoteEvents: 0,
    clientEvents: 0
  });
  const [availableModules, setAvailableModules] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilters, setLogFilters] = useState({
    search: '',
    module: 'all',
    action: 'all',
    user_id: 'all',
    date_range: 'all',
    page: 1,
    limit: 40
  });
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resUsers, resSettings, resCompanies] = await Promise.all([
        authFetch('/api/auth/users'),
        authFetch('/api/settings'),
        authFetch('/api/settings/companies')
      ]);

      const dataUsers = await resUsers.json();
      const dataSettings = await resSettings.json();
      const dataCompanies = await resCompanies.json();

      setUsers(dataUsers.users || []);
      setSettings(dataSettings.settings || {});
      const compList = dataCompanies.companies || [];
      setCompanies(compList);
      if (dataSettings.settings?.id) {
        setSelectedCompanyId(dataSettings.settings.id);
      } else if (compList.length > 0) {
        setSelectedCompanyId(compList[0].id);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await authFetch('/api/settings/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch (err) {
      console.error('Error loading companies:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const params = new URLSearchParams();
      if (logFilters.search) params.append('search', logFilters.search.trim());
      if (logFilters.module !== 'all') params.append('module', logFilters.module);
      if (logFilters.action !== 'all') params.append('action', logFilters.action);
      if (logFilters.user_id !== 'all') params.append('user_id', logFilters.user_id);
      if (logFilters.date_range !== 'all') params.append('date_range', logFilters.date_range);
      params.append('limit', logFilters.limit);
      params.append('offset', (logFilters.page - 1) * logFilters.limit);

      const res = await authFetch(`/api/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogsTotal(data.total || 0);
        if (data.stats) setLogsStats(data.stats);
        if (data.availableModules) setAvailableModules(data.availableModules);
        if (data.availableUsers) setAvailableUsers(data.availableUsers);
      }
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);
      const res = await authFetch('/api/roles');
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    } finally {
      setLoadingRoles(false);
    }
  };

  const fetchAvailablePermissions = async () => {
    try {
      const res = await authFetch('/api/roles/available-permissions');
      if (res.ok) {
        const data = await res.json();
        setAvailablePermissions(data.permissions || []);
      }
    } catch (err) {
      console.error('Error fetching available permissions:', err);
    }
  };

  const openCreateRoleModal = () => {
    setEditingRole(null);
    setRoleFormData({
      name: '',
      slug: '',
      description: '',
      permissions: ['dashboard', 'visits', 'quotes', 'clients']
    });
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (roleToEdit) => {
    setEditingRole(roleToEdit);
    setRoleFormData({
      name: roleToEdit.name || '',
      slug: roleToEdit.slug || '',
      description: roleToEdit.description || '',
      permissions: roleToEdit.permissions || []
    });
    setIsRoleModalOpen(true);
  };

  const toggleRolePermission = (permId) => {
    // Admin role mandatory permissions cannot be turned off
    if (editingRole?.slug === 'admin' && ['dashboard', 'users', 'company_settings', 'logs'].includes(permId)) {
      return;
    }

    setRoleFormData(prev => {
      const current = prev.permissions || [];
      const exists = current.includes(permId);
      return {
        ...prev,
        permissions: exists ? current.filter(p => p !== permId) : [...current, permId]
      };
    });
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleFormData.name.trim()) return;

    try {
      setSavingRole(true);
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(roleFormData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar rol');

      if (onNotify) onNotify({ type: 'success', message: data.message });
      setIsRoleModalOpen(false);
      fetchRoles();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (roleToDelete) => {
    if (roleToDelete.slug === 'admin') {
      if (onNotify) onNotify({ type: 'warning', message: 'El rol Administrador General es el rol principal del sistema y no puede eliminarse.' });
      return;
    }

    const promptMsg = roleToDelete.user_count > 0
      ? `¿Estás seguro de eliminar el rol "${roleToDelete.name}"? Los ${roleToDelete.user_count} usuario(s) asignados serán transferidos automáticamente al rol Comercial.`
      : `¿Estás seguro de eliminar el rol "${roleToDelete.name}"?`;

    if (!window.confirm(promptMsg)) {
      return;
    }

    try {
      const res = await authFetch(`/api/roles/${roleToDelete.id}?reassignTo=comercial`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar rol');

      if (onNotify) onNotify({ type: 'success', message: data.message });
      fetchRoles();
      fetchData();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    fetchData();
    fetchRoles();
    fetchAvailablePermissions();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'backup') {
      fetchBackupStatus();
    }
  }, [
    activeTab,
    logFilters.module,
    logFilters.action,
    logFilters.user_id,
    logFilters.date_range,
    logFilters.page
  ]);

  const fetchBackupStatus = async () => {
    try {
      setLoadingBackupStatus(true);
      const res = await authFetch('/api/backup/status');
      const data = await res.json();
      setBackupStatus(data);
    } catch (err) {
      console.warn('Error fetching backup status:', err);
    } finally {
      setLoadingBackupStatus(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setDownloadingExcel(true);
      const res = await authFetch('/api/backup/export-excel');
      if (!res.ok) throw new Error('Error al generar la copia de seguridad');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nowStr = new Date().toISOString().slice(0, 10);
      a.download = `COPIA_SEGURIDAD_RENOVA_SOLARTECH_${nowStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      if (onNotify) onNotify({ type: 'success', message: 'Copia de seguridad en Excel descargada con éxito (10 hojas).' });
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleDownloadDb = async () => {
    try {
      setDownloadingDb(true);
      const res = await authFetch('/api/backup/download-db');
      if (!res.ok) throw new Error('Error al descargar la base de datos');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const nowStr = new Date().toISOString().slice(0, 10);
      a.download = `solarquote_backup_${nowStr}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      if (onNotify) onNotify({ type: 'success', message: 'Base de datos SQLite (.db) descargada con éxito.' });
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setDownloadingDb(false);
    }
  };

  const handleForceCloudSync = async () => {
    try {
      setIsForcingSync(true);
      const res = await authFetch('/api/backup/sync-now', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');
      if (onNotify) onNotify({ type: 'success', message: data.message });
      fetchBackupStatus();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setIsForcingSync(false);
    }
  };

  const handleExportLogsCSV = () => {
    if (!logs || logs.length === 0) {
      if (onNotify) onNotify({ type: 'info', message: 'No hay registros para exportar con los filtros seleccionados.' });
      return;
    }

    const headers = ['ID', 'Fecha y Hora', 'Usuario', 'Módulo', 'Acción', 'Entidad ID', 'Descripción', 'IP de Origen'];
    const rows = logs.map(l => [
      l.id,
      `"${new Date(l.created_at).toLocaleString('es-CO')}"`,
      `"${(l.user_name || 'Sistema').replace(/"/g, '""')}"`,
      `"${(l.module || '').toUpperCase()}"`,
      `"${l.action}"`,
      `"${(l.entity_id || '').replace(/"/g, '""')}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      `"${l.ip_address || '-'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `historial_logs_solarquote_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onNotify) onNotify({ type: 'success', message: 'Historial de auditoría exportado en CSV correctamente.' });
  };

  const handleClearOldLogs = async (mode = 'old30') => {
    const confirmMsg = mode === 'all'
      ? '¿Estás seguro de que deseas vaciar TODOS los registros de logs y auditoría? Esta acción no se puede deshacer.'
      : '¿Deseas depurar los registros de auditoría anteriores a 30 días?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsClearingLogs(true);
      const res = await authFetch('/api/logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al depurar logs');

      if (onNotify) onNotify({ type: 'success', message: data.message });
      fetchLogs();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setIsClearingLogs(false);
    }
  };

  const handleSyncWithSupabase = async () => {
    try {
      setIsSyncing(true);
      const res = await authFetch('/api/auth/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar con Supabase');

      if (data.users) {
        setUsers(data.users);
      } else {
        await fetchData();
      }

      if (onNotify) {
        onNotify({
          type: 'success',
          message: data.message || 'Usuarios sincronizados exitosamente con Supabase Cloud'
        });
      }
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const openNewUserModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      username: '',
      email: '',
      password: '',
      role: 'comercial',
      active: 1
    });
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsModalOpen(true);
  };

  const openEditUserModal = (u) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      username: u.username || '',
      email: u.email || '',
      password: '', // leave empty to keep same
      role: u.role,
      active: u.active
    });
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsModalOpen(true);
  };

  // Password Policy Checks
  const pwd = formData.password || '';
  const pwdHasLength = pwd.length >= 6;
  const pwdHasLetter = /[a-zA-Z]/.test(pwd);
  const pwdHasNumber = /[0-9]/.test(pwd);
  const pwdMatches = pwd.length > 0 ? pwd === confirmPassword : true;

  const isPasswordValid = editingUser && !pwd
    ? true
    : (pwdHasLength && pwd === confirmPassword);

  const handleSaveUser = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.name.trim()) {
      if (onNotify) onNotify({ type: 'error', message: 'El nombre completo es obligatorio.' });
      return;
    }

    const cleanUser = formData.username ? formData.username.trim().toLowerCase() : '';
    if (!cleanUser || cleanUser.length < 3) {
      if (onNotify) onNotify({ type: 'error', message: 'El nombre de usuario debe tener mínimo 3 caracteres.' });
      return;
    }

    // Check if new user has password
    if (!editingUser && (!formData.password || formData.password.trim().length === 0)) {
      if (onNotify) onNotify({ type: 'error', message: 'La contraseña es obligatoria para nuevos usuarios.' });
      return;
    }

    // Check password rules if entering a password
    if (formData.password && formData.password.trim().length > 0) {
      if (formData.password.trim().length < 6) {
        if (onNotify) {
          onNotify({
            type: 'error',
            message: 'La contraseña debe tener al menos 6 caracteres por seguridad.'
          });
        }
        return;
      }
      if (formData.password !== confirmPassword) {
        if (onNotify) {
          onNotify({
            type: 'error',
            message: 'Las contraseñas no coinciden. Por favor verifícalas antes de guardar.'
          });
        }
        return;
      }
    }

    try {
      setIsSaving(true);
      const url = editingUser ? `/api/auth/users/${editingUser.id}` : '/api/auth/users';
      const method = editingUser ? 'PUT' : 'POST';

      const payload = {
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        email: formData.email ? formData.email.trim().toLowerCase() : '',
        role: formData.role,
        active: formData.active
      };

      if (formData.password && formData.password.trim().length > 0) {
        payload.password = formData.password.trim();
      }

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar usuario');

      // If user updated their own session, sync AuthContext
      if (editingUser && editingUser.id === user?.id) {
        updateUser({ name: payload.name, email: payload.email, username: payload.username });
      }

      if (onNotify) {
        onNotify({
          type: 'success',
          message: data.message || (editingUser ? 'Usuario actualizado exitosamente en Supabase Cloud' : 'Usuario creado exitosamente y alojado en Supabase Cloud')
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteUserModal = (u) => {
    setUserToDelete(u);
    setReassignUserId('');
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setIsDeleting(true);
      let url = `/api/auth/users/${userToDelete.id}`;
      if (reassignUserId) {
        url += `?reassign_to_id=${reassignUserId}`;
      }
      const res = await authFetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: data.message || `Usuario "${userToDelete.name}" eliminado exitosamente.`
        });
      }
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      fetchData();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  // Password Management Handlers
  const openPasswordModal = (u) => {
    setUserForPassword(u);
    setNewPasswordVal('');
    setConfirmPasswordVal('');
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setIsPasswordModalOpen(true);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasswordVal(pwd);
    setConfirmPasswordVal(pwd);
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!userForPassword) return;

    if (!newPasswordVal || newPasswordVal.length < 6) {
      if (onNotify) onNotify({ type: 'error', message: 'La contraseña debe tener mínimo 6 caracteres.' });
      return;
    }
    if (newPasswordVal !== confirmPasswordVal) {
      if (onNotify) onNotify({ type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }

    try {
      setIsSavingPassword(true);
      const res = await authFetch(`/api/auth/users/${userForPassword.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPasswordVal })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar contraseña');

      if (onNotify) onNotify({ type: 'success', message: data.message || 'Contraseña actualizada con éxito' });
      setIsPasswordModalOpen(false);
      setUserForPassword(null);
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Company Management Handlers
  const handleSelectCompany = (comp) => {
    setSelectedCompanyId(comp.id);
    setSettings(comp);
  };

  const handleSetDefaultCompany = async (companyId) => {
    try {
      const res = await authFetch(`/api/settings/companies/${companyId}/set-default`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al establecer empresa predeterminada');
      if (onNotify) onNotify({ type: 'success', message: data.message });
      await fetchData();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  const handleDeleteCompany = async (companyToDelete) => {
    if (companies.length <= 1) {
      if (onNotify) onNotify({ type: 'warning', message: 'No puedes eliminar la única empresa registrada en el sistema.' });
      return;
    }
    if (!window.confirm(`¿Estás seguro de eliminar la empresa "${companyToDelete.company_name || 'Sin Nombre'}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const res = await authFetch(`/api/settings/companies/${companyToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar empresa');
      if (onNotify) onNotify({ type: 'success', message: data.message });
      await fetchData();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  const handleClearCompanyData = async (companyId) => {
    if (!window.confirm('¿Deseas dejar en blanco todos los datos de esta empresa (Nombre, NIT, teléfonos, dirección, representante, etc.)?')) {
      return;
    }
    try {
      const targetId = companyId || settings?.id;
      const res = await authFetch(`/api/settings/companies/${targetId}/clear`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al limpiar datos');
      if (onNotify) onNotify({ type: 'success', message: data.message });
      await fetchData();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  const openNewCompanyModal = () => {
    setNewCompanyData({
      company_name: '',
      nit: '',
      phone: '',
      email: '',
      address: '',
      website: '',
      legal_rep_name: '',
      legal_rep_doc: '',
      bank_name: '',
      bank_account_type: 'Cuenta de Ahorros',
      bank_account_number: '',
      city: '',
      department: '',
      set_as_default: false
    });
    setIsNewCompanyModalOpen(true);
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyData.company_name.trim()) {
      if (onNotify) onNotify({ type: 'error', message: 'El nombre de la empresa es obligatorio.' });
      return;
    }
    try {
      setIsSavingCompany(true);
      const res = await authFetch('/api/settings/companies', {
        method: 'POST',
        body: JSON.stringify(newCompanyData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear empresa');
      if (onNotify) onNotify({ type: 'success', message: data.message });
      setIsNewCompanyModalOpen(false);
      await fetchData();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const url = settings?.id ? `/api/settings/companies/${settings.id}` : '/api/settings';
      const method = 'PUT';
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar configuración');

      if (onNotify) onNotify({ type: 'success', message: 'Datos de la empresa y garantías actualizados.' });
      if (data.company) {
        setSettings(data.company);
      } else if (data.settings) {
        setSettings(data.settings);
      }
      fetchCompanies();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
        <ShieldCheck className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Acceso Restringido</h2>
        <p className="text-xs text-slate-400 mt-1">Solo los usuarios con rol de Administrador pueden acceder a este módulo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-amber-500" />
            Módulo Administrativo & Ciberseguridad
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestión segura de usuarios alojados en Supabase Cloud, políticas de contraseñas y parámetros corporativos
          </p>
        </div>

        {activeTab === 'users' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncWithSupabase}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Sincronizar base de datos con Supabase Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-600' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Supabase'}</span>
            </button>

            <button
              onClick={openNewUserModal}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Crear Usuario</span>
            </button>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={logsLoading}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Recargar logs recientes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin text-amber-600' : ''}`} />
              <span>{logsLoading ? 'Cargando...' : 'Refrescar'}</span>
            </button>

            <button
              onClick={handleExportLogsCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Descargar historial completo en archivo CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleForceCloudSync}
              disabled={isForcingSync}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Sincronizar base de datos con Supabase Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isForcingSync ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{isForcingSync ? 'Sincronizando...' : 'Sincronizar Nube'}</span>
            </button>

            <button
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="Descargar libro completo en Excel con 10 hojas"
            >
              {downloadingExcel ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>{downloadingExcel ? 'Generando...' : 'Descargar Excel (.xlsx)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Cybersecurity Status Bar */}
      <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-emerald-950 flex items-center gap-2">
              <span>Alojamiento Seguro en Supabase PostgreSQL</span>
              <span className="bg-emerald-200/80 text-emerald-900 text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase">
                Activo
              </span>
            </div>
            <p className="text-emerald-800 text-[11px] mt-0.5">
              Protección contra fuerza bruta, cifrado Bcrypt, auditoría de eventos y sincronización cloud en tiempo real.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-700 shrink-0">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{users.length} Usuario(s) sincronizados</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('users');
            setSearchParams({ tab: 'users' });
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Usuarios del Sistema ({users.length})</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => {
              setActiveTab('roles');
              setSearchParams({ tab: 'roles' });
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'roles'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${activeTab === 'roles' ? 'text-[#48bb78]' : 'text-slate-500'}`} />
            <span>Gestor de Roles & Permisos ({roles.length})</span>
          </button>
        )}

        {isAdmin && (
          <>
            <button
              onClick={() => {
                setActiveTab('company');
                setSearchParams({ tab: 'company' });
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'company'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Datos de la Empresa & Términos</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('logs');
                setSearchParams({ tab: 'logs' });
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'logs'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className={`w-3.5 h-3.5 ${activeTab === 'logs' ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>Logs & Historial de Cambios</span>
              {logsStats.totalLogs > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'logs' ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                }`}>
                  {logsStats.totalLogs}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('backup');
                setSearchParams({ tab: 'backup' });
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'backup'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Database className={`w-3.5 h-3.5 ${activeTab === 'backup' ? 'text-white' : 'text-emerald-600'}`} />
              <span>Copias de Seguridad</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'backup' ? 'bg-emerald-300 text-emerald-950' : 'bg-emerald-100 text-emerald-800'
              }`}>
                10 Hojas
              </span>
            </button>
          </>
        )}
      </div>

      {/* Tab 1: Users */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Nombre / Empleado</th>
                  <th className="py-3.5 px-4">Usuario (Login)</th>
                  <th className="py-3.5 px-4">Correo</th>
                  <th className="py-3.5 px-4">Rol en el Sistema</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px]">
                            {u.name.charAt(0)}
                          </div>
                          <span>{u.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 text-[11px]">
                          @{u.username || (u.email ? u.email.split('@')[0] : `usuario_${u.id}`)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {u.email || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        {(() => {
                          const badge = getRoleBadgeInfo(u.role, roles);
                          return (
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}>
                              {badge.name}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(isAdmin || u.id === user?.id) && (
                            <button
                              onClick={() => openPasswordModal(u)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-800 font-bold text-xs cursor-pointer flex items-center gap-1 transition-colors border border-amber-200/70"
                              title={`Cambiar contraseña de ${u.name}`}
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                              <span>Contraseña</span>
                            </button>
                          )}
                          {(isAdmin || u.id === user?.id || u.role !== 'admin') && (
                            <button
                              onClick={() => openEditUserModal(u)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer flex items-center gap-1 transition-colors"
                              title={`Modificar usuario ${u.name}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Modificar</span>
                            </button>
                          )}
                          {u.id === user?.id ? (
                            <span
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-[11px] select-none border border-slate-200/80 cursor-default"
                              title="Tu usuario activo actualmente"
                            >
                              Tú (Sesión)
                            </span>
                          ) : isAdmin ? (
                            <button
                              onClick={() => openDeleteUserModal(u)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 hover:text-rose-800 font-bold text-xs cursor-pointer flex items-center gap-1 transition-all border border-rose-200/70"
                              title={`Eliminar usuario ${u.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Eliminar</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Roles & Permissions */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#2d8a58]" />
                <span>Gestor de Roles y Matriz de Permisos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Crea nuevos perfiles y define mediante casillas de verificación a qué módulos y funciones tiene acceso cada rol en la plataforma.
              </p>
            </div>
            <button
              onClick={openCreateRoleModal}
              className="px-4 py-2.5 rounded-xl bg-[#2d8a58] hover:bg-[#237348] text-white font-bold text-xs shadow-md shadow-[#2d8a58]/20 flex items-center gap-2 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Crear Nuevo Rol</span>
            </button>
          </div>

          {loadingRoles ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#2d8a58] border-t-transparent mx-auto"></div>
              <p className="text-xs text-slate-500 mt-2">Cargando roles del sistema...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((r) => {
                return (
                  <div
                    key={r.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all"
                  >
                    <div>
                      {/* Top badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {r.slug}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          r.is_system ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {r.is_system ? 'Rol del Sistema' : 'Rol Personalizado'}
                        </span>
                      </div>

                      <h3 className="font-black text-base text-slate-900 leading-tight">
                        {r.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 min-h-[36px]">
                        {r.description || 'Sin descripción asignada.'}
                      </p>

                      <div className="my-3 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Usuarios asignados:</span>
                        <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                          {r.user_count} {r.user_count === 1 ? 'usuario' : 'usuarios'}
                        </span>
                      </div>

                      {/* Permissions list */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          Módulos Habilitados ({r.permissions?.length || 0}):
                        </span>
                        <div className="flex flex-wrap gap-1.5 min-h-[50px]">
                          {(r.permissions || []).map((permKey) => {
                            const pMeta = availablePermissions.find(p => p.id === permKey);
                            return (
                              <span
                                key={permKey}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200"
                              >
                                <Check className="w-3 h-3 text-[#2d8a58]" />
                                <span>{pMeta ? pMeta.name.split('&')[0].trim() : permKey}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => openEditRoleModal(r)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-[#2d8a58] text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Modificar Rol & Permisos</span>
                      </button>

                      {r.slug !== 'admin' && (
                        <button
                          onClick={() => handleDeleteRole(r)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                          title={`Eliminar rol ${r.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Company settings */}
      {/* Tab 2: Company settings & Multi-company management */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          {/* Companies Header & Selector Cards */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-500" />
                  <span>Empresas Registradas ({companies.length})</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Gestiona múltiples razones sociales o perfiles corporativos para cotizaciones y contratos
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openNewCompanyModal}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Crear Empresa</span>
                </button>
              </div>
            </div>

            {/* Company Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {companies.map((comp) => {
                const isSelected = selectedCompanyId === comp.id;
                const isDefault = comp.is_default === 1 || comp.is_default === true;

                return (
                  <div
                    key={comp.id}
                    onClick={() => handleSelectCompany(comp)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                          }`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 truncate">
                              {comp.company_name || 'Empresa sin Nombre'}
                            </h3>
                            <span className="text-[10px] text-slate-500 font-mono">
                              NIT: {comp.nit || 'Sin NIT'}
                            </span>
                          </div>
                        </div>

                        {isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                            Predeterminada
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-0.5 mb-3">
                        <p className="truncate">Tel: {comp.phone || 'No registrado'}</p>
                        <p className="truncate">Email: {comp.email || 'No registrado'}</p>
                        <p className="truncate">Sede: {comp.address || 'No registrada'}</p>
                      </div>
                    </div>

                    {/* Quick Card Actions */}
                    <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-200/60 text-xs">
                      {!isDefault ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefaultCompany(comp.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold transition-colors cursor-pointer border border-emerald-200/60"
                          title="Hacer empresa predeterminada para cotizaciones"
                        >
                          Hacer Predeterminada
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Activa por defecto
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearCompanyData(comp.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-100/60 transition-colors cursor-pointer"
                          title="Dejar datos de esta empresa en blanco"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>

                        {companies.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCompany(comp);
                            }}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 transition-colors cursor-pointer"
                            title="Eliminar esta empresa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Company Details Form */}
          {settings && (
            <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-amber-500" />
                    <span>Editando Datos: {settings.company_name || 'Empresa'}</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Estos datos aparecerán en los membretes, firmas, cuentas bancarias y garantías de las cotizaciones
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleClearCompanyData(settings.id)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-xs flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
                    title="Borrar o vaciar todos los campos para dejarlos en blanco"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Dejar Datos en Blanco</span>
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </div>

              {/* General Information */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Identificación y Contacto</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Razón Social / Nombre Comercial *</label>
                    <input
                      type="text"
                      value={settings.company_name || ''}
                      onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                      placeholder="Ej: Renova Soluciones Energéticas S.A.S."
                      className="w-full px-3.5 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">NIT / Identificación Tributaria</label>
                    <input
                      type="text"
                      value={settings.nit || ''}
                      onChange={(e) => setSettings({ ...settings, nit: e.target.value })}
                      placeholder="Ej: 901.456.789-0"
                      className="w-full px-3.5 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Teléfono Principal de Contacto</label>
                    <input
                      type="text"
                      value={settings.phone || ''}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      placeholder="Ej: +57 300 123 4567"
                      className="w-full px-3.5 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Correo Electrónico Corporativo</label>
                    <input
                      type="email"
                      value={settings.email || ''}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      placeholder="contacto@empresa.com"
                      className="w-full px-3.5 py-2 border rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Dirección de la Sede</label>
                    <input
                      type="text"
                      value={settings.address || ''}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      placeholder="Ej: Carrera 15 # 85 - 20 Oficina 402"
                      className="w-full px-3.5 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Sitio Web</label>
                    <input
                      type="text"
                      value={settings.website || ''}
                      onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                      placeholder="www.empresa.com"
                      className="w-full px-3.5 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ciudad y Departamento</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={settings.city || ''}
                        onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                        placeholder="Ciudad"
                        className="w-full px-3.5 py-2 border rounded-xl"
                      />
                      <input
                        type="text"
                        value={settings.department || ''}
                        onChange={(e) => setSettings({ ...settings, department: e.target.value })}
                        placeholder="Departamento"
                        className="w-full px-3.5 py-2 border rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal Representative & Banking Data */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Representante Legal & Datos Bancarios</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nombre Representante Legal</label>
                    <input
                      type="text"
                      value={settings.legal_rep_name || ''}
                      onChange={(e) => setSettings({ ...settings, legal_rep_name: e.target.value })}
                      placeholder="Ej: Juan Pérez"
                      className="w-full px-3.5 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Documento Cédula / Identificación</label>
                    <input
                      type="text"
                      value={settings.legal_rep_doc || ''}
                      onChange={(e) => setSettings({ ...settings, legal_rep_doc: e.target.value })}
                      placeholder="Ej: C.C. 1.098.765.432"
                      className="w-full px-3.5 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Banco Oficial</label>
                    <input
                      type="text"
                      value={settings.bank_name || ''}
                      onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                      placeholder="Ej: Bancolombia / Davivienda"
                      className="w-full px-3.5 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tipo y Número de Cuenta</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={settings.bank_account_type || 'Cuenta de Ahorros'}
                        onChange={(e) => setSettings({ ...settings, bank_account_type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl bg-white"
                      >
                        <option value="Cuenta de Ahorros">Ahorros</option>
                        <option value="Cuenta Corriente">Corriente</option>
                      </select>
                      <input
                        type="text"
                        value={settings.bank_account_number || ''}
                        onChange={(e) => setSettings({ ...settings, bank_account_number: e.target.value })}
                        placeholder="N° de Cuenta"
                        className="w-full px-3.5 py-2 border rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Warranties */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">3. Garantías por Defecto en Propuestas</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Paneles (Años)</label>
                    <input
                      type="number"
                      value={settings.warranty_panels_years ?? 25}
                      onChange={(e) => setSettings({ ...settings, warranty_panels_years: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Inversores (Años)</label>
                    <input
                      type="number"
                      value={settings.warranty_inverter_years ?? 5}
                      onChange={(e) => setSettings({ ...settings, warranty_inverter_years: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Baterías Litio (Años)</label>
                    <input
                      type="number"
                      value={settings.warranty_batteries_years ?? 10}
                      onChange={(e) => setSettings({ ...settings, warranty_batteries_years: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Instalación (Años)</label>
                    <input
                      type="number"
                      value={settings.warranty_installation_years ?? 2}
                      onChange={(e) => setSettings({ ...settings, warranty_installation_years: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block font-bold text-slate-700 mb-1 text-xs">
                  Términos, Condiciones y Formas de Pago Predeterminadas
                </label>
                <textarea
                  rows="4"
                  value={settings.terms_and_conditions || ''}
                  onChange={(e) => setSettings({ ...settings, terms_and_conditions: e.target.value })}
                  placeholder="Especifica los términos comerciales estándar de las cotizaciones..."
                  className="w-full p-3 border rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Configuración de Empresa</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Tab 3: System Logs & Audit Change History */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-black text-slate-900 leading-tight">
                  {logsStats.totalLogs || 0}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 truncate">
                  Total Registros Históricos
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-black text-slate-900 leading-tight">
                  {logsStats.todayLogs || 0}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 truncate">
                  Movimientos Hoy
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-black text-slate-900 leading-tight">
                  {logsStats.userEvents || 0}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 truncate">
                  Seguridad & Accesos
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-black text-slate-900 leading-tight">
                  {(logsStats.quoteEvents || 0) + (logsStats.clientEvents || 0)}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 truncate">
                  Cotizaciones & Clientes
                </div>
              </div>
            </div>
          </div>

          {/* Search, Filters, and Controls Toolbar */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logFilters.search}
                  onChange={(e) => setLogFilters({ ...logFilters, search: e.target.value, page: 1 })}
                  placeholder="Buscar en el historial (descripción, usuario, código COT/VIS)..."
                  className="w-full pl-10 pr-9 py-2 rounded-2xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                />
                {logFilters.search && (
                  <button
                    onClick={() => { setLogFilters({ ...logFilters, search: '', page: 1 }); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Recargar logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin text-amber-600' : ''}`} />
                  <span className="hidden sm:inline">Refrescar</span>
                </button>

                <button
                  onClick={handleExportLogsCSV}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Descargar historial en CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>

                <button
                  onClick={() => handleClearOldLogs('old30')}
                  disabled={isClearingLogs}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-rose-200/60"
                  title="Depurar logs anteriores a 30 días"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden sm:inline">Depurar {'>'}30d</span>
                </button>
              </div>
            </div>

            {/* Filter pills and dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
              {/* Module filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Módulo</label>
                <select
                  value={logFilters.module}
                  onChange={(e) => setLogFilters({ ...logFilters, module: e.target.value, page: 1 })}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="all">Todos los módulos</option>
                  <option value="cotizaciones">Cotizaciones</option>
                  <option value="clientes">Clientes</option>
                  <option value="usuarios">Usuarios & Roles</option>
                  <option value="seguridad">Seguridad & Login</option>
                  <option value="visitas">Visitas Técnicas</option>
                  <option value="contratos">Contratos</option>
                  <option value="configuracion">Configuración</option>
                </select>
              </div>

              {/* Action filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Acción</label>
                <select
                  value={logFilters.action}
                  onChange={(e) => setLogFilters({ ...logFilters, action: e.target.value, page: 1 })}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="all">Todas las acciones</option>
                  <option value="CREAR">+ Creaciones</option>
                  <option value="ACTUALIZAR">✎ Modificaciones</option>
                  <option value="CAMBIO_ESTADO">⟳ Cambio de Estado</option>
                  <option value="ELIMINAR">🗑 Eliminaciones</option>
                  <option value="LOGIN_EXITOSO">🔓 Login Exitoso</option>
                  <option value="LOGIN_FALLIDO">⚠ Login Fallido</option>
                </select>
              </div>

              {/* User filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Usuario</label>
                <select
                  value={logFilters.user_id}
                  onChange={(e) => setLogFilters({ ...logFilters, user_id: e.target.value, page: 1 })}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="all">Todos los usuarios</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} (@{u.username || u.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date range filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Período</label>
                <select
                  value={logFilters.date_range}
                  onChange={(e) => setLogFilters({ ...logFilters, date_range: e.target.value, page: 1 })}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="all">Todo el historial</option>
                  <option value="today">Solo hoy</option>
                  <option value="week">Últimos 7 días</option>
                  <option value="month">Últimos 30 días</option>
                </select>
              </div>
            </div>

            {/* Active filters notice */}
            {(logFilters.search || logFilters.module !== 'all' || logFilters.action !== 'all' || logFilters.user_id !== 'all' || logFilters.date_range !== 'all') && (
              <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
                <span>Filtros aplicados. Mostrando {logs.length} de {logsTotal} resultados.</span>
                <button
                  onClick={() => setLogFilters({ search: '', module: 'all', action: 'all', user_id: 'all', date_range: 'all', page: 1, limit: 40 })}
                  className="text-amber-600 font-bold hover:underline cursor-pointer"
                >
                  Restablecer filtros
                </button>
              </div>
            )}
          </div>

          {/* Logs List / Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {logsLoading ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <p className="font-semibold text-slate-600">Cargando bitácora de eventos...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <History className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700 text-sm">No se encontraron registros de auditoría</p>
                <p className="text-slate-400 text-[11px]">Prueba ajustando los filtros de búsqueda o módulo.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Fecha / Hora</th>
                      <th className="py-3.5 px-4">Usuario</th>
                      <th className="py-3.5 px-4">Módulo</th>
                      <th className="py-3.5 px-4">Acción</th>
                      <th className="py-3.5 px-4">Descripción del Cambio</th>
                      <th className="py-3.5 px-4">IP</th>
                      <th className="py-3.5 px-4 text-right">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((l) => {
                      const dateObj = new Date(l.created_at);
                      const isToday = new Date().toDateString() === dateObj.toDateString();

                      // Action badge style
                      let actionColor = 'bg-slate-100 text-slate-700 border-slate-200';
                      let actionLabel = l.action;

                      if (l.action === 'CREAR') {
                        actionColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        actionLabel = '+ Creación';
                      } else if (l.action === 'ACTUALIZAR') {
                        actionColor = 'bg-blue-50 text-blue-700 border-blue-200';
                        actionLabel = '✎ Modificación';
                      } else if (l.action === 'CAMBIO_ESTADO') {
                        actionColor = 'bg-purple-50 text-purple-700 border-purple-200';
                        actionLabel = '⟳ Estado';
                      } else if (l.action === 'ELIMINAR') {
                        actionColor = 'bg-rose-50 text-rose-700 border-rose-200';
                        actionLabel = '🗑 Eliminación';
                      } else if (l.action === 'LOGIN_EXITOSO') {
                        actionColor = 'bg-emerald-100/70 text-emerald-800 border-emerald-300';
                        actionLabel = '🔓 Login OK';
                      } else if (l.action === 'LOGIN_FALLIDO') {
                        actionColor = 'bg-rose-100 text-rose-800 border-rose-300';
                        actionLabel = '⚠ Login Fallido';
                      }

                      // Module badge
                      let moduleBadge = 'bg-slate-100 text-slate-700';
                      if (l.module === 'cotizaciones') moduleBadge = 'bg-amber-100 text-amber-800';
                      else if (l.module === 'clientes') moduleBadge = 'bg-blue-100 text-blue-800';
                      else if (l.module === 'usuarios') moduleBadge = 'bg-purple-100 text-purple-800';
                      else if (l.module === 'seguridad') moduleBadge = 'bg-emerald-100 text-emerald-800';
                      else if (l.module === 'visitas') moduleBadge = 'bg-cyan-100 text-cyan-800';
                      else if (l.module === 'contratos') moduleBadge = 'bg-indigo-100 text-indigo-800';

                      return (
                        <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono text-[11px] text-slate-800 font-semibold">
                              {dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              {isToday && (
                                <span className="inline-block px-1 rounded bg-amber-100 text-amber-800 font-bold text-[9px]">
                                  Hoy
                                </span>
                              )}
                              <span>{dateObj.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {(l.user_name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate max-w-[130px]">{l.user_name || 'Sistema'}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${moduleBadge}`}>
                              {l.module}
                            </span>
                            {l.entity_id && (
                              <span className="block text-[10px] font-mono text-slate-500 mt-0.5">
                                {l.entity_id}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-lg border text-[10px] font-bold ${actionColor}`}>
                              {actionLabel}
                            </span>
                          </td>

                          <td className="py-3 px-4 max-w-md">
                            <p className="text-slate-800 text-xs line-clamp-2 font-medium">
                              {l.description}
                            </p>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {l.ip_address || 'web'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedLogDetail(l);
                                setIsDetailModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer transition-colors"
                              title="Ver información detallada del evento"
                            >
                              Detalles
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            {logsTotal > logFilters.limit && (
              <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Mostrando {(logFilters.page - 1) * logFilters.limit + 1} - {Math.min(logFilters.page * logFilters.limit, logsTotal)} de {logsTotal} registros
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={logFilters.page <= 1}
                    onClick={() => setLogFilters({ ...logFilters, page: logFilters.page - 1 })}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-bold text-slate-800">
                    Página {logFilters.page} de {Math.ceil(logsTotal / logFilters.limit)}
                  </span>
                  <button
                    disabled={logFilters.page >= Math.ceil(logsTotal / logFilters.limit)}
                    onClick={() => setLogFilters({ ...logFilters, page: logFilters.page + 1 })}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Backup & Security */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Respaldo y Seguridad Empresarial</span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Centro de Copias de Seguridad & Respaldo Local
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                  Exporta toda la información del sistema en un archivo de Excel con hojas independientes para cada módulo, 
                  o descarga la base de datos relacional completa para almacenamiento seguro fuera de línea.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <button
                  onClick={handleDownloadExcel}
                  disabled={downloadingExcel}
                  className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {downloadingExcel ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5 text-slate-950" />
                  )}
                  <span>{downloadingExcel ? 'Generando Excel...' : 'Exportar Copia en Excel (.xlsx)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Database Health and Statistics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Clientes</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{backupStatus?.tables?.clients ?? '...'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Empresas & Personas</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cotizaciones</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{backupStatus?.tables?.quotes ?? '...'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Propuestas comerciales</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contratos</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{backupStatus?.tables?.contracts ?? '...'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Proyectos cerrados</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Visitas Técnicas</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{backupStatus?.tables?.visits ?? '...'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Levantamientos en sitio</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Productos</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{backupStatus?.tables?.products ?? '...'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Catálogo y servicios</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Usuarios</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{backupStatus?.tables?.users ?? '...'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Accesos activos</div>
            </div>
          </div>

          {/* Backup Options Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Excel Backup */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase tracking-wider">
                    Recomendado para Archivo
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Copia de Seguridad en Excel (.xlsx)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Descarga un libro de cálculo unificado con <strong>10 hojas independientes</strong> debidamente formateadas, 
                    con nombres claros de columnas para visualización en Excel, Google Sheets o LibreOffice:
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs space-y-1.5">
                  <div className="font-bold text-slate-700 text-[11px] uppercase tracking-wider mb-2">
                    Estructura del archivo descargable:
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>1. Clientes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>2. Cotizaciones</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>3. Contratos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>4. Visitas Técnicas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>5. Trámites OR</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>6. Seguimientos CRM</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>7. Catálogo Productos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>8. Usuarios Sistema</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>9. Config. Empresa</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>10. Auditoría Logs</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Formato abierto Office Open XML (.xlsx)
                </span>
                <button
                  onClick={handleDownloadExcel}
                  disabled={downloadingExcel}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {downloadingExcel ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{downloadingExcel ? 'Descargando...' : 'Descargar Excel'}</span>
                </button>
              </div>
            </div>

            {/* Card 2: SQLite Database (.db) */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
                    <Database className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[10px] uppercase tracking-wider">
                    Copia en Frío (Raw DB)
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Base de Datos SQLite (.db)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Descarga el archivo físico <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono font-bold">solarquote.db</code> en 
                    su formato relacional nativo SQLite 3. Contiene la totalidad de tablas, relaciones foráneas, esquemas e índices.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Tamaño del archivo DB:</span>
                    <span className="font-mono font-bold text-slate-800">{backupStatus?.database_size_kb || 144} KB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Alojamiento primario:</span>
                    <span className="font-bold text-emerald-700">Supabase Storage & Cloud</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Compatibilidad:</span>
                    <span className="text-slate-700 font-medium">DB Browser, Node.js, Python</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Archivo binario completo
                </span>
                <button
                  onClick={handleDownloadDb}
                  disabled={downloadingDb}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md shadow-slate-900/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {downloadingDb ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5" />
                  )}
                  <span>{downloadingDb ? 'Descargando...' : 'Descargar SQLite (.db)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cloud Synchronization and Integrity Guarantee Card */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-emerald-950 text-base">
                    Garantía de Integridad y Cero Pérdida de Información
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 max-w-2xl leading-relaxed">
                    El sistema está configurado con <strong>cerrojos automáticos anti-sobreescritura ("Do No Harm")</strong>. 
                    Las actualizaciones y nuevos despliegues nunca eliminan ni sobrescriben datos existentes. 
                    Se ha retirado de forma permanente cualquier carga de datos de prueba o demo.
                  </p>
                </div>
              </div>

              <button
                onClick={handleForceCloudSync}
                disabled={isForcingSync}
                className="px-4 py-2.5 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-100/60 text-emerald-900 font-black text-xs shadow-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-emerald-700 ${isForcingSync ? 'animate-spin' : ''}`} />
                <span>{isForcingSync ? 'Sincronizando...' : 'Sincronizar Cloud Ahora'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit User */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isSaving) setIsModalOpen(false);
        }}
        title={editingUser ? `Editar Usuario: ${editingUser.name}` : 'Crear Nuevo Usuario del Sistema'}
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => {
                const newName = e.target.value;
                const autoUsername = !editingUser && !formData.username
                  ? newName.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
                  : formData.username;
                setFormData({ ...formData, name: newName, username: autoUsername });
              }}
              className="w-full px-3.5 py-2 border rounded-xl text-xs"
              placeholder="Ej. Juan Manuel Pérez"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nombre de Usuario (Login de acceso) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">@</span>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '') })}
                className="w-full pl-7 pr-3.5 py-2 border rounded-xl text-xs font-mono font-semibold"
                placeholder="juanperez"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Identificador único con el que se inicia sesión (mínimo 3 caracteres alfanuméricos).</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Correo Electrónico <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2 border rounded-xl text-xs"
              placeholder="juan@solar.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                {editingUser ? 'Nueva Contraseña' : 'Contraseña Segura *'}
              </label>
              {editingUser && (
                <span className="text-[11px] text-slate-400">Dejar en blanco para mantener la actual</span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!editingUser}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-3.5 pr-10 py-2 border rounded-xl text-xs"
                placeholder={editingUser ? 'Escribe aquí solo si deseas cambiarla' : 'Mínimo 8 caracteres (letras y números)'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Policy & Confirmation Display */}
          {(!editingUser || (formData.password && formData.password.length > 0)) && (
            <>
              {/* Requirements checklist */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider mb-1">
                  Seguridad de la Contraseña:
                </p>
                <div className="flex items-center gap-2">
                  {pwdHasLength ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span className={pwdHasLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                    Mínimo 6 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {pwdHasLetter && pwdHasNumber ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <span className="w-3.5 h-3.5 text-slate-400 text-center font-bold">·</span>
                  )}
                  <span className={pwdHasLetter && pwdHasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                    Recomendado: combinar letras y números
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required={!editingUser || (formData.password && formData.password.length > 0)}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-3.5 pr-10 py-2 border rounded-xl text-xs ${
                      confirmPassword && formData.password !== confirmPassword ? 'border-rose-400 bg-rose-50/30' : ''
                    }`}
                    placeholder="Repite la contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && formData.password !== confirmPassword && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Las contraseñas no coinciden
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Rol de Acceso y Permisos</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold"
            >
              {roles.length > 0 ? (
                <>
                  {roles
                    .filter(r => isAdmin || r.slug !== 'admin')
                    .map(r => (
                      <option key={r.slug} value={r.slug}>
                        {r.name} ({r.description || r.slug})
                      </option>
                    ))}
                  {formData.role && !roles.some(r => r.slug === formData.role) && (
                    <option value={formData.role}>
                      {getRoleBadgeInfo(formData.role, roles).name}
                    </option>
                  )}
                </>
              ) : (
                <>
                  <option value="comercial">Comercial (Gestión y Creación de Clientes)</option>
                  <option value="asesor">Asesor Comercial (Cotizaciones, CRM, Clientes, Contratos, Usuarios)</option>
                  <option value="tecnico">Técnico de Campo (Visitas Técnicas y Trabajos Programados)</option>
                  <option value="ingeniero">Ingeniero Solar (Visitas Técnicas, Legalizaciones y Trabajos)</option>
                  {isAdmin && (
                    <option value="admin">Administrador General (Control Total, Precios, Seguridad, Logs)</option>
                  )}
                </>
              )}
            </select>
          </div>

          {editingUser && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Estado de la Cuenta</label>
              <select
                value={formData.active}
                onChange={(e) => setFormData({ ...formData, active: parseInt(e.target.value) })}
                className="w-full px-3.5 py-2 border rounded-xl text-xs"
              >
                <option value="1">Activo (Puede iniciar sesión)</option>
                <option value="0">Inactivo (Acceso bloqueado)</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-xl shadow cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {isSaving
                  ? 'Guardando en Supabase...'
                  : editingUser
                  ? 'Actualizar Usuario'
                  : 'Crear Usuario'}
              </span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Delete User */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setUserToDelete(null);
          }
        }}
        title="Eliminar Usuario del Sistema"
      >
        {userToDelete && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-950">
                <p className="font-bold text-sm text-rose-900 mb-1">
                  ¿Confirmas que deseas eliminar a {userToDelete.name}?
                </p>
                <p className="text-rose-800 leading-relaxed">
                  Esta acción revocará de inmediato las credenciales de acceso para <strong>@{userToDelete.username || userToDelete.email}</strong> y removerá su perfil de Supabase Cloud y del sistema.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Nombre completo:</span>
                <span className="font-bold text-slate-800">{userToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Usuario de acceso:</span>
                <span className="font-mono font-bold text-slate-800">@{userToDelete.username || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Correo electrónico:</span>
                <span className="font-mono text-slate-700">{userToDelete.email || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rol actual:</span>
                <span className="font-bold text-slate-800 uppercase tracking-wider">
                  {getRoleBadgeInfo(userToDelete.role, roles).name}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reasignar cotizaciones, visitas y contratos (Opcional):
              </label>
              <select
                value={reassignUserId}
                onChange={(e) => setReassignUserId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
              >
                <option value="">Desvincular registros de forma segura (Preservar historial)</option>
                {users
                  .filter((u) => u.id !== userToDelete.id && u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      Reasignar a: {u.name} ({u.role === 'admin' ? 'Administrador' : u.role})
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Si seleccionas otro asesor o técnico, sus cotizaciones y visitas pasarán a este nuevo usuario para dar continuidad al seguimiento comercial.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteUser}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Eliminando de Supabase...' : 'Eliminar Usuario'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: View Log Details */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedLogDetail(null);
        }}
        title="Detalle del Evento de Auditoría"
      >
        {selectedLogDetail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-900 text-white">
                {selectedLogDetail.action}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                {selectedLogDetail.module}
              </span>
              <span className="ml-auto text-xs font-mono text-slate-500">
                {new Date(selectedLogDetail.created_at).toLocaleString('es-CO')}
              </span>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Usuario ejecutor:</span>
                <span className="font-bold text-slate-900">{selectedLogDetail.user_name || 'Sistema'} (ID: {selectedLogDetail.user_id || 'N/A'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Dirección IP:</span>
                <span className="font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">{selectedLogDetail.ip_address || 'web'}</span>
              </div>
              {selectedLogDetail.entity_type && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Tipo de Entidad:</span>
                  <span className="font-bold text-slate-800">{selectedLogDetail.entity_type}</span>
                </div>
              )}
              {selectedLogDetail.entity_id && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Identificador / Registro:</span>
                  <span className="font-mono font-bold text-amber-700">{selectedLogDetail.entity_id}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Descripción Completa</label>
              <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-medium leading-relaxed">
                {selectedLogDetail.description}
              </div>
            </div>

            {selectedLogDetail.details_json && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Metadatos del Cambio (JSON)</label>
                <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-56 leading-relaxed">
                  {(() => {
                    try {
                      const parsed = typeof selectedLogDetail.details_json === 'string'
                        ? JSON.parse(selectedLogDetail.details_json)
                        : selectedLogDetail.details_json;
                      return JSON.stringify(parsed, null, 2);
                    } catch (e) {
                      return String(selectedLogDetail.details_json);
                    }
                  })()}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedLogDetail(null);
                }}
                className="px-5 py-2 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Crear / Editar Rol con Permisos */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={editingRole ? `Editar Rol: ${editingRole.name}` : 'Crear Nuevo Rol del Sistema'}
      >
        <form onSubmit={handleSaveRole} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Rol *</label>
            <input
              type="text"
              required
              placeholder="Ej: Ingeniero Interventor, Asistente Comercial"
              value={roleFormData.name}
              onChange={(e) => {
                const name = e.target.value;
                setRoleFormData(prev => ({
                  ...prev,
                  name,
                  slug: editingRole ? prev.slug : name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
                }));
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Identificador / Slug *</label>
              <input
                type="text"
                required
                disabled={editingRole?.is_system}
                placeholder="ej: asesor, interventor"
                value={roleFormData.slug}
                onChange={(e) => setRoleFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono disabled:bg-slate-100 disabled:text-slate-500"
              />
              {editingRole?.is_system && (
                <span className="text-[10px] text-slate-500">El identificador de roles base del sistema no se puede modificar.</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Descripción Breve</label>
              <input
                type="text"
                placeholder="Responsabilidad principal del rol"
                value={roleFormData.description}
                onChange={(e) => setRoleFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {editingRole?.slug === 'admin' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Por seguridad, los permisos troncales del rol Administrador (Panel, Usuarios, Ajustes de Empresa y Logs) se mantienen obligatorios.</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Permisos y Módulos Accesibles ({roleFormData.permissions?.length || 0} seleccionados)
              </label>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {availablePermissions.map((perm) => {
                const isSelected = roleFormData.permissions?.includes(perm.id);
                const isLockedAdmin = editingRole?.slug === 'admin' && ['dashboard', 'users', 'company_settings', 'logs'].includes(perm.id);

                return (
                  <div
                    key={perm.id}
                    onClick={() => !isLockedAdmin && toggleRolePermission(perm.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected 
                        ? 'bg-amber-500/10 border-amber-300 text-slate-900' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                    } ${isLockedAdmin ? 'opacity-80 cursor-not-allowed' : ''}`}
                  >
                    <div className="pt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{perm.name || perm.label || perm.id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 font-mono text-slate-500">
                          {perm.id}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 font-medium text-slate-600 ml-auto">
                          {perm.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{perm.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingRole || !roleFormData.name.trim() || !roleFormData.slug.trim()}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl shadow-md shadow-amber-500/10 transition-all flex items-center gap-2 cursor-pointer"
            >
              {savingRole ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Guardando Rol...</span>
                </>
              ) : (
                <span>{editingRole ? 'Guardar Cambios' : 'Crear Rol'}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Dedicated Password Change */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setUserForPassword(null);
        }}
        title={`Cambiar Contraseña: ${userForPassword?.name || ''}`}
      >
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
              <KeyRound className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900">{userForPassword?.name}</div>
              <div className="font-mono text-[11px] text-slate-500">
                @{userForPassword?.username} · Rol: {userForPassword?.role}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Nueva Contraseña *</label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                title="Generar contraseña aleatoria y segura"
              >
                <KeyRound className="w-3 h-3" />
                <span>Generar Aleatoria</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2 pr-10 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Confirmar Nueva Contraseña *</label>
            <div className="relative">
              <input
                type={showConfirmNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPasswordVal}
                onChange={(e) => setConfirmPasswordVal(e.target.value)}
                placeholder="Repite la contraseña exactamente"
                className="w-full px-3 py-2 pr-10 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {newPasswordVal && confirmPasswordVal && (
            <div className={`p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-1.5 ${
              newPasswordVal === confirmPasswordVal
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {newPasswordVal === confirmPasswordVal ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Las contraseñas coinciden correctamente</span>
                </>
              ) : (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Las contraseñas no coinciden aún</span>
                </>
              )}
            </div>
          )}

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
            <strong>Ciberseguridad:</strong> La contraseña se cifrará con algoritmo Bcrypt (10 rondas de salt) y se actualizará instantáneamente en Supabase Cloud.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsPasswordModalOpen(false);
                setUserForPassword(null);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingPassword || !newPasswordVal || newPasswordVal !== confirmPasswordVal || newPasswordVal.length < 6}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSavingPassword ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <span>Actualizar Contraseña</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: New Company */}
      <Modal
        isOpen={isNewCompanyModalOpen}
        onClose={() => setIsNewCompanyModalOpen(false)}
        title="Crear Nueva Empresa / Razón Social"
      >
        <form onSubmit={handleCreateCompany} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Razón Social / Nombre Comercial *</label>
              <input
                type="text"
                required
                value={newCompanyData.company_name}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, company_name: e.target.value })}
                placeholder="Ej: Renova Soluciones Energéticas S.A.S."
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">NIT / Identificación</label>
              <input
                type="text"
                value={newCompanyData.nit}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, nit: e.target.value })}
                placeholder="Ej: 901.456.789-0"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Teléfono Principal</label>
              <input
                type="text"
                value={newCompanyData.phone}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, phone: e.target.value })}
                placeholder="+57 300 000 0000"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={newCompanyData.email}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, email: e.target.value })}
                placeholder="info@empresa.com"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Sitio Web</label>
              <input
                type="text"
                value={newCompanyData.website}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, website: e.target.value })}
                placeholder="www.empresa.com"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Dirección de la Sede</label>
              <input
                type="text"
                value={newCompanyData.address}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, address: e.target.value })}
                placeholder="Carrera 15 # 85 - 20"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Ciudad</label>
              <input
                type="text"
                value={newCompanyData.city}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, city: e.target.value })}
                placeholder="Ej: Bogotá"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Departamento</label>
              <input
                type="text"
                value={newCompanyData.department}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, department: e.target.value })}
                placeholder="Ej: Cundinamarca"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Representante Legal</label>
              <input
                type="text"
                value={newCompanyData.legal_rep_name}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, legal_rep_name: e.target.value })}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Doc. Representante</label>
              <input
                type="text"
                value={newCompanyData.legal_rep_doc}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, legal_rep_doc: e.target.value })}
                placeholder="C.C. 1.234.567"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Banco Oficial</label>
              <input
                type="text"
                value={newCompanyData.bank_name}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, bank_name: e.target.value })}
                placeholder="Ej: Bancolombia"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tipo y N° Cuenta Bancaria</label>
              <input
                type="text"
                value={newCompanyData.bank_account_number}
                onChange={(e) => setNewCompanyData({ ...newCompanyData, bank_account_number: e.target.value })}
                placeholder="Ahorros 123-456789-0"
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
            <input
              type="checkbox"
              id="set_as_default_check"
              checked={newCompanyData.set_as_default}
              onChange={(e) => setNewCompanyData({ ...newCompanyData, set_as_default: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="set_as_default_check" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
              Establecer inmediatamente como empresa predeterminada para cotizaciones y contratos
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewCompanyModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingCompany || !newCompanyData.company_name.trim()}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSavingCompany ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Creando Empresa...</span>
                </>
              ) : (
                <span>Crear Empresa</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

