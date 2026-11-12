CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NULL,
    password_hash VARCHAR(255) NULL,
    nickname VARCHAR(50) NOT NULL,
    avatar_sprite_id VARCHAR(50) NOT NULL DEFAULT 'default_student',
    auth_provider ENUM('GUEST', 'LOCAL', 'GOOGLE') NOT NULL DEFAULT 'GUEST',
    total_study_minutes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE study_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    room_id VARCHAR(50) NOT NULL,
    table_id VARCHAR(50) NOT NULL,
    study_goal VARCHAR(120),
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NOT NULL,
    duration_minutes INT NOT NULL,
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE character_items (
    id VARCHAR(50) PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    item_type ENUM('SKIN', 'HAT', 'DESK_PET') NOT NULL,
    required_study_minutes INT NOT NULL DEFAULT 0
);

INSERT INTO character_items (id, item_name, item_type, required_study_minutes) VALUES
    ('default_student', 'Học Sinh Mặc Định', 'SKIN', 0),
    ('skin_hoodie_blue', 'Áo Hoodie Xanh Thư Viện', 'SKIN', 60),
    ('skin_scholar_blazer', 'Áo Khoác Học Giả', 'SKIN', 300),
    ('hat_none', 'Không Đội Mũ', 'HAT', 0),
    ('hat_headphones', 'Tai Nghe Lofi Chống Ồn', 'HAT', 120),
    ('hat_graduation_cap', 'Mũ Cử Nhân Vinh Quang', 'HAT', 600),
    ('pet_sprout_pot', 'Chậu Cây Mầm Nhỏ', 'DESK_PET', 0),
    ('pet_sleepy_cat', 'Mèo Vàng Ngủ Gật', 'DESK_PET', 180),
    ('pet_wise_owl', 'Cú Đêm Thông Thái', 'DESK_PET', 480);
