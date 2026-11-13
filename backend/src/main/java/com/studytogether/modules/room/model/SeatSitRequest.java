package com.studytogether.modules.room.model;

import jakarta.validation.constraints.NotBlank;

public record SeatSitRequest(
        String tableId,
        @NotBlank(message = "seatId is required") String seatId
) {}
