package com.studytogether.modules.room;

public record SeatMetadata(
        String seatId,
        String tableId,
        int tileX,
        int tileY,
        FacingDirection facingDir
) {
    public TileCoordinate coordinate() {
        return new TileCoordinate(tileX, tileY);
    }
}
