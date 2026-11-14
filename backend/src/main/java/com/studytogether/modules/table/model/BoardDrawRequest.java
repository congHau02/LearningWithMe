package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BoardDrawRequest(
        @NotBlank(message = "slideId is required") String slideId,
        @NotNull(message = "draw action is required") BoardDrawAction action,
        @Valid BoardStroke stroke,
        String strokeId
) {}
