// ============================================================
// Database auto-setup: creates missing tables and seeds the
// default admin + demo content so the app works on a fresh
// database (e.g. a new Railway MySQL instance) out of the box.
// Idempotent — safe to run on every server start.
// ============================================================
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nooracademy.com';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

const CREATE_TABLES = [
    `CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role ENUM('admin', 'student') NOT NULL DEFAULT 'student',
        avatar_url VARCHAR(500) DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email),
        INDEX idx_users_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        description TEXT DEFAULT NULL,
        icon_class VARCHAR(50) DEFAULT NULL,
        color VARCHAR(20) DEFAULT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_categories_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS instructors (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        bio TEXT DEFAULT NULL,
        avatar_url VARCHAR(500) DEFAULT NULL,
        expertise VARCHAR(255) DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_instructors_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS tags (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        INDEX idx_tags_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS lessons (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT DEFAULT NULL,
        category_id INT DEFAULT NULL,
        instructor_id INT DEFAULT NULL,
        difficulty ENUM('Beginner', 'Intermediate', 'Advanced', 'All Levels') NOT NULL DEFAULT 'All Levels',
        duration_minutes INT DEFAULT NULL,
        video_url VARCHAR(500) DEFAULT NULL,
        video_file_path VARCHAR(500) DEFAULT NULL,
        video_file_size BIGINT DEFAULT NULL,
        thumbnail_url VARCHAR(500) DEFAULT NULL,
        is_published TINYINT(1) NOT NULL DEFAULT 0,
        is_free TINYINT(1) NOT NULL DEFAULT 0,
        is_featured TINYINT(1) NOT NULL DEFAULT 0,
        rating DECIMAL(2,1) NOT NULL DEFAULT 0.0,
        student_count INT NOT NULL DEFAULT 0,
        published_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_lessons_slug (slug),
        INDEX idx_lessons_category (category_id),
        INDEX idx_lessons_instructor (instructor_id),
        INDEX idx_lessons_published (is_published),
        INDEX idx_lessons_featured (is_featured),
        INDEX idx_lessons_difficulty (difficulty),
        INDEX idx_lessons_created (created_at),
        FULLTEXT INDEX idx_lessons_search (title, description),
        CONSTRAINT fk_lessons_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_lessons_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS lesson_tags (
        lesson_id INT NOT NULL,
        tag_id INT NOT NULL,
        PRIMARY KEY (lesson_id, tag_id),
        CONSTRAINT fk_lesson_tags_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_lesson_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS enrollments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        lesson_id INT NOT NULL,
        enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_enrollment (user_id, lesson_id),
        INDEX idx_enrollments_user (user_id),
        INDEX idx_enrollments_lesson (lesson_id),
        CONSTRAINT fk_enrollments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_enrollments_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS lesson_progress (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        lesson_id INT NOT NULL,
        progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        last_watched_position INT NOT NULL DEFAULT 0,
        is_completed TINYINT(1) NOT NULL DEFAULT 0,
        completed_at TIMESTAMP NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_progress (user_id, lesson_id),
        INDEX idx_progress_user (user_id),
        INDEX idx_progress_lesson (lesson_id),
        CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS contact_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        subject VARCHAR(255) DEFAULT NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_messages_read (is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS testimonials (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name_en VARCHAR(100) NOT NULL,
        name_rw VARCHAR(100) NOT NULL,
        role_en VARCHAR(100) NOT NULL,
        role_rw VARCHAR(100) NOT NULL,
        text_en TEXT NOT NULL,
        text_rw TEXT NOT NULL,
        initials VARCHAR(4) NOT NULL,
        rating INT NOT NULL DEFAULT 5,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS user_preferences (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        pref_key VARCHAR(50) NOT NULL,
        pref_value VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_pref (user_id, pref_key),
        CONSTRAINT fk_pref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

async function createTables() {
    for (const sql of CREATE_TABLES) {
        await pool.query(sql);
    }
}

async function ensureAdmin() {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
    if (rows.length > 0) return;
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await pool.query(
        'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [ADMIN_USERNAME, ADMIN_EMAIL, passwordHash, 'Admin User', 'admin']
    );
    console.log('  ✓ Admin user created (' + ADMIN_EMAIL + ' / ' + ADMIN_PASSWORD + ')');
}

async function seedIfEmpty(table, insertSql, values) {
    const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM ' + table);
    if (c > 0) return;
    await pool.query(insertSql, values);
    console.log('  ✓ Seeded ' + table);
}

async function seedDemoContent() {
    await seedIfEmpty('categories',
        `INSERT INTO categories (name, slug, description, icon_class, color, sort_order) VALUES ?`,
        [['Tajweed', 'tajweed', 'Master Quran recitation with proper pronunciation and rules', 'fa-voice', 'gold', 1],
         ['Tafsir', 'tafsir', 'Deep understanding of Quranic verses and their meanings', 'fa-book-open', 'green', 2],
         ['Hifz', 'hifz', 'Structured memorization program with revision tracking', 'fa-brain', 'blue', 3],
         ['Arabic', 'arabic', 'Learn classical Arabic to understand the Quran directly', 'fa-language', 'purple', 4],
         ['Video Course', 'video-course', 'Comprehensive recorded courses with expert instructors', 'fa-video', 'rose', 5]]
    );

    await seedIfEmpty('instructors',
        `INSERT INTO instructors (name, slug, bio, expertise) VALUES ?`,
        [['Sheikh Ahmad Al-Misri', 'sheikh-ahmad-al-misri', 'Expert Quran reciter and Tajweed teacher with 15+ years of experience', 'Tajweed, Qiraat'],
         ['Dr. Aminah Al-Arabi', 'dr-aminah-al-arabi', 'PhD in Islamic Studies specializing in Quranic Tafsir', 'Tafsir, Islamic Studies'],
         ['Hafiz Yusuf Khan', 'hafiz-yusuf-khan', 'Certified Hafiz with Ijaza in Hifz and extensive teaching experience', 'Hifz, Memorization Techniques'],
         ['Ustadh Omar Farooq', 'ustadh-omar-farooq', 'Arabic language specialist and Islamic studies instructor', 'Arabic Grammar, Fiqh']]
    );

    await seedIfEmpty('tags',
        `INSERT INTO tags (name, slug) VALUES ?`,
        [['tajweed', 'tajweed'], ['noon-sakinah', 'noon-sakinah'], ['pronunciation', 'pronunciation'],
         ['makharij', 'makharij'], ['sifaat', 'sifaat'], ['tafsir', 'tafsir'], ['al-fatiha', 'al-fatiha'],
         ['al-kahf', 'al-kahf'], ['hifz', 'hifz'], ['memorization', 'memorization'], ['juz-amma', 'juz-amma'],
         ['arabic', 'arabic'], ['grammar', 'grammar'], ['beginner', 'beginner'], ['advanced', 'advanced']]
    );

    await seedIfEmpty('lessons',
        `INSERT INTO lessons (title, slug, description, category_id, instructor_id, difficulty, duration_minutes, video_url, rating, student_count, is_published, is_featured, created_at) VALUES ?`,
        [['Makhaarij & Sifaat', 'makhaarij-sifaat', 'Learn the essential points of articulation (Makhaarij) and characteristics (Sifaat) of Arabic letters.', 1, 1, 'Beginner', 28, 'https://www.youtube.com/watch?v=O2wSMWemJDU', 5.0, 234, 1, 1, '2026-07-25 10:00:00'],
         ['Surah Al-Fatiha Tafsir', 'surah-al-fatiha-tafsir', 'Deep dive into the meanings and lessons of Surah Al-Fatiha, the opening chapter of the Quran.', 2, 2, 'All Levels', 35, 'https://www.youtube.com/watch?v=0lMkdXrCCrg', 4.9, 567, 1, 1, '2026-07-22 10:00:00'],
         ['Juz Amma — Surah An-Naba', 'juz-amma-surah-an-naba', 'Memorize Surah An-Naba with proper Tajweed using our step-by-step repetition method.', 3, 3, 'Beginner', 22, 'https://www.youtube.com/watch?v=oSppMwLcfS0', 4.8, 892, 1, 1, '2026-07-20 10:00:00'],
         ['Arabic Grammar Essentials', 'arabic-grammar-essentials', 'Master the three parts of speech in Arabic: nouns, verbs, and particles.', 4, 4, 'Beginner', 42, 'https://www.youtube.com/watch?v=OoVhY3rcXS8', 4.7, 345, 0, 0, '2026-07-18 10:00:00'],
         ['Noon Sakinah & Tanween', 'noon-sakinah-tanween', 'Comprehensive guide to the rules of Noon Sakinah and Tanween.', 1, 1, 'Intermediate', 31, 'https://www.youtube.com/watch?v=ALGAanskdXs', 4.9, 178, 0, 0, '2026-07-15 10:00:00'],
         ['Tafsir Ayatul Kursi', 'tafsir-ayatul-kursi', 'Explore the greatest verse of the Quran — Ayatul Kursi.', 2, 2, 'All Levels', 25, 'https://www.youtube.com/watch?v=4fvwdWdfEHI', 4.9, 912, 1, 1, '2026-07-12 10:00:00'],
         ['Al-Fatiha Memorization', 'al-fatiha-memorization', 'Memorize Surah Al-Fatiha with correct Tajweed using easy repetition techniques.', 3, 3, 'Beginner', 18, 'https://www.youtube.com/watch?v=Ca2nxrD8x-g', 4.8, 423, 1, 0, '2026-07-10 10:00:00'],
         ['Madd Rules — Extended Letters', 'madd-rules-extended-letters', 'Learn all the Madd rules — natural prolongation, compulsory Madd, and permissible Madd.', 1, 1, 'Advanced', 26, 'https://www.youtube.com/watch?v=iMIHgkkOJco', 4.9, 156, 0, 0, '2026-07-08 10:00:00'],
         ['Arabic Verb Conjugation', 'arabic-verb-conjugation', 'Understand Arabic verb conjugation patterns — past, present, and command forms.', 4, 4, 'Intermediate', 38, 'https://www.youtube.com/watch?v=OoVhY3rcXS8', 4.7, 289, 1, 0, '2026-07-05 10:00:00'],
         ['Juz Tabarak — Surah Al-Mulk', 'juz-tabarak-surah-al-mulk', 'Memorize Surah Al-Mulk with proper Tajweed.', 3, 3, 'Intermediate', 20, 'https://www.youtube.com/watch?v=Ca2nxrD8x-g', 4.8, 312, 0, 0, '2026-07-02 10:00:00'],
         ['Complete Tajweed Course Overview', 'complete-tajweed-course-overview', 'Overview of our complete Tajweed course covering all major rules.', 5, 1, 'All Levels', 12, 'https://www.youtube.com/watch?v=iMIHgkkOJco', 5.0, 1250, 1, 0, '2026-06-28 10:00:00'],
         ['Tafsir of Surah Yaseen', 'tafsir-of-surah-yaseen', 'Detailed Tafsir of Surah Yaseen — the heart of the Quran.', 2, 2, 'Advanced', 45, 'https://www.youtube.com/watch?v=MzijGS3Zo_0', 4.9, 734, 0, 0, '2026-06-25 10:00:00']]
    );

    await seedIfEmpty('testimonials',
        `INSERT INTO testimonials (name_en, name_rw, role_en, role_rw, text_en, text_rw, initials, rating, sort_order) VALUES ?`,
        [['Fatima Ahmed', 'Fatima Ahmed', 'Student since 2025', 'Umunyeshuri kuva 2025', 'Noor Academy transformed my Quran learning journey. The Tajweed lessons are incredibly clear and the instructors are so patient. I finally feel confident in my recitation.', 'Noor Academy yahinduye urugendo rwanjye rwo kwiga Quran. Amasomo ya Tajweed asobanutse cyane kandi abigisha bafite ihangane. Nongeye kwizera mu gusoma kwanjye.', 'FA', 5, 1],
         ['Omar Khalid', 'Omar Khalid', 'Student since 2024', 'Umunyeshuri kuva 2024', 'Alhamdulillah, I started as a complete beginner and now I can read Arabic script fluently. The structured curriculum makes all the difference. Highly recommended!', 'Alhamdulillah, natangiye nk\'umutangizi wuzuye noneho nshobora gusoma inyandiko y\'icyarabu neza. Gahunda y\'amasomo itunganijwe niyo itanga itandukaniro. Ndabyifuriza cyane!', 'OK', 5, 2],
         ['Aisha Noor', 'Aisha Noor', 'Parent of student', 'Umubyeyi w\'umunyeshuri', 'The Hifz program is amazing! My son has memorized 5 Juz in just 6 months thanks to the effective repetition techniques taught by Hafiz Yusuf Khan.', 'Gahunda ya Hifz irababaje! Umuhungu wanjye yibukije Juz 5 mu mezi 6 gusa kubera tekiniki nziza zo gusubiramo zigishwa na Hafiz Yusuf Khan.', 'AN', 5, 3]]
    );
}

async function initDatabase() {
    console.log('Checking database setup...');
    try {
        await createTables();
        console.log('  ✓ Tables ready');
        await ensureAdmin();
        await seedDemoContent();
        console.log('Database setup complete.');
    } catch (err) {
        console.error('Database setup failed:', err.message);
    }
}

module.exports = { initDatabase, pool };
