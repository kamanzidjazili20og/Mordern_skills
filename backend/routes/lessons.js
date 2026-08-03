const express = require('express');
const slugify = require('slugify');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { category, difficulty, instructor, search, featured, page = 1, limit = 12 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let sql = `
            SELECT l.id, l.title, l.slug, l.description, l.difficulty, l.duration_minutes,
                   l.thumbnail_url, l.rating, l.student_count, l.is_free, l.is_featured,
                   l.created_at,
                   c.name AS category_name, c.slug AS category_slug, c.color AS category_color,
                   i.name AS instructor_name, i.slug AS instructor_slug
            FROM lessons l
            LEFT JOIN categories c ON l.category_id = c.id
            LEFT JOIN instructors i ON l.instructor_id = i.id
            WHERE l.is_published = 1
        `;
        const params = [];

        if (category) {
            sql += ' AND c.slug = ?';
            params.push(category);
        }
        if (difficulty) {
            sql += ' AND l.difficulty = ?';
            params.push(difficulty);
        }
        if (instructor) {
            sql += ' AND i.slug = ?';
            params.push(instructor);
        }
        if (featured === 'true') {
            sql += ' AND l.is_featured = 1';
        }
        if (search) {
            sql += ' AND MATCH(l.title, l.description) AGAINST(? IN BOOLEAN MODE)';
            params.push(`+${search}*`);
        }

        const countResult = await pool.query(
            sql.replace(/SELECT l\.id[\s\S]*?FROM/, 'SELECT COUNT(*) AS total FROM'),
            params
        );
        const total = countResult[0][0].total;

        sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [rows] = await pool.query(sql, params);

        res.json({
            lessons: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Get lessons error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/recent', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT l.id, l.title, l.slug, l.difficulty, l.duration_minutes,
                    l.thumbnail_url, l.rating, l.student_count, l.is_free, l.created_at,
                    c.name AS category_name, c.slug AS category_slug, c.color AS category_color,
                    i.name AS instructor_name
             FROM lessons l
             LEFT JOIN categories c ON l.category_id = c.id
             LEFT JOIN instructors i ON l.instructor_id = i.id
             WHERE l.is_published = 1
             ORDER BY l.created_at DESC
             LIMIT 8`
        );
        res.json({ lessons: rows });
    } catch (err) {
        console.error('Get recent lessons error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const [[{ totalLessons }]] = await pool.query('SELECT COUNT(*) AS totalLessons FROM lessons WHERE is_published = 1');
        const [[{ totalStudents }]] = await pool.query('SELECT COALESCE(SUM(student_count), 0) AS totalStudents FROM lessons');
        const [[{ totalInstructors }]] = await pool.query('SELECT COUNT(*) AS totalInstructors FROM instructors WHERE is_active = 1');
        const [[{ avgRating }]] = await pool.query('SELECT ROUND(AVG(rating), 1) AS avgRating FROM lessons WHERE is_published = 1 AND rating > 0');
        const [[{ pendingReview }]] = await pool.query("SELECT COUNT(*) AS pendingReview FROM lessons WHERE is_published = 0");
        const [[{ thisMonth }]] = await pool.query("SELECT COUNT(*) AS thisMonth FROM lessons WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())");

        const [catCounts] = await pool.query(
            'SELECT c.id, c.name, c.slug, c.color, COUNT(l.id) AS lesson_count FROM categories c LEFT JOIN lessons l ON c.id = l.category_id AND l.is_published = 1 WHERE c.is_active = 1 GROUP BY c.id ORDER BY c.sort_order ASC'
        );

        res.json({
            stats: {
                totalLessons,
                totalStudents,
                totalInstructors,
                avgRating: avgRating || 0,
                pendingReview,
                thisMonth
            },
            categoryStats: catCounts
        });
    } catch (err) {
        console.error('Get stats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM lessons');

        const [rows] = await pool.query(
            `SELECT l.id, l.title, l.slug, l.difficulty, l.duration_minutes,
                    l.thumbnail_url, l.rating, l.student_count, l.is_published, l.is_free,
                    l.is_featured, l.created_at, l.updated_at,
                    l.category_id, l.instructor_id, l.video_url, l.video_file_path,
                    c.name AS category_name,
                    i.name AS instructor_name
             FROM lessons l
             LEFT JOIN categories c ON l.category_id = c.id
             LEFT JOIN instructors i ON l.instructor_id = i.id
             ORDER BY l.created_at DESC
             LIMIT ? OFFSET ?`,
            [parseInt(limit), offset]
        );

        res.json({
            lessons: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Get admin lessons error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:slug', async (req, res) => {
    try {
        const key = req.params.slug;
        const isId = /^\d+$/.test(key);
        const [rows] = await pool.query(
            `SELECT l.*, c.name AS category_name, c.slug AS category_slug,
                    i.name AS instructor_name, i.slug AS instructor_slug, i.bio AS instructor_bio,
                    i.avatar_url AS instructor_avatar
             FROM lessons l
             LEFT JOIN categories c ON l.category_id = c.id
             LEFT JOIN instructors i ON l.instructor_id = i.id
             WHERE ${isId ? 'l.id = ?' : 'l.slug = ?'} AND l.is_published = 1`,
            [key]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Lesson not found' });
        }

        const [tags] = await pool.query(
            `SELECT t.id, t.name, t.slug
             FROM tags t
             JOIN lesson_tags lt ON t.id = lt.tag_id
             WHERE lt.lesson_id = ?`,
            [rows[0].id]
        );

        res.json({ lesson: rows[0], tags });
    } catch (err) {
        console.error('Get lesson error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const {
            title, description, categoryId, instructorId, difficulty,
            durationMinutes, videoUrl, videoFilePath, thumbnailUrl, isFree, isFeatured,
            rating, studentCount,
            tags: tagNames
        } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const finalVideoUrl = videoFilePath ? null : (videoUrl || null);

        let slug = slugify(title, { lower: true, strict: true });
        const [existing] = await pool.query('SELECT id FROM lessons WHERE slug = ?', [slug]);
        if (existing.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        const [result] = await pool.query(
            `INSERT INTO lessons (title, slug, description, category_id, instructor_id, difficulty,
                                  duration_minutes, video_url, video_file_path, thumbnail_url,
                                  rating, student_count, is_free, is_featured)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, slug, description || null, categoryId || null, instructorId || null,
             difficulty || 'All Levels', durationMinutes || null, finalVideoUrl || null,
             videoFilePath || null, thumbnailUrl || null,
             rating == null ? null : rating, studentCount == null ? 0 : studentCount,
             isFree ? 1 : 0, isFeatured ? 1 : 0]
        );

        if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
            for (const tagName of tagNames) {
                const tagSlug = slugify(tagName, { lower: true, strict: true });
                let [tagRows] = await pool.query('SELECT id FROM tags WHERE slug = ?', [tagSlug]);
                let tagId;
                if (tagRows.length === 0) {
                    const [tagResult] = await pool.query('INSERT INTO tags (name, slug) VALUES (?, ?)', [tagName, tagSlug]);
                    tagId = tagResult.insertId;
                } else {
                    tagId = tagRows[0].id;
                }
                await pool.query('INSERT INTO lesson_tags (lesson_id, tag_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE lesson_id = lesson_id', [result.insertId, tagId]);
            }
        }

        res.status(201).json({ message: 'Lesson created', id: result.insertId, slug });
    } catch (err) {
        console.error('Create lesson error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const {
            title, description, categoryId, instructorId, difficulty,
            durationMinutes, videoUrl, videoFilePath, thumbnailUrl,
            isPublished, isFree, isFeatured, rating, studentCount
        } = req.body;

        const finalVideoUrl = videoFilePath ? null : ((videoUrl == null || videoUrl === '') ? null : videoUrl);

        const [result] = await pool.query(
            `UPDATE lessons SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                category_id = COALESCE(?, category_id),
                instructor_id = COALESCE(?, instructor_id),
                difficulty = COALESCE(?, difficulty),
                duration_minutes = COALESCE(?, duration_minutes),
                video_url = ?,
                video_file_path = COALESCE(?, video_file_path),
                thumbnail_url = COALESCE(?, thumbnail_url),
                is_published = COALESCE(?, is_published),
                is_free = COALESCE(?, is_free),
                is_featured = COALESCE(?, is_featured),
                rating = COALESCE(?, rating),
                student_count = COALESCE(?, student_count),
                published_at = CASE WHEN ? = 1 AND is_published = 0 THEN NOW() ELSE published_at END
             WHERE id = ?`,
            [title, description, categoryId, instructorId, difficulty, durationMinutes,
             finalVideoUrl, videoFilePath, thumbnailUrl, isPublished, isFree, isFeatured,
             rating == null ? null : rating, studentCount == null ? null : studentCount,
             isPublished, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lesson not found' });
        }
        res.json({ message: 'Lesson updated' });
    } catch (err) {
        console.error('Update lesson error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.patch('/:id/publish', authenticate, requireAdmin, async (req, res) => {
    try {
        const { isPublished } = req.body;
        const [result] = await pool.query(
            `UPDATE lessons SET is_published = ?, published_at = CASE WHEN ? = 1 AND is_published = 0 THEN NOW() ELSE published_at END WHERE id = ?`,
            [isPublished ? 1 : 0, isPublished ? 1 : 0, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lesson not found' });
        }
        res.json({ message: `Lesson ${isPublished ? 'published' : 'unpublished'}` });
    } catch (err) {
        console.error('Publish lesson error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM lessons WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lesson not found' });
        }
        res.json({ message: 'Lesson deleted' });
    } catch (err) {
        console.error('Delete lesson error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
