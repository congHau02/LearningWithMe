package com.studytogether.modules.stats;

public record EquippedCustomizationDto(
        String skinId,
        String hatId,
        String deskPetId
) {
    public static final String DEFAULT_SKIN_ID = "default_student";
    public static final String DEFAULT_HAT_ID = "hat_none";
    public static final String DEFAULT_DESK_PET_ID = "pet_sprout_pot";

    public static EquippedCustomizationDto defaults(String skinId) {
        String effectiveSkin = (skinId == null || skinId.isBlank()) ? DEFAULT_SKIN_ID : skinId;
        return new EquippedCustomizationDto(effectiveSkin, DEFAULT_HAT_ID, DEFAULT_DESK_PET_ID);
    }
}
