package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TableScratchpadState(
        String content,
        String updatedByUserId,
        String updatedByNickname,
        long updatedAtEpoch
) {
    public TableScratchpadState {
        content = content == null ? "" : content;
    }

    public static TableScratchpadState empty() {
        return new TableScratchpadState("", null, null, 0L);
    }
}
