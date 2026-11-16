package com.studytogether.modules.table.model;

import com.studytogether.modules.room.model.RedisTableState;

public final class TableWorkspaceEvents {

    private TableWorkspaceEvents() {}

    public static TableWorkspaceEvent permissionRequested(
            String tableId, String requesterUserId, String requesterNickname, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("PERMISSION_REQUESTED", null, tableId, requesterUserId, null,
                requesterNickname, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent permissionUpdated(
            String tableId, PermissionAction action, String actorUserId, String targetUserId, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("PERMISSION_UPDATED", null, tableId, actorUserId, targetUserId,
                null, action, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent videoSynced(
            String tableId, String actorUserId, TableVideoState videoState, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("VIDEO_SYNCED", null, tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                videoState, null, null, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent sosUpdated(
            String tableId, String actorUserId, String sosBanner, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("SOS_UPDATED", null, tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, sosBanner, null, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent tableChat(
            String tableId, String actorUserId, TableChatMessage chatMessage, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("TABLE_CHAT", null, tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, chatMessage, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent homeworkSlideEvent(
            String type, String tableId, String actorUserId, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent(type, null, tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent boardDraw(
            String tableId, String actorUserId, String slideId, BoardDrawAction drawAction,
            BoardStroke stroke, String erasedStrokeId, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("BOARD_DRAW", null, tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, null, state.activeSlideId(), slideId, drawAction, stroke, erasedStrokeId, null, null, null, null, now);
    }

    public static TableWorkspaceEvent laserMove(
            String tableId, String actorUserId, String nickname, String slideId,
            NormalizedPoint point, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("LASER_MOVE", null, tableId, actorUserId, null,
                nickname, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, null, state.activeSlideId(), slideId, BoardDrawAction.LASER_MOVE,
                null, null, new LaserPointerPayload(actorUserId, nickname, slideId, point.x(), point.y()), null, null, null, now);
    }

    public static TableWorkspaceEvent voiceSignal(
            String tableId, String actorUserId, String targetUserId,
            VoiceSignalPayload voiceSignal, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("VOICE_SIGNAL", null, tableId, actorUserId, targetUserId,
                voiceSignal != null ? voiceSignal.senderNickname() : null, null,
                state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, null, state.activeSlideId(), null, null, null, null, null, voiceSignal, null, null, now);
    }

    public static TableWorkspaceEvent focusCycleUpdated(
            String tableId, String actorUserId, FocusCycleAction focusCycleAction,
            TableFocusCycleState focusCycleState, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("FOCUS_CYCLE_UPDATED", null, tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, null, state.activeSlideId(), null, null, null, null, null, null,
                focusCycleState, focusCycleAction, now);
    }
}
