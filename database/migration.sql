USE noor_academy;

-- ============================================================
-- TESTIMONIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS testimonials (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO testimonials (name_en, name_rw, role_en, role_rw, text_en, text_rw, initials, rating, sort_order) VALUES
('Fatima Ahmed', 'Fatima Ahmed', 'Student since 2025', 'Umunyeshuri kuva 2025', 'Modern Skills transformed my Quran learning journey. The Tajweed lessons are incredibly clear and the instructors are so patient. I finally feel confident in my recitation.', 'Modern Skills yahinduye urugendo rwanjye rwo kwiga Quran. Amasomo ya Tajweed asobanutse cyane kandi abigisha bafite ihangane. Nongeye kwizera mu gusoma kwanjye.', 'FA', 5, 1),
('Omar Khalid', 'Omar Khalid', 'Student since 2024', 'Umunyeshuri kuva 2024', 'Alhamdulillah, I started as a complete beginner and now I can read Arabic script fluently. The structured curriculum makes all the difference. Highly recommended!', 'Alhamdulillah, natangiye nk''umutangizi wuzuye noneho nshobora gusoma inyandiko y''icyarabu neza. Gahunda y''amasomo itunganijwe niyo itanga itandukaniro. Ndabyifuriza cyane!', 'OK', 5, 2),
('Aisha Noor', 'Aisha Noor', 'Parent of student', 'Umubyeyi w''umunyeshuri', 'The Hifz program is amazing! My son has memorized 5 Juz in just 6 months thanks to the effective repetition techniques taught by Hafiz Yusuf Khan.', 'Gahunda ya Hifz irababaje! Umuhungu wanjye yibukije Juz 5 mu mezi 6 gusa kubera tekiniki nziza zo gusubiramo zigishwa na Hafiz Yusuf Khan.', 'AN', 5, 3);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    pref_key VARCHAR(50) NOT NULL,
    pref_value VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_pref (user_id, pref_key),
    CONSTRAINT fk_pref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PAYMENTS (MoMo payment verification)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    lesson_id INT NOT NULL,
    transaction_code VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    admin_note TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    INDEX idx_payments_user (user_id),
    INDEX idx_payments_lesson (lesson_id),
    INDEX idx_payments_status (status),
    CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_payments_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
