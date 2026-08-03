const express = require('express');
const path = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { uploadVideo, uploadImage } = require('../middleware/upload');

const router = express.Router();

router.post('/video', authenticate, requireAdmin, (req, res) => {
    uploadVideo.single('video')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: `Video exceeds maximum size of ${process.env.MAX_VIDEO_SIZE_MB || 500}MB` });
            }
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const filePath = `/uploads/videos/${req.file.filename}`;
        res.json({
            message: 'Video uploaded successfully',
            file: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                url: filePath,
                path: filePath
            }
        });
    });
});

router.post('/thumbnail', authenticate, requireAdmin, (req, res) => {
    uploadImage.single('thumbnail')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: `Image exceeds maximum size of ${process.env.MAX_IMAGE_SIZE_MB || 5}MB` });
            }
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const filePath = `/uploads/thumbnails/${req.file.filename}`;
        res.json({
            message: 'Thumbnail uploaded successfully',
            file: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                url: filePath,
                path: filePath
            }
        });
    });
});

module.exports = router;
