package com.studytogether.modules.table;

import com.studytogether.modules.table.model.BoardStroke;
import com.studytogether.modules.table.model.BoardStrokeTool;
import com.studytogether.modules.table.model.NormalizedPoint;
import java.util.Set;
import java.util.UUID;

final class BoardStrokeValidator {

    static final int MAX_TEXT_LENGTH = 300;
    static final int MAX_POINTS_PER_STROKE = BoardStroke.MAX_POINTS_PER_STROKE;
    static final Set<String> ALLOWED_GEO_MARKS = Set.of(
            "RIGHT_ANGLE", "ANGLE_ARC_1", "ANGLE_ARC_2", "TICK_1", "TICK_2"
    );

    private BoardStrokeValidator() {}

    static BoardStroke validateAndNormalize(BoardStroke input, String userId, long now) {
        if (input == null || input.tool() == null) {
            throw TableExceptions.invalidAction("Stroke and tool are required for ADD_STROKE");
        }
        if (input.color() == null || input.color().isBlank() || input.color().length() > 32) {
            throw TableExceptions.invalidAction("Valid stroke color is required");
        }
        if (!Double.isFinite(input.lineWidth()) || input.lineWidth() <= 0 || input.lineWidth() > 64) {
            throw TableExceptions.invalidAction("Stroke lineWidth must be between 0 and 64");
        }
        if (input.points() == null || input.points().isEmpty()) {
            throw TableExceptions.invalidAction("Stroke must contain at least one normalized point");
        }
        if (input.points().size() > MAX_POINTS_PER_STROKE) {
            throw TableExceptions.invalidAction("Stroke cannot exceed 500 normalized points");
        }
        for (NormalizedPoint pt : input.points()) {
            if (pt == null || !isNormalized(pt.x()) || !isNormalized(pt.y())) {
                throw TableExceptions.invalidAction("All stroke coordinates must be within [0.0, 1.0]");
            }
        }
        if (isTwoPointGeometricShape(input.tool()) && input.points().size() != 2) {
            throw TableExceptions.invalidAction(input.tool().name() + " stroke requires exactly 2 normalized points");
        }
        if (input.tool() == BoardStrokeTool.TRIANGLE && input.points().size() != 3) {
            throw TableExceptions.invalidAction("TRIANGLE stroke requires exactly 3 normalized points");
        }
        String text = validateStrokeText(input);
        String strokeId = (input.id() != null && !input.id().isBlank())
                ? input.id().trim()
                : "stroke-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return new BoardStroke(
                strokeId,
                input.tool(),
                input.color().trim(),
                input.lineWidth(),
                input.points(),
                text,
                userId,
                now
        );
    }

    private static String validateStrokeText(BoardStroke input) {
        if (input.tool() == BoardStrokeTool.TEXT || input.tool() == BoardStrokeTool.LATEX) {
            if (input.text() == null || input.text().isBlank()) {
                throw TableExceptions.invalidAction("Text content is required for " + input.tool().name() + " stroke");
            }
            String trimmed = input.text().trim();
            if (trimmed.length() > MAX_TEXT_LENGTH) {
                throw TableExceptions.invalidAction("Text annotation exceeds 300 characters");
            }
            return trimmed;
        }
        if (input.tool() == BoardStrokeTool.GEO_MARK) {
            if (input.text() == null || input.text().isBlank()) {
                throw TableExceptions.invalidAction("Geometry mark subtype is required for GEO_MARK stroke");
            }
            String subtype = input.text().trim().toUpperCase();
            if (!ALLOWED_GEO_MARKS.contains(subtype)) {
                throw TableExceptions.invalidAction("Unsupported geometry mark subtype: " + subtype);
            }
            int ptCount = input.points().size();
            boolean isTick = "TICK_1".equals(subtype) || "TICK_2".equals(subtype);
            if ((isTick && ptCount != 2) || (!isTick && ptCount != 2 && ptCount != 3)) {
                throw TableExceptions.invalidAction("Invalid point count for GEO_MARK subtype " + subtype);
            }
            return subtype;
        }
        return null;
    }

    static boolean isTwoPointGeometricShape(BoardStrokeTool tool) {
        return tool == BoardStrokeTool.LINE
                || tool == BoardStrokeTool.ARROW
                || tool == BoardStrokeTool.RECT
                || tool == BoardStrokeTool.CIRCLE
                || tool == BoardStrokeTool.DASHED_LINE
                || tool == BoardStrokeTool.CIRCLE_CENTER;
    }

    static boolean isNormalized(double value) {
        return Double.isFinite(value) && value >= 0.0 && value <= 1.0;
    }
}
