import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  DollarSign,
  SunMedium,
  BatteryCharging,
  Zap,
  Droplets,
  Layers,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  FolderPlus,
  Tag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCOP, formatKW } from '../utils/formatters';
import Modal from '../components/Modal';

export default function Productos({ onNotify }) {
  const { authFetch, isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [retieTiers, setRetieTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'

  // Dynamic Categories State
  const defaultCategories = [
    { id: 'all', label: 'Todos' },
    { id: 'paneles', label: '☀️ Paneles Solares' },
    { id: 'inversores', label: '⚡ Inversores' },
    { id: 'baterias', label: '🔋 Baterías Litio/Gel' },
    { id: 'bombas', label: '💧 Bombeo Solar' },
    { id: 'variadores', label: '🎛️ Variadores Solares' },
    { id: 'estructuras', label: '🏗️ Estructuras' },
    { id: 'mdo', label: '👷 Mano de Obra' },
    { id: 'legalizacion', label: '📑 Legalización & RETIE' },
    { id: 'accesorios', label: '🔌 Accesorios' }
  ];
  const [categoriesList, setCategoriesList] = useState(defaultCategories);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📦');
  const [savingCategory, setSavingCategory] = useState(false);

  // Modal Delete Product
  const [productToDelete, setProductToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Product
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    category: 'paneles',
    name: '',
    brand: '',
    model: '',
    power_w: 0,
    voltage: '',
    capacity_ah: 0,
    system_type: 'all',
    unit_price: 0,
    cost_price: 0,
    unit: 'unidad',
    description: ''
  });

  // Modal RETIE Tier
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [tierPrice, setTierPrice] = useState(0);

  const fetchCategories = async () => {
    try {
      const res = await authFetch('/api/products/categories');
      if (res.ok) {
        const data = await res.json();
        if (data.categories && data.categories.length > 0) {
          setCategoriesList(data.categories);
        }
      }
    } catch (e) {
      console.warn('Error fetching categories:', e);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      setSavingCategory(true);
      const res = await authFetch('/api/products/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: newCatName.trim(),
          label: `${newCatEmoji} ${newCatName.trim()}`,
          icon: 'Package'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear categoría');
      if (onNotify) onNotify({ type: 'success', message: `Categoría "${newCatName}" creada con éxito` });
      setIsCategoryModalOpen(false);
      setNewCatName('');
      fetchCategories();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setSavingCategory(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (categoryFilter !== 'all') query.append('category', categoryFilter);
      if (searchTerm) query.append('search', searchTerm);

      const [resProds, resTiers] = await Promise.all([
        authFetch(`/api/products?${query.toString()}`),
        authFetch('/api/products/retie-tiers')
      ]);

      const dataProds = await resProds.json();
      const dataTiers = await resTiers.json();

      setProducts(dataProds.products || []);
      setRetieTiers(dataTiers.tiers || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const openNewModal = () => {
    setEditingProduct(null);
    setFormData({
      category: categoryFilter !== 'all' ? categoryFilter : 'paneles',
      name: '',
      brand: '',
      model: '',
      power_w: 0,
      voltage: '',
      capacity_ah: 0,
      system_type: 'all',
      unit_price: 0,
      cost_price: 0,
      unit: 'unidad',
      description: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setFormData({
      category: p.category,
      name: p.name,
      brand: p.brand || '',
      model: p.model || '',
      power_w: p.power_w || 0,
      voltage: p.voltage || '',
      capacity_ah: p.capacity_ah || 0,
      system_type: p.system_type || 'all',
      unit_price: p.unit_price || 0,
      cost_price: p.cost_price || 0,
      unit: p.unit || 'unidad',
      description: p.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar producto');

      if (onNotify) {
        onNotify({
          type: 'success',
          message: editingProduct ? 'Producto y precio actualizados' : 'Producto creado exitosamente'
        });
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  const handleToggleActive = async (p) => {
    try {
      const newActive = p.active ? 0 : 1;
      const res = await authFetch(`/api/products/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...p, active: newActive })
      });
      if (!res.ok) throw new Error('Error al cambiar estado');
      setProducts(products.map(item => item.id === p.id ? { ...item, active: newActive } : item));
      if (onNotify) onNotify({ type: 'info', message: `Producto ${newActive ? 'activado' : 'desactivado'}.` });
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  const handleDeleteClick = (p) => {
    setProductToDelete(p);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteProduct = async (force = false) => {
    if (!productToDelete) return;
    try {
      setIsDeleting(true);
      const url = `/api/products/${productToDelete.id}${force ? '?force=true' : ''}`;
      const res = await authFetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar producto');

      if (onNotify) {
        onNotify({
          type: data.deactivated ? 'info' : 'success',
          message: data.message
        });
      }
      setIsDeleteModalOpen(false);
      setIsModalOpen(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateTier = async (e) => {
    e.preventDefault();
    if (!editingTier) return;
    try {
      const res = await authFetch(`/api/products/retie-tiers/${editingTier.id}`, {
        method: 'PUT',
        body: JSON.stringify({ price: tierPrice })
      });
      if (!res.ok) throw new Error('Error al actualizar tarifa RETIE');
      if (onNotify) onNotify({ type: 'success', message: 'Tarifa de diseño RETIE actualizada.' });
      setIsTierModalOpen(false);
      fetchProducts();
    } catch (err) {
      if (onNotify) onNotify({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Package className="w-7 h-7 text-amber-500" />
            Base de Datos de Productos & Precios
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Administra los equipos del cotizador, ajusta precios unitarios y parametriza las tarifas técnicas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span>{viewMode === 'table' ? 'Ver como Tarjetas' : 'Ver como Tabla'}</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-amber-400" />
              <span>+ Nueva Categoría</span>
            </button>
          )}

          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Agregar Producto</span>
          </button>
        </div>
      </div>

      {/* Categories & Search */}
      <div className="space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categoriesList.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === c.id
                  ? 'bg-slate-900 text-amber-400 shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por nombre de equipo, marca, modelo o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* RETIE Scale Box if in legalizacion or all */}
      {(categoryFilter === 'all' || categoryFilter === 'legalizacion') && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                Tabla de Precios: Diseño de Ingeniería RETIE por Rango de Potencia
              </h3>
              <p className="text-xs text-slate-500">
                Tarifas automáticas aplicadas al cotizador según los kWp instalados
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {retieTiers.map((tier) => (
              <div key={tier.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 block">{tier.name}</span>
                <span className="text-base font-black text-slate-900 mt-1 block">{formatCOP(tier.price)}</span>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingTier(tier);
                      setTierPrice(tier.price);
                      setIsTierModalOpen(true);
                    }}
                    className="text-[11px] text-amber-600 font-bold hover:underline mt-1 block"
                  >
                    Editar tarifa
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products Display (Table vs Cards) */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-amber-500 border-t-transparent mx-auto mb-2"></div>
          <p className="text-xs text-slate-400">Cargando productos...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-slate-200">
          <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No se encontraron productos</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Products Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 font-bold uppercase text-[10px] text-slate-600">
                    {p.category}
                  </span>
                  <button
                    onClick={() => handleToggleActive(p)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {p.active ? 'Activo' : 'Inactivo'}
                  </button>
                </div>

                <h3 className="font-bold text-slate-900 text-sm leading-snug">{p.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.brand || 'Genérico'} {p.model ? `/ ${p.model}` : ''}
                </p>

                {p.description && (
                  <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">{p.description}</p>
                )}

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between my-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Especificaciones</span>
                    <span className="font-bold text-slate-700">
                      {p.power_w > 0 && `${p.power_w}W `}
                      {p.voltage && `${p.voltage} `}
                      {p.capacity_ah > 0 && `${p.capacity_ah}Ah`}
                      {!p.power_w && !p.voltage && !p.capacity_ah && '-'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Precio Venta</span>
                    <span className="text-sm font-black text-slate-900">{formatCOP(p.unit_price)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(p)}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-amber-200"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Modificar</span>
                </button>
                <button
                  onClick={() => handleDeleteClick(p)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Eliminar producto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Products Table View */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Marca / Modelo</th>
                  <th className="py-3 px-4">Especificaciones</th>
                  <th className="py-3 px-4">Precio Venta (COP)</th>
                  <th className="py-3 px-4">Costo Ref.</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{p.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 font-bold uppercase text-[10px] text-slate-600">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.brand || '-'} {p.model ? `/ ${p.model}` : ''}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {p.power_w > 0 && <span className="font-semibold mr-1">{p.power_w}W</span>}
                        {p.voltage && <span className="mr-1">&bull; {p.voltage}</span>}
                        {p.capacity_ah > 0 && <span>&bull; {p.capacity_ah}Ah</span>}
                        {!p.power_w && !p.voltage && !p.capacity_ah && <span className="text-slate-400">-</span>}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 text-sm">
                        {formatCOP(p.unit_price)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {p.cost_price > 0 ? formatCOP(p.cost_price) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {p.active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            title="Modificar producto o precio"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition-colors cursor-pointer border border-amber-200 shadow-2xs"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Modificar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteClick(p)}
                            title="Eliminar producto"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer border border-rose-200 shadow-2xs"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Eliminar</span>
                          </button>
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

      {/* Modal: Add/Edit Product */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? `Modificar Producto / Precio: ${editingProduct.name}` : 'Agregar Nuevo Producto'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
              >
                {categoriesList
                  .filter((c) => c.id !== 'all')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Producto / Equipo *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                placeholder="Ej. Inversor Huawei 10KTL"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Marca</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
                placeholder="Ej. Huawei, SRNE, Longi..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Modelo</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
                placeholder="Ej. SUN2000-10KTL"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Potencia (Watts / Wp)</label>
              <input
                type="number"
                value={formData.power_w}
                onChange={(e) => setFormData({ ...formData, power_w: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
                placeholder="720, 6000, 10000..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Voltaje</label>
              <input
                type="text"
                value={formData.voltage}
                onChange={(e) => setFormData({ ...formData, voltage: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
                placeholder="220V, 48V, 24V..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Capacidad Batería (Ah)</label>
              <input
                type="number"
                value={formData.capacity_ah}
                onChange={(e) => setFormData({ ...formData, capacity_ah: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
                placeholder="100, 200, 300..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unidad de Medida</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
              >
                <option value="unidad">Unidad</option>
                <option value="panel">Por Panel</option>
                <option value="kWp">Por kWp</option>
                <option value="global">Global</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-700 mb-1">Precio de Venta al Público (COP) *</label>
              <input
                type="number"
                required
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border-2 border-amber-400 rounded-xl text-sm font-black"
                placeholder="Ej. 470000"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Costo Interno (COP)</label>
              <input
                type="number"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
                placeholder="Ej. 390000"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Descripción / Ficha Técnica</label>
              <textarea
                rows="2"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs"
                placeholder="Detalles sobre garantía, eficiencia, ciclos..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
            {editingProduct ? (
              <button
                type="button"
                onClick={() => {
                  setProductToDelete(editingProduct);
                  setIsDeleteModalOpen(true);
                }}
                className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-1.5 border border-rose-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar Producto</span>
              </button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-xl shadow cursor-pointer"
              >
                {editingProduct ? 'Guardar Cambios y Precio' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Delete Product */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Confirmar Eliminación de Producto"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-rose-900">
                ¿Estás seguro de que deseas eliminar este producto?
              </p>
              <p className="text-xs text-rose-700 mt-1">
                Se removerá del catálogo:{' '}
                <strong className="font-black text-slate-900 block mt-0.5 text-sm">
                  {productToDelete?.name}
                </strong>
              </p>
              {productToDelete && (
                <div className="mt-2 text-[11px] text-rose-800 flex gap-4">
                  <span>Categoría: <strong className="uppercase">{productToDelete.category}</strong></span>
                  <span>Precio: <strong>{formatCOP(productToDelete.unit_price)}</strong></span>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Si el producto está vinculado a cotizaciones registradas, el sistema lo desactivará de forma segura para proteger la validez del historial y contratos.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => confirmDeleteProduct(false)}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Edit RETIE Tier */}
      <Modal
        isOpen={isTierModalOpen}
        onClose={() => setIsTierModalOpen(false)}
        title={editingTier ? `Modificar Tarifa: ${editingTier.name}` : 'Editar Tarifa RETIE'}
      >
        <form onSubmit={handleUpdateTier} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Valor Tarifa de Diseño (COP)
            </label>
            <input
              type="number"
              required
              value={tierPrice}
              onChange={(e) => setTierPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-base font-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsTierModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-xl shadow"
            >
              Actualizar Tarifa RETIE
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add New Category */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Crear Nueva Categoría de Productos"
      >
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Categoría *</label>
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              placeholder="Ej. Inversores Centrales, Microinversores, Cargadores EV..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ícono o Emoji Representativo</label>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {['📦', '☀️', '⚡', '🔋', '💧', '🎛️', '🏗️', '👷', '📑', '🔌', '🚗', '🌐', '🛠️'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewCatEmoji(emoji)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer ${
                    newCatEmoji === emoji ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingCategory}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
            >
              {savingCategory ? 'Creando...' : 'Crear Categoría'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
