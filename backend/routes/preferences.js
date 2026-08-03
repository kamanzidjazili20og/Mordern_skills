const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT pref_key, pref_value FROM user_preferences WHERE user_id = ?',
            [req.user.id]
        );
        const prefs = {};
        rows.forEach(r => { prefs[r.pref_key] = r.pref_value; });
        res.json({ preferences: prefs });
    } catch (err) {
        console.error('Get preferences error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/', authenticate, async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) {
            return res.status(400).json({ error: 'Key is required' });
        }
        await pool.query(
            'INSERT INTO user_preferences (user_id, pref_key, pref_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE pref_value = ?, updated_at = NOW()',
            [req.user.id, key, value, value]
        );
        res.json({ message: 'Preference saved' });
    } catch (err) {
        console.error('Save preference error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
