const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Send SMS via Africa's Talking
async function sendSMS(phoneNumber, message) {
    try {
        const AfricasTalking = require('africastalking');
        const africastalking = AfricasTalking({
            apiKey: process.env.AT_API_KEY || '',
            username: process.env.AT_USERNAME || 'sandbox',
            from: process.env.AT_PHONE || ''
        });
        const sms = africastalking.SMS;
        await sms.send({
            to: [phoneNumber],
            message: message,
            from: process.env.AT_PHONE || ''
        });
        console.log('  SMS sent to ' + phoneNumber);
    } catch (err) {
        console.error('  SMS failed:', err.message || err);
    }
}

// POST /api/payments — Student submits a payment request
router.post('/', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { lessonId, transactionCode, phoneNumber, amount } = req.body;

        if (!lessonId || !transactionCode || !phoneNumber) {
            return res.status(400).json({ error: 'Missing required fields: lessonId, transactionCode, phoneNumber' });
        }

        // Check if lesson exists
        const [[lesson]] = await pool.query('SELECT id, title, price FROM lessons WHERE id = ?', [lessonId]);
        if (!lesson) {
            return res.status(404).json({ error: 'Lesson not found' });
        }

        // Check if already approved for this lesson
        const [[existing]] = await pool.query(
            'SELECT id FROM payments WHERE user_id = ? AND lesson_id = ? AND status = ?',
            [userId, lessonId, 'approved']
        );
        if (existing) {
            return res.status(400).json({ error: 'You already have access to this lesson' });
        }

        // Check for pending submission
        const [[pending]] = await pool.query(
            'SELECT id FROM payments WHERE user_id = ? AND lesson_id = ? AND status = ?',
            [userId, lessonId, 'pending']
        );
        if (pending) {
            return res.status(400).json({ error: 'You already have a pending payment for this lesson' });
        }

        // Get user info
        const [[user]] = await pool.query('SELECT username, phone_number FROM users WHERE id = ?', [userId]);
        const userPhone = user.phone_number || phoneNumber;

        // Insert payment
        const payAmount = amount || lesson.price || 0;
        const [result] = await pool.query(
            'INSERT INTO payments (user_id, lesson_id, transaction_code, phone_number, amount) VALUES (?, ?, ?, ?, ?)',
            [userId, lessonId, transactionCode, userPhone, payAmount]
        );

        // Send SMS notification to owner
        const smsMessage = [
            '🎓 New Payment — Modern Skills',
            '',
            'From: ' + (user.username || 'Unknown'),
            'Phone: ' + userPhone,
            'Code: ' + transactionCode,
            'Amount: ' + payAmount + ' RWF',
            'Lesson: ' + lesson.title,
            '',
            'Code: 239026',
            '',
            'Approve in admin panel.'
        ].join('\n');

        await sendSMS(process.env.OWNER_PHONE || '+250781853141', smsMessage);

        res.json({
            success: true,
            message: 'Payment submitted. Awaiting verification.',
            paymentId: result.insertId
        });
    } catch (err) {
        console.error('Payment submit error:', err);
        res.status(500).json({ error: 'Failed to submit payment' });
    }
});

// GET /api/payments/check — Check if user has access to a lesson
router.get('/check', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const lessonId = parseInt(req.query.lessonId);

        if (!lessonId) {
            return res.status(400).json({ error: 'lessonId is required' });
        }

        // Check if lesson is free
        const [[lesson]] = await pool.query('SELECT is_free FROM lessons WHERE id = ?', [lessonId]);
        if (lesson && lesson.is_free) {
            return res.json({ hasAccess: true, reason: 'free' });
        }

        // Check approved payment
        const [[approved]] = await pool.query(
            'SELECT id FROM payments WHERE user_id = ? AND lesson_id = ? AND status = ?',
            [userId, lessonId, 'approved']
        );

        res.json({
            hasAccess: !!approved,
            reason: approved ? 'approved' : 'no_payment'
        });
    } catch (err) {
        console.error('Payment check error:', err);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});

// GET /api/payments/check-all — Check if user has access to ANY lesson
router.get('/check-all', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const [approved] = await pool.query(
            'SELECT lesson_id FROM payments WHERE user_id = ? AND status = ?',
            [userId, 'approved']
        );

        const lessonIds = approved.map(r => r.lesson_id);
        res.json({ hasAccess: lessonIds.length > 0, lessonIds });
    } catch (err) {
        console.error('Payment check-all error:', err);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});

