package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record HomeworkSlide(
        String imageId,
        String fileName,
        String url,
        String uploadedByUserId,
        long uploadedAtEpoch
) {}
