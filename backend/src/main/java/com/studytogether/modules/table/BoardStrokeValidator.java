package com.studytogether.modules.table;

import com.studytogether.modules.table.model.BoardStroke;
import com.studytogether.modules.table.model.BoardStrokeTool;
import com.studytogether.modules.table.model.NormalizedPoint;
import java.util.UUID;

final class BoardStrokeValidator {

    static final int MAX_TEXT_LENGTH = 300;

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
        for (NormalizedPoint pt : input.points()) {
            if (pt == null || !isNormalized(pt.x()) || !isNormalized(pt.y())) {
                throw TableExceptions.invalidAction("All stroke coordinates must be within [0.0, 1.0]");
            }
        }
        String text = null;
        if (input.tool() == BoardStrokeTool.TEXT) {
            if (input.text() == null || input.text().isBlank()) {
                throw TableExceptions.invalidAction("Text content is required for TEXT stroke");
            }
            text = input.text().trim();
            if (text.length() > MAX_TEXT_LENGTH) {
                throw TableExceptions.invalidAction("Text annotation exceeds 300 characters");
            }
        }
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

    static boolean isNormalized(double value) {
        return Double.isFinite(value) && value >= 0.0 && value <= 1.0;
    }
}
