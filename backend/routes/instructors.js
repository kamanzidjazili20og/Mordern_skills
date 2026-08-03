const express = require('express');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, slug, bio, avatar_url, expertise FROM instructors WHERE is_active = 1 ORDER BY name ASC'
        );
        res.json({ instructors: rows });
    } catch (err) {
        console.error('Get instructors error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:slug', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, slug, bio, avatar_url, expertise, created_at FROM instructors WHERE slug = ? AND is_active = 1',
            [req.params.slug]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Instructor not found' });
        }

        const [lessons] = await pool.query(
            `SELECT id, title, slug, description, difficulty, duration_minutes, thumbnail_url,
                    rating, student_count, is_free, created_at
             FROM lessons
             WHERE instructor_id = ? AND is_published = 1
             ORDER BY created_at DESC`,
            [rows[0].id]
        );

        res.json({ instructor: rows[0], lessons });
    } catch (err) {
        console.error('Get instructor error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, slug, bio, avatarUrl, expertise } = req.body;
        if (!name || !slug) {
            return res.status(400).json({ error: 'Name and slug are required' });
        }

        const [result] = await pool.query(
            'INSERT INTO instructors (name, slug, bio, avatar_url, expertise) VALUES (?, ?, ?, ?, ?)',
            [name, slug, bio || null, avatarUrl || null, expertise || null]
        );

        res.status(201).json({ message: 'Instructor created', id: result.insertId });
    } catch (err) {
        console.error('Create instructor error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, slug, bio, avatarUrl, expertise, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE instructors SET
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                bio = COALESCE(?, bio),
                avatar_url = COALESCE(?, avatar_url),
                expertise = COALESCE(?, expertise),
                is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [name, slug, bio, avatarUrl, expertise, isActive, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Instructor not found' });
        }
        res.json({ message: 'Instructor updated' });
    } catch (err) {
        console.error('Update instructor error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM instructors WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Instructor not found' });
        }
        res.json({ message: 'Instructor deleted' });
    } catch (err) {
        console.error('Delete instructor error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