// GET /api/payments/admin — Admin lists all payments
router.get('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const [payments] = await pool.query(`
            SELECT p.*, u.username, u.email, u.phone_number AS user_phone, l.title AS lesson_title
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN lessons l ON p.lesson_id = l.id
            ORDER BY p.created_at DESC
        `);
        res.json({ payments });
    } catch (err) {
        console.error('Admin payments error:', err);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// GET /api/payments/admin/stats — Payment stats
router.get('/admin/stats', authenticate, requireAdmin, async (req, res) => {
    try {
        const [[stats]] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
                SUM(CASE WHEN status='approved' THEN amount ELSE 0 END) AS totalRevenue
            FROM payments
        `);
        res.json(stats);
    } catch (err) {
        console.error('Payment stats error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// PATCH /api/payments/:id/approve — Admin approves payment
router.patch('/:id/approve', authenticate, requireAdmin, async (req, res) => {
    try {
        const paymentId = req.params.id;
        const [[payment]] = await pool.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        if (payment.status === 'approved') {
            return res.status(400).json({ error: 'Payment already approved' });
        }

        await pool.query(
            "UPDATE payments SET status = 'approved', reviewed_at = NOW() WHERE id = ?",
            [paymentId]
        );

        // Send confirmation SMS to the user who paid
        const [[user]] = await pool.query('SELECT username, phone_number FROM users WHERE id = ?', [payment.user_id]);
        const [[lesson]] = await pool.query('SELECT title FROM lessons WHERE id = ?', [payment.lesson_id]);
        if (user && user.phone_number) {
            const confirmMsg = [
                '✅ Payment Approved — Modern Skills',
                '',
                'Hi ' + (user.username || 'Student') + '!',
                'Your payment for "' + (lesson ? lesson.title : 'Lesson') + '" has been approved.',
                'You can now watch the video. JazakAllahu Khairan!'
            ].join('\n');
            await sendSMS(user.phone_number, confirmMsg);
        }

        res.json({ success: true, message: 'Payment approved' });
    } catch (err) {
        console.error('Payment approve error:', err);
        res.status(500).json({ error: 'Failed to approve payment' });
    }
});

// PATCH /api/payments/:id/reject — Admin rejects payment
router.patch('/:id/reject', authenticate, requireAdmin, async (req, res) => {
    try {
        const paymentId = req.params.id;
        const { note } = req.body;
        const [[payment]] = await pool.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        await pool.query(
            "UPDATE payments SET status = 'rejected', admin_note = ?, reviewed_at = NOW() WHERE id = ?",
            [note || null, paymentId]
        );

        res.json({ success: true, message: 'Payment rejected' });
    } catch (err) {
        console.error('Payment reject error:', err);
        res.status(500).json({ error: 'Failed to reject payment' });
    }
});

// GET /api/payments/users — Admin lists all student users with access status
router.get('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT u.id, u.username, u.email, u.phone_number, u.full_name, u.created_at,
                   u.is_active,
                   CASE WHEN EXISTS (
                       SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.status = 'approved'
                   ) THEN 1 ELSE 0 END AS has_access,
                   (SELECT COUNT(*) FROM payments p WHERE p.user_id = u.id AND p.status = 'pending') AS pending_count,
                   (SELECT COUNT(*) FROM payments p WHERE p.user_id = u.id AND p.status = 'approved') AS approved_count
            FROM users u
            WHERE u.role = 'student'
            ORDER BY u.created_at DESC
        `);
        res.json({ users });
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/payments/grant-access/:userId — Admin grants access to a user
router.post('/grant-access/:userId', authenticate, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        const [[user]] = await pool.query('SELECT id, username FROM users WHERE id = ? AND role = ?', [userId, 'student']);
        if (!user) return res.status(404).json({ error: 'Student not found' });

        const [[existing]] = await pool.query(
            'SELECT id FROM payments WHERE user_id = ? AND status = ? LIMIT 1',
            [userId, 'approved']
        );
        if (existing) {
            return res.json({ success: true, message: 'User already has access' });
        }

        const [[firstLesson]] = await pool.query('SELECT id FROM lessons WHERE is_published = 1 LIMIT 1');
        const lessonId = firstLesson ? firstLesson.id : 1;

        await pool.query(
            'INSERT INTO payments (user_id, lesson_id, transaction_code, phone_number, amount, status, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
            [userId, lessonId, 'ADMIN-GRANT', 'admin', 0, 'approved']
        );

        res.json({ success: true, message: 'Access granted to ' + user.username });
    } catch (err) {
        console.error('Grant access error:', err);
        res.status(500).json({ error: 'Failed to grant access' });
    }
});

// POST /api/payments/revoke-access/:userId — Admin revokes access
router.post('/revoke-access/:userId', authenticate, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        await pool.query(
            "DELETE FROM payments WHERE user_id = ? AND status = 'approved' AND transaction_code = 'ADMIN-GRANT'",
            [userId]
        );
        res.json({ success: true, message: 'Access revoked' });
    } catch (err) {
        console.error('Revoke access error:', err);
        res.status(500).json({ error: 'Failed to revoke access' });
    }
});

module.exports = router;
