package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.studytogether.modules.table.TableSosService;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SosToggleRequest(
        boolean active,
        @Size(max = TableSosService.MAX_SOS_TOPIC_LENGTH, message = "SOS topic must be at most 80 characters")
        String topic
) {}
