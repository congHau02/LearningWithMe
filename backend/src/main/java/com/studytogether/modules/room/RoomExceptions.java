package com.studytogether.modules.room;

import com.studytogether.config.BusinessException;
import java.net.URI;
import org.springframework.http.HttpStatus;

public final class RoomExceptions {

    private static final URI TABLE_NOT_FOUND_TYPE =
            URI.create("https://studytogether.com/problems/table-not-found");
    private static final URI SEAT_NOT_FOUND_TYPE =
            URI.create("https://studytogether.com/problems/seat-not-found");
    private static final URI SEAT_TABLE_MISMATCH_TYPE =
            URI.create("https://studytogether.com/problems/seat-table-mismatch");

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
}
