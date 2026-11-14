CREATE INDEX idx_users_leaderboard ON users (auth_provider, total_study_minutes DESC, created_at ASC, id ASC);
