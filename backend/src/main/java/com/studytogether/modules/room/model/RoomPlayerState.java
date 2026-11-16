package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RoomPlayerState(
        String userId, String nickname, String avatarId, String role, String state,
        int x, int y, @JsonAlias("dir") String facingDir, String tableId, String seatId,
        String activeWsSessionId, boolean connected, long updatedAtEpoch, boolean isMoving,
        long sitStartTimeEpoch, String studyGoal, String hatId, String deskPetId, boolean studyGoalCompleted
) {
    public static final String DEFAULT_HAT_ID = "hat_none";
    public static final String DEFAULT_DESK_PET_ID = "pet_sprout_pot";

    public RoomPlayerState {
        state = orDefault(state, "FREE_ROAM");
        facingDir = orDefault(facingDir, "DOWN");
        hatId = orDefault(hatId, DEFAULT_HAT_ID);
        deskPetId = orDefault(deskPetId, DEFAULT_DESK_PET_ID);
    }

    public RoomPlayerState(String userId, String nickname, String avatarId, String role, String state, int x, int y, String facingDir, String tableId, String seatId, String activeWsSessionId, boolean connected, long updatedAtEpoch) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, false, 0L, null, DEFAULT_HAT_ID, DEFAULT_DESK_PET_ID, false);
    }

    public RoomPlayerState(String userId, String nickname, String avatarId, String role, String state, int x, int y, String facingDir, String tableId, String seatId, String activeWsSessionId, boolean connected, long updatedAtEpoch, boolean isMoving) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, isMoving, 0L, null, DEFAULT_HAT_ID, DEFAULT_DESK_PET_ID, false);
    }

    public RoomPlayerState(String userId, String nickname, String avatarId, String role, String state, int x, int y, String facingDir, String tableId, String seatId, String activeWsSessionId, boolean connected, long updatedAtEpoch, boolean isMoving, long sitStartTimeEpoch) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, isMoving, sitStartTimeEpoch, null, DEFAULT_HAT_ID, DEFAULT_DESK_PET_ID, false);
    }

    public RoomPlayerState(String userId, String nickname, String avatarId, String role, String state, int x, int y, String facingDir, String tableId, String seatId, String activeWsSessionId, boolean connected, long updatedAtEpoch, boolean isMoving, long sitStartTimeEpoch, String studyGoal) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, isMoving, sitStartTimeEpoch, studyGoal, DEFAULT_HAT_ID, DEFAULT_DESK_PET_ID, false);
    }

    public RoomPlayerState(String userId, String nickname, String avatarId, String role, String state, int x, int y, String facingDir, String tableId, String seatId, String activeWsSessionId, boolean connected, long updatedAtEpoch, boolean isMoving, long sitStartTimeEpoch, String studyGoal, String hatId, String deskPetId) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, isMoving, sitStartTimeEpoch, studyGoal, hatId, deskPetId, false);
    }

    public static RoomPlayerState spawnFreeRoam(
            String userId, String nickname, String avatarId, String hatId, String deskPetId,
            String role, int x, int y, String facingDir, String wsSessionId, long now, String studyGoal
    ) {
        return new RoomPlayerState(userId, nickname, avatarId, role, "FREE_ROAM", x, y, facingDir, null, null,
                wsSessionId, true, now, false, 0L, studyGoal, hatId, deskPetId, false);
    }

    public RoomPlayerDto toDto() {
        return new RoomPlayerDto(userId, nickname, avatarId, role, state, x, y, facingDir,
                tableId, seatId, connected, isMoving, sitStartTimeEpoch, hatId, deskPetId, studyGoal, studyGoalCompleted);
    }

    public RoomPlayerState withConnection(String nickname, String avatarId, String role, String activeWsSessionId, boolean connected, long updatedAtEpoch, String nextStudyGoal) {
        return withConnection(nickname, avatarId, hatId, deskPetId, role, activeWsSessionId, connected, updatedAtEpoch, nextStudyGoal);
    }

    public RoomPlayerState withConnection(String nickname, String avatarId, String nextHatId, String nextDeskPetId, String role, String activeWsSessionId, boolean connected, long updatedAtEpoch, String nextStudyGoal) {
        String effectiveGoal = this.studyGoal != null ? this.studyGoal : nextStudyGoal;
        return new RoomPlayerState(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId,
                activeWsSessionId, connected, updatedAtEpoch, false, sitStartTimeEpoch, effectiveGoal, nextHatId, nextDeskPetId, studyGoalCompleted);
    }

    public RoomPlayerState withMovement(int newX, int newY, String newFacingDir, boolean newIsMoving, long now) {
        return new RoomPlayerState(userId, nickname, avatarId, role, state, newX, newY,
                orDefault(newFacingDir, facingDir), tableId, seatId, activeWsSessionId, connected, now, newIsMoving, sitStartTimeEpoch, studyGoal, hatId, deskPetId, studyGoalCompleted);
    }

    public RoomPlayerState withIdentity(String newUserId, String nickname, String avatarId, String role, long updatedAtEpoch) {
        return withIdentity(newUserId, nickname, avatarId, hatId, deskPetId, role, updatedAtEpoch);
    }

    public RoomPlayerState withIdentity(String newUserId, String nickname, String avatarId, String nextHatId, String nextDeskPetId, String role, long updatedAtEpoch) {
        return new RoomPlayerState(newUserId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId,
                activeWsSessionId, connected, updatedAtEpoch, isMoving, sitStartTimeEpoch, studyGoal, nextHatId, nextDeskPetId, studyGoalCompleted);
    }

    public RoomPlayerState withCustomization(String nextSkinId, String nextHatId, String nextDeskPetId, long updatedAtEpoch) {
        return new RoomPlayerState(userId, nickname, orDefault(nextSkinId, avatarId), role, state, x, y, facingDir, tableId, seatId,
                activeWsSessionId, connected, updatedAtEpoch, isMoving, sitStartTimeEpoch, studyGoal, nextHatId, nextDeskPetId, studyGoalCompleted);
    }

    public RoomPlayerState withStudyGoal(String nextStudyGoal, boolean completed, long updatedAtEpoch) {
        String normalizedGoal = nextStudyGoal != null ? nextStudyGoal.trim() : "";
        boolean effectiveCompleted = !normalizedGoal.isEmpty() && completed;
        return new RoomPlayerState(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId,
                activeWsSessionId, connected, updatedAtEpoch, isMoving, sitStartTimeEpoch, normalizedGoal, hatId, deskPetId, effectiveCompleted);
    }

    public RoomPlayerState withDisconnectedGrace(long updatedAtEpoch) {
        return new RoomPlayerState(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId,
                activeWsSessionId, false, updatedAtEpoch, false, sitStartTimeEpoch, studyGoal, hatId, deskPetId, studyGoalCompleted);
    }

    public RoomPlayerState withSeated(String newTableId, String newSeatId, int seatX, int seatY, String newFacingDir, long now, String nextStudyGoal) {
        String effectiveGoal = this.studyGoal != null ? this.studyGoal : nextStudyGoal;
        return new RoomPlayerState(userId, nickname, avatarId, role, "SEATED", seatX, seatY,
                orDefault(newFacingDir, facingDir), newTableId, newSeatId, activeWsSessionId, connected, now, false, now, effectiveGoal, hatId, deskPetId, studyGoalCompleted);
    }

    public RoomPlayerState withFreeRoam(long now) {
        return new RoomPlayerState(userId, nickname, avatarId, role, "FREE_ROAM", x, y, facingDir, null, null,
                activeWsSessionId, connected, now, false, 0L, studyGoal, hatId, deskPetId, studyGoalCompleted);
    }

    private static String orDefault(String val, String fallback) {
        return (val == null || val.isBlank()) ? fallback : val;
    }
}
