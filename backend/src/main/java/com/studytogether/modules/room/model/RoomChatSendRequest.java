package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RoomChatSendRequest(
        @NotBlank(message = "Chat content must not be blank")
        @Size(max = 200, message = "Chat content must not exceed 200 characters")
        String content
) {
    public String trimmedContent() {
        return content == null ? "" : content.trim();
    }
}
