package com.studytogether.modules.table.model;

import jakarta.validation.constraints.Size;

public record ScratchpadUpdateRequest(
        @Size(max = 4000, message = "Scratchpad content must not exceed 4000 characters")
        String content
) {}
