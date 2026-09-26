import express from 'express';
import { db } from '../db.js';
import { authenticateToken, requirePermission, requireAdmin } from './auth.js';

const router = express.Router();

// Get products with filters
router.get('/', authenticateToken, (req, res) => {
  try {
    const { category, system_type, search, active } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (system_type && system_type !== 'all') {
      query += ' AND (system_type = ? OR system_type = "all")';
      params.push(system_type);
    }

    if (active !== undefined && active !== 'all') {
      query += ' AND active = ?';
      params.push(active === 'true' || active === '1' ? 1 : 0);
    }

    if (search && search.trim() !== '') {
      query += ' AND (name LIKE ? OR brand LIKE ? OR model LIKE ? OR description LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY category ASC, name ASC';

    const products = db.prepare(query).all(...params);
    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get RETIE design pricing tiers
router.get('/retie-tiers', authenticateToken, (req, res) => {
  try {
    const tiers = db.prepare('SELECT * FROM retie_design_tiers ORDER BY min_kw ASC').all();
    res.json({ tiers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all categories (predefined + custom + from products)
router.get('/categories', authenticateToken, (req, res) => {
  try {
    let dbCats = [];
    try {
      dbCats = db.prepare('SELECT id, name, label, icon FROM product_categories ORDER BY id ASC').all();
    } catch (e) {}

    const prodCats = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""').all();
    
    const categoryMap = new Map();
    const defaults = [
      { id: 'all', label: 'Todos' },
      { id: 'paneles', label: '☀️ Paneles Solares', icon: 'SunMedium' },
      { id: 'inversores', label: '⚡ Inversores', icon: 'Zap' },
      { id: 'baterias', label: '🔋 Baterías Litio/Gel', icon: 'BatteryCharging' },
      { id: 'bombas', label: '💧 Bombeo Solar', icon: 'Droplets' },
      { id: 'variadores', label: '🎛️ Variadores Solares', icon: 'Layers' },
      { id: 'estructuras', label: '🏗️ Estructuras', icon: 'Wrench' },
      { id: 'mdo', label: '👷 Mano de Obra', icon: 'Wrench' },
      { id: 'legalizacion', label: '📑 Legalización & RETIE', icon: 'ShieldCheck' },
      { id: 'accesorios', label: '🔌 Accesorios', icon: 'Package' }
    ];

    defaults.forEach(d => categoryMap.set(d.id, d));
    dbCats.forEach(c => {
      categoryMap.set(c.name, { id: c.name, label: c.label || c.name, icon: c.icon || 'Package' });
    });
    prodCats.forEach(p => {
      const slug = p.category;
      if (!categoryMap.has(slug)) {
        categoryMap.set(slug, { id: slug, label: `📦 ${slug.charAt(0).toUpperCase() + slug.slice(1)}`, icon: 'Package' });
      }
    });

    res.json({ categories: Array.from(categoryMap.values()) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new category (Admin only)
router.post('/categories', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, label, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    }
    const cleanSlug = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const cleanLabel = (label && label.trim()) || name.trim();
    const cleanIcon = icon || 'Package';

    try {
      db.prepare('INSERT INTO product_categories (name, label, icon) VALUES (?, ?, ?)')
        .run(cleanSlug, cleanLabel, cleanIcon);
    } catch (dbErr) {
      if (dbErr.message && dbErr.message.includes('UNIQUE')) {
        return res.status(400).json({ error: `La categoría "${cleanLabel}" ya existe.` });
      }
      throw dbErr;
    }

    res.status(201).json({
      message: 'Categoría agregada exitosamente',
      category: { id: cleanSlug, label: cleanLabel, icon: cleanIcon }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update RETIE design tier price (Admin only)
router.put('/retie-tiers/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { price } = req.body;
    db.prepare('UPDATE retie_design_tiers SET price = ? WHERE id = ?').run(parseFloat(price), req.params.id);
    res.json({ message: 'Tarifa de diseño RETIE actualizada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create product
router.post('/', authenticateToken, requirePermission('products'), (req, res) => {
  try {
    const {
      category, name, brand, model, power_w, voltage,
      capacity_ah, system_type, unit_price, cost_price, unit, description
    } = req.body;

    if (!name || !category || unit_price === undefined) {
      return res.status(400).json({ error: 'Categoría, nombre y precio son obligatorios.' });
    }

    const result = db.prepare(`
      INSERT INTO products (
        category, name, brand, model, power_w, voltage,
        capacity_ah, system_type, unit_price, cost_price, unit, description, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      category, name.trim(), brand || '', model || '',
      parseFloat(power_w) || 0, voltage || '', parseFloat(capacity_ah) || 0,
      system_type || 'all', parseFloat(unit_price) || 0,
      parseFloat(cost_price) || 0, unit || 'unidad', description || ''
    );

    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Producto agregado exitosamente', product: newProduct });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update product
router.put('/:id', authenticateToken, requirePermission('products'), (req, res) => {
  try {
    const prodId = parseInt(req.params.id);
    const {
      category, name, brand, model, power_w, voltage,
      capacity_ah, system_type, unit_price, cost_price, unit, description, active
    } = req.body;

    db.prepare(`
      UPDATE products SET
        category = ?, name = ?, brand = ?, model = ?, power_w = ?, voltage = ?,
        capacity_ah = ?, system_type = ?, unit_price = ?, cost_price = ?, unit = ?,
        description = ?, active = ?
      WHERE id = ?
    `).run(
      category, name, brand, model,
      parseFloat(power_w) || 0, voltage, parseFloat(capacity_ah) || 0,
      system_type, parseFloat(unit_price) || 0,
      parseFloat(cost_price) || 0, unit, description,
      active !== undefined ? (active ? 1 : 0) : 1,
      prodId
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
    res.json({ message: 'Producto actualizado con éxito', product: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete product (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const prodId = parseInt(req.params.id);
    const force = req.query.force === 'true';

    // Check if product exists
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Check if referenced by quotes
    const quotesCount = db.prepare('SELECT COUNT(*) as count FROM quotes WHERE panel_model_id = ?').get(prodId)?.count || 0;

    if (quotesCount > 0) {
      if (force) {
        db.prepare('UPDATE quotes SET panel_model_id = NULL WHERE panel_model_id = ?').run(prodId);
        db.prepare('DELETE FROM products WHERE id = ?').run(prodId);
        return res.json({ message: `Producto "${product.name}" eliminado permanentemente (${quotesCount} cotizaciones desvinculadas)` });
      } else {
        // Safe deactivate
        db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(prodId);
        return res.json({
          message: `El producto "${product.name}" está vinculado a ${quotesCount} cotización(es). Se ha desactivado del catálogo para no alterar el historial.`,
          deactivated: true
        });
      }
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(prodId);
    res.json({ message: `Producto "${product.name}" eliminado permanentemente` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
