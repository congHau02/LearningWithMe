package com.studytogether.modules.room;

import com.studytogether.config.BusinessException;
import java.net.URI;
import org.springframework.http.HttpStatus;

public class RoomNotFoundException extends BusinessException {

    private static final URI ROOM_NOT_FOUND_TYPE =
            URI.create("https://studytogether.com/problems/room-not-found");

    public RoomNotFoundException(String roomId) {
        super(
                HttpStatus.NOT_FOUND,
                "Room Not Found",
                "Room '%s' does not exist".formatted(roomId),
                ROOM_NOT_FOUND_TYPE
        );
    }
}
