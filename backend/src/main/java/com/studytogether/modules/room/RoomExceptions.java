package com.studytogether.modules.room;

import com.studytogether.config.BusinessException;
import java.net.URI;
import org.springframework.http.HttpStatus;

public final class RoomExceptions {

    public static final URI TABLE_NOT_FOUND_TYPE =
            URI.create("https://studytogether.com/problems/table-not-found");
    public static final URI SEAT_NOT_FOUND_TYPE =
            URI.create("https://studytogether.com/problems/seat-not-found");
    public static final URI SEAT_TABLE_MISMATCH_TYPE =
            URI.create("https://studytogether.com/problems/seat-table-mismatch");
    public static final URI ROOM_FULL_TYPE =
            URI.create("https://studytogether.com/problems/room-full");
    public static final URI INVALID_MOVE_TYPE =
            URI.create("https://studytogether.com/problems/invalid-move");
    public static final URI SEAT_OCCUPIED_TYPE =
            URI.create("https://studytogether.com/problems/seat-occupied");
    public static final URI ALREADY_SEATED_TYPE =
            URI.create("https://studytogether.com/problems/already-seated");
    public static final URI NOT_SEATED_TYPE =
            URI.create("https://studytogether.com/problems/not-seated");
    public static final URI INVALID_CHAT_MESSAGE_TYPE =
            URI.create("https://studytogether.com/problems/invalid-chat-message");
    public static final URI CHAT_RATE_LIMIT_EXCEEDED_TYPE =
            URI.create("https://studytogether.com/problems/chat-rate-limit-exceeded");
    public static final URI INVALID_STUDY_GOAL_TYPE =
            URI.create("https://studytogether.com/problems/invalid-study-goal");

    private RoomExceptions() {}

    public static RoomNotFoundException roomNotFound(String roomId) {
        return new RoomNotFoundException(roomId);
    }

    public static BusinessException tableNotFound(String roomId, String tableId) {
        return new BusinessException(
                HttpStatus.NOT_FOUND,
                "Table Not Found",
                "Table '%s' does not exist in room '%s'".formatted(tableId, roomId),
                TABLE_NOT_FOUND_TYPE
        );
    }

    public static BusinessException seatNotFound(String roomId, String seatId) {
        return new BusinessException(
                HttpStatus.NOT_FOUND,
                "Seat Not Found",
                "Seat '%s' does not exist in room '%s'".formatted(seatId, roomId),
                SEAT_NOT_FOUND_TYPE
        );
    }

    public static BusinessException seatTableMismatch(String roomId, String tableId, String seatId) {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "Seat Table Mismatch",
                "Seat '%s' does not belong to table '%s' in room '%s'".formatted(seatId, tableId, roomId),
                SEAT_TABLE_MISMATCH_TYPE
        );
    }

    public static BusinessException roomFull(String roomId, int capacityLimit) {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "Room Shard Full",
                "Room '%s' has reached capacity limit of %d learners".formatted(roomId, capacityLimit),
                ROOM_FULL_TYPE
        );
    }

    public static BusinessException invalidMove(String reason) {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "Invalid Movement",
                reason,
                INVALID_MOVE_TYPE
        );
    }

    public static BusinessException seatOccupied(String roomId, String seatId) {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "Seat Occupied",
                "Seat '%s' is already occupied in room '%s'".formatted(seatId, roomId),
                SEAT_OCCUPIED_TYPE
        );
    }

    public static BusinessException alreadySeated(String roomId, String seatId) {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "Already Seated",
                "Learner is already seated in seat '%s' in room '%s'".formatted(seatId != null ? seatId : "unknown", roomId),
                ALREADY_SEATED_TYPE
        );
    }

    public static BusinessException notSeated(String roomId) {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "Not Seated",
                "Learner is not seated at any table in room '%s'".formatted(roomId),
                NOT_SEATED_TYPE
        );
    }

    public static BusinessException invalidChatMessage(String reason) {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "Invalid Chat Message",
                reason,
                INVALID_CHAT_MESSAGE_TYPE
        );
    }

    public static BusinessException chatRateLimitExceeded(String userId) {
        return new BusinessException(
                HttpStatus.TOO_MANY_REQUESTS,
                "Chat Rate Limit Exceeded",
                "Learner '%s' exceeded chat rate limit of 5 messages in 5 seconds".formatted(userId),
                CHAT_RATE_LIMIT_EXCEEDED_TYPE
        );
    }

    public static BusinessException invalidStudyGoal(String reason) {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "Invalid Study Goal",
                reason,
                INVALID_STUDY_GOAL_TYPE
        );
    }

    public static String resolveStompErrorCode(BusinessException ex) {
        if (SEAT_OCCUPIED_TYPE.equals(ex.getType())) return "SEAT_OCCUPIED";
        if (ALREADY_SEATED_TYPE.equals(ex.getType())) return "ALREADY_SEATED";
        if (NOT_SEATED_TYPE.equals(ex.getType())) return "NOT_SEATED";
        if (ROOM_FULL_TYPE.equals(ex.getType())) return "ROOM_FULL";
        if (INVALID_MOVE_TYPE.equals(ex.getType())) return "INVALID_MOVE";
        if (INVALID_CHAT_MESSAGE_TYPE.equals(ex.getType())) return "INVALID_CHAT_MESSAGE";
        if (CHAT_RATE_LIMIT_EXCEEDED_TYPE.equals(ex.getType())) return "RATE_LIMIT_EXCEEDED";
        if (INVALID_STUDY_GOAL_TYPE.equals(ex.getType())) return "INVALID_STUDY_GOAL";
        return switch (ex.getStatus()) {
            case NOT_FOUND -> "ROOM_NOT_FOUND";
            case CONFLICT -> "ROOM_FULL";
            case UNAUTHORIZED -> "UNAUTHORIZED";
            case BAD_REQUEST -> "INVALID_MOVE";
            default -> "STOMP_BUSINESS_ERROR";
        };
    }
}
