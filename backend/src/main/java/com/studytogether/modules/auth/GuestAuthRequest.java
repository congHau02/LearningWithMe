package com.studytogether.modules.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record GuestAuthRequest(
        @NotBlank(message = "nickname must not be blank")
        @Size(max = 20, message = "nickname must be at most 20 characters")
        String nickname,

        @Pattern(
                regexp = "^[a-zA-Z0-9_-]{1,50}$",
                message = "avatarId must be 1 to 50 alphanumeric, underscore, or hyphen characters"
        )
        String avatarId,

        @Size(max = 60, message = "studyGoal must be at most 60 characters")
        String studyGoal
) {
    public GuestAuthRequest {
        nickname = nickname != null ? nickname.trim() : null;
        avatarId = avatarId != null ? avatarId.trim() : null;
        studyGoal = studyGoal != null ? studyGoal.trim() : null;
    }
}
