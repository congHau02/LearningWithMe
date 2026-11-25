package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record TableWorkspaceEvent(
        String type,
        String roomId,
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
        VoiceSignalPayload voiceSignal,
        TableScratchpadState scratchpadState,
        long timestampEpoch,
        @JsonProperty("isTableLocked") boolean isTableLocked,
        String inviteCode
) {
    public TableWorkspaceEvent {
        coHostUserIds = coHostUserIds == null ? List.of() : List.copyOf(coHostUserIds);
        homeworkSlides = homeworkSlides == null ? List.of() : List.copyOf(homeworkSlides);
    }

    public TableWorkspaceEvent(
            String type, String roomId, String tableId, String actorUserId, String targetUserId,
            String requesterNickname, PermissionAction action, String hostUserId, List<String> coHostUserIds,
            boolean isFreeCollab, TableVideoState videoState, String sosBanner, TableChatMessage chatMessage,
            List<HomeworkSlide> homeworkSlides, String activeSlideId, String slideId, BoardDrawAction drawAction,
            BoardStroke stroke, String erasedStrokeId, LaserPointerPayload laserPointer,
            VoiceSignalPayload voiceSignal, TableScratchpadState scratchpadState, long timestampEpoch
    ) {
        this(type, roomId, tableId, actorUserId, targetUserId, requesterNickname, action, hostUserId, coHostUserIds,
                isFreeCollab, videoState, sosBanner, chatMessage, homeworkSlides, activeSlideId, slideId, drawAction,
                stroke, erasedStrokeId, laserPointer, voiceSignal, scratchpadState, timestampEpoch, false, null);
    }

    public TableWorkspaceEvent withRoomId(String nextRoomId) {
        return new TableWorkspaceEvent(type, nextRoomId, tableId, actorUserId, targetUserId, requesterNickname,
                action, hostUserId, coHostUserIds, isFreeCollab, videoState, sosBanner, chatMessage,
                homeworkSlides, activeSlideId, slideId, drawAction, stroke, erasedStrokeId, laserPointer, voiceSignal,
                scratchpadState, timestampEpoch, isTableLocked, inviteCode);
    }
}
