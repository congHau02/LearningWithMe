package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PermissionRequestPayload(String reason) {}
