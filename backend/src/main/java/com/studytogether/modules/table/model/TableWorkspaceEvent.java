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
                now
        );
    }
}
