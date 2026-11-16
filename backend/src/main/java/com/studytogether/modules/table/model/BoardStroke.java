package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BoardStroke(
        String id,
        @NotNull(message = "Stroke tool is required") BoardStrokeTool tool,
        @NotBlank(message = "Stroke color is required") String color,
        double lineWidth,
        @NotEmpty(message = "Stroke must contain at least one point")
        @Size(max = MAX_POINTS_PER_STROKE, message = "Stroke cannot exceed 500 normalized points")
        List<@Valid NormalizedPoint> points,
        String text,
        String authorUserId,
        long createdAtEpoch
) {
    public static final int MAX_POINTS_PER_STROKE = 500;

    public BoardStroke {
        points = points == null ? List.of() : List.copyOf(points);
    }
}
