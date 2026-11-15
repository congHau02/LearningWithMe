package com.studytogether.modules.stats;

import com.studytogether.config.BusinessException;
import java.net.URI;
import org.springframework.http.HttpStatus;

final class CustomizationExceptions {

    private static final URI ITEM_LOCKED_TYPE =
            URI.create("https://studytogether.com/problems/item-locked");
    private static final URI INVALID_ITEM_TYPE =
            URI.create("https://studytogether.com/problems/invalid-customization-item");

    private CustomizationExceptions() {}

    static BusinessException itemLocked(String itemNameOrId, int requiredMinutes, long currentMinutes) {
        return new BusinessException(
                HttpStatus.FORBIDDEN,
                "Character Item Locked",
                "Item '" + itemNameOrId + "' requires " + requiredMinutes
                        + " study minutes to unlock (current: " + currentMinutes + ")",
                ITEM_LOCKED_TYPE
        );
    }

    static BusinessException invalidItem(String detail) {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "Invalid Customization Item",
                detail,
                INVALID_ITEM_TYPE
        );
    }
}
