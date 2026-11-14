package com.studytogether.modules.room;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import java.util.function.Function;
import org.springframework.http.HttpStatus;

public final class ChatContentSupport {

    public static final int MAX_CHAT_LENGTH = 200;

    private ChatContentSupport() {}

    public static void requireValidPrincipal(AuthPrincipal principal) {
        if (principal == null || principal.userId() == null || principal.userId().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid user identity required to chat");
        }
    }

    public static String validateMessage(
            String trimmedContent,
            String label,
            Function<String, BusinessException> onInvalid
    ) {
        String content = trimmedContent == null ? "" : trimmedContent.trim();
        if (content.isEmpty()) {
            throw onInvalid.apply(label + " cannot be empty or blank");
        }
        if (content.length() > MAX_CHAT_LENGTH) {
            throw onInvalid.apply(label + " cannot exceed " + MAX_CHAT_LENGTH + " characters");
        }
        return content;
    }

    public static String nonBlankOrDefault(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }
}
