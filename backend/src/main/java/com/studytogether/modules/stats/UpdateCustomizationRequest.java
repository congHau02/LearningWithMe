package com.studytogether.modules.stats;

import jakarta.validation.constraints.Pattern;

public record UpdateCustomizationRequest(
        @Pattern(
                regexp = "^[a-zA-Z0-9_-]{1,50}$",
                message = "skinId must be 1 to 50 alphanumeric, underscore, or hyphen characters"
        )
        String skinId,

        @Pattern(
                regexp = "^[a-zA-Z0-9_-]{1,50}$",
                message = "hatId must be 1 to 50 alphanumeric, underscore, or hyphen characters"
        )
        String hatId,

        @Pattern(
                regexp = "^[a-zA-Z0-9_-]{1,50}$",
                message = "deskPetId must be 1 to 50 alphanumeric, underscore, or hyphen characters"
        )
        String deskPetId
) {
    public UpdateCustomizationRequest {
        skinId = normalize(skinId);
        hatId = normalize(hatId);
        deskPetId = normalize(deskPetId);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        return value.trim();
    }
}
