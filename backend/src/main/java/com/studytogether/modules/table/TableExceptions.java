package com.studytogether.modules.table;

import com.studytogether.config.BusinessException;
import java.net.URI;
import org.springframework.http.HttpStatus;

public final class TableExceptions {

    public static final URI NOT_SEATED_AT_TABLE_TYPE =
            URI.create("https://studytogether.com/problems/not-seated-at-table");
    public static final URI TABLE_PERMISSION_DENIED_TYPE =
            URI.create("https://studytogether.com/problems/table-permission-denied");
    public static final URI INVALID_TABLE_ACTION_TYPE =
            URI.create("https://studytogether.com/problems/invalid-table-action");
    public static final URI TARGET_NOT_SEATED_AT_TABLE_TYPE =
            URI.create("https://studytogether.com/problems/target-not-seated-at-table");
    public static final URI TABLE_CHAT_RATE_LIMIT_EXCEEDED_TYPE =
            URI.create("https://studytogether.com/problems/table-chat-rate-limit-exceeded");

    private TableExceptions() {}

    public static BusinessException notSeatedAtTable(String tableId) {
        return new BusinessException(
                HttpStatus.FORBIDDEN,
                "Not Seated At Table",
                "Learner is not seated at table '%s'".formatted(tableId),
                NOT_SEATED_AT_TABLE_TYPE
        );
    }

    public static BusinessException forbiddenControl(String reason) {
        return new BusinessException(
                HttpStatus.FORBIDDEN,
                "Table Permission Denied",
                reason,
                TABLE_PERMISSION_DENIED_TYPE
        );
    }

    public static BusinessException invalidAction(String reason) {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "Invalid Table Action",
                reason,
                INVALID_TABLE_ACTION_TYPE
        );
    }

    public static BusinessException targetNotSeatedAtTable(String targetUserId, String tableId) {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "Target Not Seated At Table",
                "Target user '%s' is not seated at table '%s'".formatted(targetUserId, tableId),
                TARGET_NOT_SEATED_AT_TABLE_TYPE
        );
    }

    public static BusinessException chatRateLimitExceeded(String userId) {
        return new BusinessException(
                HttpStatus.TOO_MANY_REQUESTS,
                "Table Chat Rate Limit Exceeded",
                "User '%s' is sending table chat messages too quickly. Please wait a moment.".formatted(userId),
                TABLE_CHAT_RATE_LIMIT_EXCEEDED_TYPE
        );
    }

    public static String resolveStompErrorCode(BusinessException ex) {
        if (NOT_SEATED_AT_TABLE_TYPE.equals(ex.getType())) return "NOT_SEATED_AT_TABLE";
        if (TABLE_PERMISSION_DENIED_TYPE.equals(ex.getType())) return "TABLE_PERMISSION_DENIED";
        if (INVALID_TABLE_ACTION_TYPE.equals(ex.getType())) return "INVALID_TABLE_ACTION";
        if (TARGET_NOT_SEATED_AT_TABLE_TYPE.equals(ex.getType())) return "TARGET_NOT_SEATED_AT_TABLE";
        if (TABLE_CHAT_RATE_LIMIT_EXCEEDED_TYPE.equals(ex.getType())) return "TABLE_CHAT_RATE_LIMIT_EXCEEDED";
        return switch (ex.getStatus()) {
            case FORBIDDEN -> "TABLE_PERMISSION_DENIED";
            case BAD_REQUEST -> "INVALID_TABLE_ACTION";
            default -> "STOMP_BUSINESS_ERROR";
        };
    }
}
