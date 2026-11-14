package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record HomeworkSlide(
        String imageId,
        String fileName,
        String url,
        String uploadedByUserId,
        long uploadedAtEpoch,
        List<BoardStroke> strokes
) {
    public HomeworkSlide {
        strokes = strokes == null ? List.of() : List.copyOf(strokes);
    }

    public HomeworkSlide(
            String imageId,
            String fileName,
            String url,
            String uploadedByUserId,
            long uploadedAtEpoch
    ) {
        this(imageId, fileName, url, uploadedByUserId, uploadedAtEpoch, List.of());
    }

    public HomeworkSlide withStrokes(List<BoardStroke> nextStrokes) {
        return new HomeworkSlide(imageId, fileName, url, uploadedByUserId, uploadedAtEpoch, nextStrokes);
    }
}
