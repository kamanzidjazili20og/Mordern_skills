const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, slug, description, icon_class, color, sort_order FROM categories WHERE is_active = 1 ORDER BY sort_order ASC'
        );
        res.json({ categories: rows });
    } catch (err) {
        console.error('Get categories error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:slug', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, slug, description, icon_class, color FROM categories WHERE slug = ? AND is_active = 1',
            [req.params.slug]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const [lessons] = await pool.query(
            `SELECT id, title, slug, description, difficulty, duration_minutes, thumbnail_url,
                    rating, student_count, is_free, is_featured, created_at
             FROM lessons
             WHERE category_id = ? AND is_published = 1
             ORDER BY created_at DESC`,
            [rows[0].id]
        );

        res.json({ category: rows[0], lessons });
    } catch (err) {
        console.error('Get category error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, slug, description, iconClass, color, sortOrder } = req.body;
        if (!name || !slug) {
            return res.status(400).json({ error: 'Name and slug are required' });
        }

        const [result] = await pool.query(
            'INSERT INTO categories (name, slug, description, icon_class, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
            [name, slug, description || null, iconClass || null, color || null, sortOrder || 0]
        );

        res.status(201).json({ message: 'Category created', id: result.insertId });
    } catch (err) {
        console.error('Create category error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, slug, description, iconClass, color, sortOrder, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE categories SET
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                description = COALESCE(?, description),
                icon_class = COALESCE(?, icon_class),
                color = COALESCE(?, color),
                sort_order = COALESCE(?, sort_order),
                is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [name, slug, description, iconClass, color, sortOrder, isActive, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json({ message: 'Category updated' });
    } catch (err) {
        console.error('Update category error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json({ message: 'Category deleted' });
    } catch (err) {
        console.error('Delete category error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
