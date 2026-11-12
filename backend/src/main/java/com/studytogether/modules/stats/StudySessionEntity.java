package com.studytogether.modules.stats;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "study_sessions")
public class StudySessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", length = 36, nullable = false)
    private String userId;

    @Column(name = "room_id", length = 50, nullable = false)
    private String roomId;

    @Column(name = "table_id", length = 50, nullable = false)
    private String tableId;

    @Column(name = "study_goal", length = 120)
    private String studyGoal;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at", nullable = false)
    private Instant endedAt;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    protected StudySessionEntity() {}

    public StudySessionEntity(
            String userId,
            String roomId,
            String tableId,
            String studyGoal,
            Instant startedAt,
            Instant endedAt,
            int durationMinutes
    ) {
        this.userId = userId;
        this.roomId = roomId;
        this.tableId = tableId;
        this.studyGoal = studyGoal;
        this.startedAt = startedAt;
        this.endedAt = endedAt;
        this.durationMinutes = durationMinutes;
    }

    public Long getId() { return id; }
    public String getUserId() { return userId; }
    public String getRoomId() { return roomId; }
    public String getTableId() { return tableId; }
    public String getStudyGoal() { return studyGoal; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public int getDurationMinutes() { return durationMinutes; }
}
