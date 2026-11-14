package com.studytogether.modules.table.model;

public record TableChatSendRequest(String content) {
    public String trimmedContent() {
        return content == null ? "" : content.trim();
    }
}
