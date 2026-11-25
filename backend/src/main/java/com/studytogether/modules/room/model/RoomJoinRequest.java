package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RoomJoinRequest(
        @Size(max = 64, message = "preferredRoomId must be at most 64 characters") String preferredRoomId,
        @Size(max = 64, message = "preferredTableId must be at most 64 characters") String preferredTableId
) {}
