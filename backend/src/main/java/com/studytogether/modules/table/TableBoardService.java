package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.BoardDrawAction;
import com.studytogether.modules.table.model.BoardDrawRequest;
import com.studytogether.modules.table.model.BoardStroke;
import com.studytogether.modules.table.model.BoardStrokeTool;
import com.studytogether.modules.table.model.HomeworkSlide;
import com.studytogether.modules.table.model.NormalizedPoint;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TableBoardService {

    // shortcut: cap 500 strokes per slide in Redis to prevent unbounded state growth
    public static final int MAX_STROKES_PER_SLIDE = 500;
    public static final int MAX_TEXT_LENGTH = 300;

    private final RoomStateStore stateStore;
    private final TableAuthorizationService authService;
    private final SimpMessagingTemplate messagingTemplate;

    public TableBoardService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.stateStore = stateStore;
        this.authService = authService;
        this.messagingTemplate = messagingTemplate;
    }

    public TableWorkspaceEvent handleDraw(AuthPrincipal principal, String tableId, BoardDrawRequest request) {
        if (request == null || request.action() == null || request.slideId() == null || request.slideId().isBlank()) {
            throw TableExceptions.invalidAction("slideId and draw action are required");
        }
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String roomId = ctx.roomId();
        RedisTableState current = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
        authService.requireControlPermission(current, principal.userId());

        String targetSlideId = request.slideId().trim();
        int slideIndex = findSlideIndex(current.homeworkSlides(), targetSlideId);
        if (slideIndex < 0) {
            throw TableExceptions.invalidAction("Homework slide not found: " + targetSlideId);
        }

        long now = System.currentTimeMillis();
        HomeworkSlide slide = current.homeworkSlides().get(slideIndex);
        BoardStroke savedStroke = null;
        String erasedStrokeId = null;

        List<BoardStroke> nextStrokes = switch (request.action()) {
            case ADD_STROKE -> {
                if (slide.strokes().size() >= MAX_STROKES_PER_SLIDE) {
                    throw TableExceptions.invalidAction("Slide has reached maximum stroke limit");
                }
                savedStroke = validateAndNormalizeStroke(request.stroke(), principal.userId(), now);
                List<BoardStroke> updated = new ArrayList<>(slide.strokes());
                updated.add(savedStroke);
                yield updated;
            }
            case ERASE_STROKE -> {
                if (request.strokeId() == null || request.strokeId().isBlank()) {
                    throw TableExceptions.invalidAction("strokeId is required for ERASE_STROKE");
                }
                erasedStrokeId = request.strokeId().trim();
                String targetId = erasedStrokeId;
                yield slide.strokes().stream()
                        .filter(s -> !s.id().equals(targetId))
                        .toList();
            }
            case CLEAR_SLIDE -> List.of();
        };

        List<HomeworkSlide> nextSlides = new ArrayList<>(current.homeworkSlides());
        nextSlides.set(slideIndex, slide.withStrokes(nextStrokes));

        RedisTableState updatedState = current.withHomeworkSlides(nextSlides, current.activeSlideId());
        stateStore.saveTableState(roomId, tableId, updatedState);

        TableWorkspaceEvent event = TableWorkspaceEvent.boardDraw(
                tableId, principal.userId(), targetSlideId, request.action(),
                savedStroke, erasedStrokeId, updatedState, now
        );
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(tableId), event);
        return event;
    }

    private static int findSlideIndex(List<HomeworkSlide> slides, String slideId) {
        for (int i = 0; i < slides.size(); i += 1) {
            if (slideId.equals(slides.get(i).imageId())) {
                return i;
            }
        }
        return -1;
    }

    private static BoardStroke validateAndNormalizeStroke(BoardStroke input, String userId, long now) {
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

    private static boolean isNormalized(double value) {
        return Double.isFinite(value) && value >= 0.0 && value <= 1.0;
    }
}
