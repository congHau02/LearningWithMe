package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PermissionRespondRequest(
        @NotNull PermissionAction action,
        String targetUserId,
        @JsonProperty("isFreeCollab") Boolean isFreeCollab
) {}
