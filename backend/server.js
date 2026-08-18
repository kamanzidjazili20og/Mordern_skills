const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const { initDatabase } = require('./init');
const pool = require('./config/db');
const { getDbConfig } = require('./config/db');

app.get('/api/health', async (req, res) => {
    let db = 'error';
    try {
        await pool.query('SELECT 1');
        db = 'ok';
    } catch (e) {
        db = 'error';
    }
    res.json({
        status: 'ok',
        db,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const instructorRoutes = require('./routes/instructors');
const lessonRoutes = require('./routes/lessons');
const uploadRoutes = require('./routes/upload');
const testimonialRoutes = require('./routes/testimonials');
const preferenceRoutes = require('./routes/preferences');
const paymentRoutes = require('./routes/payments');

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/payments', paymentRoutes);

// Serve the frontend (index.html, admin.html, video.html, Images/) from the repo root.
app.use(express.static(path.join(__dirname, '..')));

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
});

app.listen(PORT, () => {
    console.log(`Modern Skills API server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    const dbCfg = getDbConfig();
    console.log(`Database: ${dbCfg.user}@${dbCfg.host}:${dbCfg.port}/${dbCfg.database}`);
});

initDatabase().then(() => {
    console.log('Database setup finished.');
}).catch(err => {
    console.error('Database init error:', err.message);
});

module.exports = app;
