package com.studytogether.modules.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @Column(name = "id", length = 36, nullable = false)
    private String id;

    @Column(name = "email", length = 255, unique = true)
    private String email;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "nickname", length = 50, nullable = false)
    private String nickname;

    @Column(name = "avatar_sprite_id", length = 50, nullable = false)
    private String avatarSpriteId = "default_student";

    @Enumerated(EnumType.STRING)
    @Column(name = "auth_provider", nullable = false, columnDefinition = "ENUM('GUEST', 'LOCAL', 'GOOGLE')")
    private AuthProvider authProvider = AuthProvider.GUEST;

    @Column(name = "total_study_minutes", nullable = false)
    private long totalStudyMinutes = 0L;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    protected UserEntity() {}

    public UserEntity(String id, String nickname, String avatarSpriteId, AuthProvider authProvider) {
        this.id = id;
        this.nickname = nickname;
        this.avatarSpriteId = avatarSpriteId;
        this.authProvider = authProvider;
    }

    public String getId() { return id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public String getAvatarSpriteId() { return avatarSpriteId; }
    public void setAvatarSpriteId(String avatarSpriteId) { this.avatarSpriteId = avatarSpriteId; }
    public AuthProvider getAuthProvider() { return authProvider; }
    public void setAuthProvider(AuthProvider authProvider) { this.authProvider = authProvider; }
    public long getTotalStudyMinutes() { return totalStudyMinutes; }
    public void setTotalStudyMinutes(long totalStudyMinutes) { this.totalStudyMinutes = totalStudyMinutes; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
