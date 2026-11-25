package com.studytogether.modules.table.model;

import com.studytogether.modules.room.model.RedisTableState;
import java.util.List;
import java.util.Map;

public final class TableWorkspaceEvents {

    private TableWorkspaceEvents() {}

    public static TableWorkspaceEvent permissionRequested(String tableId, String requesterUserId, String requesterNickname, RedisTableState state, long now) {
        return builder("PERMISSION_REQUESTED", tableId, requesterUserId, state, now).requesterNickname(requesterNickname).withHomeworkSlides(state).build();
    }

    public static TableWorkspaceEvent permissionUpdated(String tableId, PermissionAction action, String actorUserId, String targetUserId, RedisTableState state, long now) {
        return builder("PERMISSION_UPDATED", tableId, actorUserId, state, now).targetUserId(targetUserId).action(action).withHomeworkSlides(state).inviteCode(state.inviteCode()).build();
    }

    public static TableWorkspaceEvent videoSynced(String tableId, String actorUserId, TableVideoState videoState, RedisTableState state, long now) {
        return builder("VIDEO_SYNCED", tableId, actorUserId, state, now).videoState(videoState).withHomeworkSlides(state).build();
    }

    public static TableWorkspaceEvent sosUpdated(String tableId, String actorUserId, String sosBanner, RedisTableState state, long now) {
        return builder("SOS_UPDATED", tableId, actorUserId, state, now).sosBanner(sosBanner).withHomeworkSlides(state).build();
    }

    public static TableWorkspaceEvent tableChat(String tableId, String actorUserId, TableChatMessage chatMessage, RedisTableState state, long now) {
        return builder("TABLE_CHAT", tableId, actorUserId, state, now).chatMessage(chatMessage).withHomeworkSlides(state).build();
    }

    public static TableWorkspaceEvent homeworkSlideEvent(String type, String tableId, String actorUserId, RedisTableState state, long now) {
        return builder(type, tableId, actorUserId, state, now).withHomeworkSlides(state).build();
    }

    public static TableWorkspaceEvent boardDraw(String tableId, String actorUserId, String slideId, BoardDrawAction drawAction, BoardStroke stroke, String erasedStrokeId, RedisTableState state, long now) {
        return builder("BOARD_DRAW", tableId, actorUserId, state, now).slideId(slideId).drawAction(drawAction).stroke(stroke).erasedStrokeId(erasedStrokeId).build();
    }

    public static TableWorkspaceEvent laserMove(String tableId, String actorUserId, String nickname, String slideId, NormalizedPoint point, RedisTableState state, long now) {
        return builder("LASER_MOVE", tableId, actorUserId, state, now).requesterNickname(nickname).slideId(slideId).drawAction(BoardDrawAction.LASER_MOVE)
                .laserPointer(new LaserPointerPayload(actorUserId, nickname, slideId, point.x(), point.y())).build();
    }

    public static TableWorkspaceEvent voiceSignal(String tableId, String actorUserId, String targetUserId, VoiceSignalPayload voiceSignal, RedisTableState state, long now) {
        return builder("VOICE_SIGNAL", tableId, actorUserId, state, now).targetUserId(targetUserId)
                .requesterNickname(voiceSignal != null ? voiceSignal.senderNickname() : null).voiceSignal(voiceSignal).build();
    }

    public static TableWorkspaceEvent scratchpadUpdated(String tableId, String actorUserId, TableScratchpadState scratchpadState, RedisTableState state, long now) {
        return builder("UPDATE_SCRATCHPAD", tableId, actorUserId, state, now).scratchpadState(scratchpadState).build();
    }

    public static TableWorkspaceEvent quickCheckUpdated(String tableId, String actorUserId, String actorNickname, RedisTableState state, long now) {
        return builder("QUICK_CHECK_UPDATED", tableId, actorUserId, state, now)
                .requesterNickname(actorNickname)
                .quickCheckSignals(state.quickCheckSignals())
                .build();
    }

    private static Builder builder(String type, String tableId, String actorUserId, RedisTableState state, long now) {
        return new Builder(type, tableId, actorUserId, state, now);
    }

    private static final class Builder {
        private final String type, tableId, actorUserId;
        private final RedisTableState state;
        private final long timestampEpoch;
        private String targetUserId, requesterNickname, sosBanner, slideId, erasedStrokeId, inviteCode;
        private PermissionAction action;
        private TableVideoState videoState;
        private TableChatMessage chatMessage;
        private List<HomeworkSlide> homeworkSlides;
        private BoardDrawAction drawAction;
        private BoardStroke stroke;
        private LaserPointerPayload laserPointer;
        private VoiceSignalPayload voiceSignal;
        private TableScratchpadState scratchpadState;
        private Map<String, QuickCheckSignalState> quickCheckSignals;

        private Builder(String type, String tableId, String actorUserId, RedisTableState state, long timestampEpoch) {
            this.type = type; this.tableId = tableId; this.actorUserId = actorUserId;
            this.state = state; this.timestampEpoch = timestampEpoch;
        }
        private Builder targetUserId(String v) { this.targetUserId = v; return this; }
        private Builder requesterNickname(String v) { this.requesterNickname = v; return this; }
        private Builder action(PermissionAction v) { this.action = v; return this; }
        private Builder videoState(TableVideoState v) { this.videoState = v; return this; }
        private Builder sosBanner(String v) { this.sosBanner = v; return this; }
        private Builder chatMessage(TableChatMessage v) { this.chatMessage = v; return this; }
        private Builder withHomeworkSlides(RedisTableState s) { this.homeworkSlides = s.homeworkSlides(); return this; }
        private Builder slideId(String v) { this.slideId = v; return this; }
        private Builder drawAction(BoardDrawAction v) { this.drawAction = v; return this; }
        private Builder stroke(BoardStroke v) { this.stroke = v; return this; }
        private Builder erasedStrokeId(String v) { this.erasedStrokeId = v; return this; }
        private Builder laserPointer(LaserPointerPayload v) { this.laserPointer = v; return this; }
        private Builder voiceSignal(VoiceSignalPayload v) { this.voiceSignal = v; return this; }
        private Builder scratchpadState(TableScratchpadState v) { this.scratchpadState = v; return this; }
        private Builder inviteCode(String v) { this.inviteCode = v; return this; }
        private Builder quickCheckSignals(Map<String, QuickCheckSignalState> v) { this.quickCheckSignals = v; return this; }

        private TableWorkspaceEvent build() {
            return new TableWorkspaceEvent(type, null, tableId, actorUserId, targetUserId, requesterNickname,
                    action, state.hostUserId(), state.coHostUserIds(), state.isFreeCollab(), videoState, sosBanner,
                    chatMessage, homeworkSlides, state.activeSlideId(), slideId, drawAction, stroke, erasedStrokeId,
                    laserPointer, voiceSignal, scratchpadState, timestampEpoch,
                    state.isTableLocked(), inviteCode, quickCheckSignals);
        }
    }
}
