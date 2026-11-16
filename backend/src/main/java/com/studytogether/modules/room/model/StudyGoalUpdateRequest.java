package com.studytogether.modules.room.model;

import jakarta.validation.constraints.Size;

public record StudyGoalUpdateRequest(
        @Size(max = 60, message = "studyGoal must be at most 60 characters")
        String studyGoal,
        Boolean completed
) {
    public StudyGoalUpdateRequest {
        studyGoal = studyGoal != null ? studyGoal.trim() : null;
    }
}
