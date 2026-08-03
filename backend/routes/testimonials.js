const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name_en, name_rw, role_en, role_rw, text_en, text_rw, initials, rating, sort_order FROM testimonials WHERE is_active = 1 ORDER BY sort_order ASC'
        );
        res.json({ testimonials: rows });
    } catch (err) {
        console.error('Get testimonials error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM testimonials ORDER BY sort_order ASC'
        );
        res.json({ testimonials: rows });
    } catch (err) {
        console.error('Get admin testimonials error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const { nameEn, nameRw, roleEn, roleRw, textEn, textRw, initials, rating, sortOrder } = req.body;
        if (!nameEn || !textEn) {
            return res.status(400).json({ error: 'Name and text (English) are required' });
        }
        const [result] = await pool.query(
            'INSERT INTO testimonials (name_en, name_rw, role_en, role_rw, text_en, text_rw, initials, rating, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nameEn, nameRw || nameEn, roleEn || '', roleRw || '', textEn, textRw || textEn, initials || nameEn.charAt(0).toUpperCase(), rating || 5, sortOrder || 0]
        );
        res.status(201).json({ message: 'Testimonial created', id: result.insertId });
    } catch (err) {
        console.error('Create testimonial error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { nameEn, nameRw, roleEn, roleRw, textEn, textRw, initials, rating, sortOrder, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE testimonials SET
                name_en = COALESCE(?, name_en),
                name_rw = COALESCE(?, name_rw),
                role_en = COALESCE(?, role_en),
                role_rw = COALESCE(?, role_rw),
                text_en = COALESCE(?, text_en),
                text_rw = COALESCE(?, text_rw),
                initials = COALESCE(?, initials),
                rating = COALESCE(?, rating),
                sort_order = COALESCE(?, sort_order),
                is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [nameEn, nameRw, roleEn, roleRw, textEn, textRw, initials, rating, sortOrder, isActive, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Testimonial not found' });
        }
        res.json({ message: 'Testimonial updated' });
    } catch (err) {
        console.error('Update testimonial error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM testimonials WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Testimonial not found' });
        }
        res.json({ message: 'Testimonial deleted' });
    } catch (err) {
        console.error('Delete testimonial error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
