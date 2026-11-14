package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.studytogether.modules.room.model.RedisTableState;
import java.util.List;

public record TableWorkspaceEvent(
        String type,
        String tableId,
        String actorUserId,
        String targetUserId,
        String requesterNickname,
        PermissionAction action,
        String hostUserId,
        List<String> coHostUserIds,
        @JsonProperty("isFreeCollab") boolean isFreeCollab,
        TableVideoState videoState,
        String sosBanner,
        TableChatMessage chatMessage,
        List<HomeworkSlide> homeworkSlides,
        String activeSlideId,
        String slideId,
        BoardDrawAction drawAction,
        BoardStroke stroke,
        String erasedStrokeId,
        LaserPointerPayload laserPointer,
        long timestampEpoch
) {
    public TableWorkspaceEvent {
        coHostUserIds = coHostUserIds == null ? List.of() : List.copyOf(coHostUserIds);
        homeworkSlides = homeworkSlides == null ? List.of() : List.copyOf(homeworkSlides);
    }

    public static TableWorkspaceEvent permissionRequested(
            String tableId, String requesterUserId, String requesterNickname, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("PERMISSION_REQUESTED", tableId, requesterUserId, null,
                requesterNickname, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent permissionUpdated(
            String tableId, PermissionAction action, String actorUserId, String targetUserId,
            RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("PERMISSION_UPDATED", tableId, actorUserId, targetUserId,
                null, action, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent videoSynced(
            String tableId, String actorUserId, TableVideoState videoState, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("VIDEO_SYNCED", tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                videoState, null, null, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent sosUpdated(
            String tableId, String actorUserId, String sosBanner, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("SOS_UPDATED", tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, sosBanner, null, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent tableChat(
            String tableId, String actorUserId, TableChatMessage chatMessage, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("TABLE_CHAT", tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, chatMessage, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent homeworkSlideEvent(
            String type, String tableId, String actorUserId, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent(type, tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, state.homeworkSlides(), state.activeSlideId(), null, null, null, null, null, now);
    }

    public static TableWorkspaceEvent boardDraw(
            String tableId, String actorUserId, String slideId, BoardDrawAction drawAction,
            BoardStroke stroke, String erasedStrokeId, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("BOARD_DRAW", tableId, actorUserId, null,
                null, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, null, state.activeSlideId(), slideId, drawAction, stroke, erasedStrokeId, null, now);
    }

    public static TableWorkspaceEvent laserMove(
            String tableId, String actorUserId, String nickname, String slideId,
            NormalizedPoint point, RedisTableState state, long now
    ) {
        return new TableWorkspaceEvent("LASER_MOVE", tableId, actorUserId, null,
                nickname, null, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(),
                null, null, null, null, state.activeSlideId(), slideId, BoardDrawAction.LASER_MOVE,
                null, null, new LaserPointerPayload(actorUserId, nickname, slideId, point.x(), point.y()), now);
    }
}
