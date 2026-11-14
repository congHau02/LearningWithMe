package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record TableWorkspaceSnapshot(
        String roomId,
        String tableId,
        String hostUserId,
        List<String> coHostUserIds,
        @JsonProperty("isFreeCollab") boolean isFreeCollab,
        String sosBanner,
        TableVideoState videoState,
        List<TableMemberDto> members
) {
    public TableWorkspaceSnapshot {
        coHostUserIds = coHostUserIds == null ? List.of() : List.copyOf(coHostUserIds);
        videoState = videoState == null ? TableVideoState.empty() : videoState;
        members = members == null ? List.of() : List.copyOf(members);
    }
}
