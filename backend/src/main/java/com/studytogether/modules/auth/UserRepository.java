package com.studytogether.modules.auth;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserEntity, String> {
    Optional<UserEntity> findByEmail(String email);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE UserEntity u SET u.totalStudyMinutes = u.totalStudyMinutes + :durationMinutes WHERE u.id = :userId")
    int incrementTotalStudyMinutes(@Param("userId") String userId, @Param("durationMinutes") long durationMinutes);

    long countByAuthProviderNot(AuthProvider authProvider);

    long countByAuthProviderNotAndTotalStudyMinutesGreaterThan(AuthProvider authProvider, long totalStudyMinutes);

    @Query("""
            SELECT u FROM UserEntity u
            WHERE u.authProvider <> :excludedProvider
            ORDER BY u.totalStudyMinutes DESC, u.createdAt ASC, u.id ASC
            """)
    List<UserEntity> findLeaderboardUsers(
            @Param("excludedProvider") AuthProvider excludedProvider,
            Pageable pageable
    );

    @Query("""
            SELECT COUNT(u) FROM UserEntity u
            WHERE u.authProvider <> :excludedProvider
              AND (
                u.totalStudyMinutes > :minutes
                OR (u.totalStudyMinutes = :minutes
                    AND (u.createdAt < :createdAt OR (u.createdAt = :createdAt AND u.id < :userId)))
              )
            """)
    long countAheadInLeaderboard(
            @Param("excludedProvider") AuthProvider excludedProvider,
            @Param("minutes") long minutes,
            @Param("createdAt") Instant createdAt,
            @Param("userId") String userId
    );
}
