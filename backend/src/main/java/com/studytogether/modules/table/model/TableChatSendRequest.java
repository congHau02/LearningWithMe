package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TableChatSendRequest(
        @NotBlank(message = "Table chat message cannot be empty or blank")
        @Size(max = 200, message = "Table chat message cannot exceed 200 characters")
        String content
) {
    public String trimmedContent() {
        return content == null ? "" : content.trim();
    }
}
