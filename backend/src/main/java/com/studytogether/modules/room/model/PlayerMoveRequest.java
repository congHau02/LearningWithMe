package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PlayerMoveRequest(
        @JsonAlias("tileX") int x,
        @JsonAlias("tileY") int y,
        @JsonAlias("dir") String facingDir,
        Boolean isMoving
) {
    public boolean moving() {
        return isMoving != null && isMoving;
    }
}
