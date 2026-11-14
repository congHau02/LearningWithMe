package com.studytogether.modules.stats;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudySessionRepository extends JpaRepository<StudySessionEntity, Long> {
    List<StudySessionEntity> findByUserIdOrderByStartedAtDesc(String userId);

    List<StudySessionEntity> findTop50ByUserIdOrderByStartedAtDescIdDesc(String userId);

    long countByUserId(String userId);

    @Query("SELECT s.userId, COUNT(s.id) FROM StudySessionEntity s WHERE s.userId IN :userIds GROUP BY s.userId")
    List<Object[]> countSessionsByUserIds(@Param("userIds") Collection<String> userIds);
}
