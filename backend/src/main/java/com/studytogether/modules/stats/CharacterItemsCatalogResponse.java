package com.studytogether.modules.stats;

import java.util.List;

public record CharacterItemsCatalogResponse(
        long totalStudyMinutes,
        EquippedCustomizationDto equipped,
        List<CharacterItemDto> items
) {
    public CharacterItemsCatalogResponse {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
