package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record EphemeralImageMetadata(
        String imageId,
        String roomId,
        String tableId,
        String fileName,
        String uploadedByUserId,
        long uploadedAtEpoch
) {}
