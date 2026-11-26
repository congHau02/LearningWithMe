package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SeatSitRequest(
        @Size(max = 64, message = "tableId must be at most 64 characters") String tableId,
        @NotBlank(message = "seatId is required") @Size(max = 64, message = "seatId must be at most 64 characters") String seatId,
        @Size(max = 64, message = "inviteCode must be at most 64 characters") String inviteCode
) {
    public SeatSitRequest(String tableId, String seatId) {
        this(tableId, seatId, null);
    }
}
