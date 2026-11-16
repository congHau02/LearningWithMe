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
        return new RoomPlayerState(
                userId, nickname, avatarId, role, "FREE_ROAM", x, y, facingDir, null, null,
                wsSessionId, true, now, false, 0L, studyGoal,
                orDefault(hatId, DEFAULT_HAT_ID), orDefault(deskPetId, DEFAULT_DESK_PET_ID), false
        );
    }

    public RoomPlayerDto toDto() {
        return new RoomPlayerDto(
                userId, nickname, avatarId, role, state != null ? state : "FREE_ROAM", x, y,
                facingDir != null ? facingDir : "DOWN", tableId, seatId, connected, isMoving,
                sitStartTimeEpoch, safeHat(), safeDeskPet(), studyGoal, studyGoalCompleted
        );
    }

    public RoomPlayerState withConnection(String nickname, String avatarId, String role, String activeWsSessionId, boolean connected, long updatedAtEpoch, String nextStudyGoal) {
        return withConnection(nickname, avatarId, safeHat(), safeDeskPet(), role, activeWsSessionId, connected, updatedAtEpoch, nextStudyGoal);
    }

    public RoomPlayerState withConnection(String nickname, String avatarId, String nextHatId, String nextDeskPetId, String role, String activeWsSessionId, boolean connected, long updatedAtEpoch, String nextStudyGoal) {
        String effectiveGoal = this.studyGoal != null ? this.studyGoal : nextStudyGoal;
        return new RoomPlayerState(userId, nickname, avatarId, role, state != null ? state : "FREE_ROAM", x, y,
                facingDir != null ? facingDir : "DOWN", tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, false, sitStartTimeEpoch, effectiveGoal,
                orDefault(nextHatId, DEFAULT_HAT_ID), orDefault(nextDeskPetId, DEFAULT_DESK_PET_ID), studyGoalCompleted);
    }

    public RoomPlayerState withMovement(int newX, int newY, String newFacingDir, boolean newIsMoving, long now) {
        return new RoomPlayerState(userId, nickname, avatarId, role, state != null ? state : "FREE_ROAM", newX, newY,
                newFacingDir != null ? newFacingDir : facingDir, tableId, seatId, activeWsSessionId, connected, now, newIsMoving, sitStartTimeEpoch, studyGoal, safeHat(), safeDeskPet(), studyGoalCompleted);
    }

    public RoomPlayerState withIdentity(String newUserId, String nickname, String avatarId, String role, long updatedAtEpoch) {
        return withIdentity(newUserId, nickname, avatarId, safeHat(), safeDeskPet(), role, updatedAtEpoch);
    }

    public RoomPlayerState withIdentity(String newUserId, String nickname, String avatarId, String nextHatId, String nextDeskPetId, String role, long updatedAtEpoch) {
        return new RoomPlayerState(newUserId, nickname, avatarId, role, state != null ? state : "FREE_ROAM", x, y,
                facingDir != null ? facingDir : "DOWN", tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, isMoving, sitStartTimeEpoch, studyGoal,
                orDefault(nextHatId, DEFAULT_HAT_ID), orDefault(nextDeskPetId, DEFAULT_DESK_PET_ID), studyGoalCompleted);
    }

    public RoomPlayerState withCustomization(String nextSkinId, String nextHatId, String nextDeskPetId, long updatedAtEpoch) {
        return new RoomPlayerState(userId, nickname, orDefault(nextSkinId, avatarId), role, state != null ? state : "FREE_ROAM", x, y,
                facingDir != null ? facingDir : "DOWN", tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, isMoving, sitStartTimeEpoch, studyGoal,
                orDefault(nextHatId, DEFAULT_HAT_ID), orDefault(nextDeskPetId, DEFAULT_DESK_PET_ID), studyGoalCompleted);
    }

    public RoomPlayerState withStudyGoal(String nextStudyGoal, boolean completed, long updatedAtEpoch) {
        String normalizedGoal = nextStudyGoal != null ? nextStudyGoal.trim() : "";
        boolean effectiveCompleted = !normalizedGoal.isEmpty() && completed;
        return new RoomPlayerState(userId, nickname, avatarId, role, state != null ? state : "FREE_ROAM", x, y,
                facingDir != null ? facingDir : "DOWN", tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, isMoving, sitStartTimeEpoch, normalizedGoal,
                safeHat(), safeDeskPet(), effectiveCompleted);
    }

    public RoomPlayerState withDisconnectedGrace(long updatedAtEpoch) {
        return new RoomPlayerState(userId, nickname, avatarId, role, state, x, y,
                facingDir != null ? facingDir : "DOWN", tableId, seatId, activeWsSessionId, false, updatedAtEpoch, false, sitStartTimeEpoch, studyGoal, safeHat(), safeDeskPet(), studyGoalCompleted);
    }

    public RoomPlayerState withSeated(String newTableId, String newSeatId, int seatX, int seatY, String newFacingDir, long now, String nextStudyGoal) {
        String effectiveGoal = this.studyGoal != null ? this.studyGoal : nextStudyGoal;
        return new RoomPlayerState(userId, nickname, avatarId, role, "SEATED", seatX, seatY,
                newFacingDir != null ? newFacingDir : facingDir, newTableId, newSeatId, activeWsSessionId, connected, now, false, now, effectiveGoal, safeHat(), safeDeskPet(), studyGoalCompleted);
    }

    public RoomPlayerState withFreeRoam(long now) {
        return new RoomPlayerState(userId, nickname, avatarId, role, "FREE_ROAM", x, y,
                facingDir != null ? facingDir : "DOWN", null, null, activeWsSessionId, connected, now, false, 0L, studyGoal, safeHat(), safeDeskPet(), studyGoalCompleted);
    }

    private String safeHat() { return orDefault(hatId, DEFAULT_HAT_ID); }
    private String safeDeskPet() { return orDefault(deskPetId, DEFAULT_DESK_PET_ID); }
    private static String orDefault(String val, String fallback) { return (val == null || val.isBlank()) ? fallback : val; }
}
