package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SeatSitRequest(
        String tableId,
        @NotBlank(message = "seatId is required") String seatId,
        String inviteCode
) {
    public SeatSitRequest(String tableId, String seatId) {
        this(tableId, seatId, null);
    }
}
