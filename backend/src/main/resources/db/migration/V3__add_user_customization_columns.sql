ALTER TABLE users
    ADD COLUMN equipped_hat_id VARCHAR(50) NOT NULL DEFAULT 'hat_none' AFTER avatar_sprite_id,
    ADD COLUMN equipped_desk_pet_id VARCHAR(50) NOT NULL DEFAULT 'pet_sprout_pot' AFTER equipped_hat_id;

INSERT IGNORE INTO character_items (id, item_name, item_type, required_study_minutes) VALUES
    ('student_glasses', 'Mọt Sách Kính Cận', 'SKIN', 0),
    ('student_hoodie', 'Lofi Chill Hoodie', 'SKIN', 0),
    ('student_sprout', 'Mầm Xanh Chăm Chỉ', 'SKIN', 0);
