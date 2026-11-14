package com.studytogether.modules.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserEntity, String> {
    Optional<UserEntity> findByEmail(String email);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE UserEntity u SET u.totalStudyMinutes = u.totalStudyMinutes + :durationMinutes WHERE u.id = :userId")
    int incrementTotalStudyMinutes(@Param("userId") String userId, @Param("durationMinutes") long durationMinutes);
}
