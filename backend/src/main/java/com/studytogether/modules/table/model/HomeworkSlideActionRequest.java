package com.studytogether.modules.table.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record HomeworkSlideActionRequest(
        @NotNull(message = "Slide action is required") HomeworkSlideAction action,
        @NotBlank(message = "imageId is required") String imageId
) {}
