package com.studytogether.modules.stats;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudySessionRepository extends JpaRepository<StudySessionEntity, Long> {
    List<StudySessionEntity> findByUserIdOrderByStartedAtDesc(String userId);

    List<StudySessionEntity> findTop50ByUserIdOrderByStartedAtDescIdDesc(String userId);

    long countByUserId(String userId);
}
