package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonProperty;
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
        long timestampEpoch
) {
    public TableWorkspaceEvent {
        coHostUserIds = coHostUserIds == null ? List.of() : List.copyOf(coHostUserIds);
    }

    public static TableWorkspaceEvent permissionRequested(
            String tableId,
            String requesterUserId,
            String requesterNickname,
            String hostUserId,
            List<String> coHostUserIds,
            boolean isFreeCollab,
            long now
    ) {
        return new TableWorkspaceEvent(
                "PERMISSION_REQUESTED",
                tableId,
                requesterUserId,
                null,
                requesterNickname,
                null,
                hostUserId,
                coHostUserIds,
                isFreeCollab,
                null,
                null,
                now
        );
    }

    public static TableWorkspaceEvent permissionUpdated(
            String tableId,
            PermissionAction action,
            String actorUserId,
            String targetUserId,
            String hostUserId,
            List<String> coHostUserIds,
            boolean isFreeCollab,
            long now
    ) {
        return new TableWorkspaceEvent(
                "PERMISSION_UPDATED",
                tableId,
                actorUserId,
                targetUserId,
                null,
                action,
                hostUserId,
                coHostUserIds,
                isFreeCollab,
                null,
                null,
                now
        );
    }

    public static TableWorkspaceEvent videoSynced(
            String tableId,
            String actorUserId,
            TableVideoState videoState,
            String hostUserId,
            List<String> coHostUserIds,
            boolean isFreeCollab,
            long now
    ) {
        return new TableWorkspaceEvent(
                "VIDEO_SYNCED",
                tableId,
                actorUserId,
                null,
                null,
                null,
                hostUserId,
                coHostUserIds,
                isFreeCollab,
                videoState,
                null,
                now
        );
    }

    public static TableWorkspaceEvent sosUpdated(
            String tableId,
            String actorUserId,
            String sosBanner,
            String hostUserId,
            List<String> coHostUserIds,
            boolean isFreeCollab,
            long now
    ) {
        return new TableWorkspaceEvent(
                "SOS_UPDATED",
                tableId,
                actorUserId,
                null,
                null,
                null,
                hostUserId,
                coHostUserIds,
                isFreeCollab,
                null,
                sosBanner,
                now
        );
    }
}
