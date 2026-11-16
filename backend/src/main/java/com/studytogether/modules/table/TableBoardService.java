package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.SeatReleasedEvent;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.BoardDrawAction;
import com.studytogether.modules.table.model.BoardDrawRequest;
import com.studytogether.modules.table.model.BoardStroke;
import com.studytogether.modules.table.model.HomeworkSlide;
import com.studytogether.modules.table.model.NormalizedPoint;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceEvents;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TableBoardService {

    // shortcut: cap 500 strokes per slide in Redis to prevent unbounded state growth
    public static final int MAX_STROKES_PER_SLIDE = 500;
    public static final int MAX_TEXT_LENGTH = 300;
    public static final long MIN_LASER_INTERVAL_MS = 100L;

    private final RoomStateStore stateStore;
    private final TableAuthorizationService authService;
    private final SimpMessagingTemplate messagingTemplate;
    private final Clock clock;
    private final ConcurrentHashMap<String, Long> lastLaserEpochByUserId = new ConcurrentHashMap<>();

    @Autowired
    public TableBoardService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this(stateStore, authService, messagingTemplate, Clock.systemUTC());
    }

    public TableBoardService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate,
            Clock clock
    ) {
        this.stateStore = stateStore;
        this.authService = authService;
        this.messagingTemplate = messagingTemplate;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    public TableWorkspaceEvent handleDraw(AuthPrincipal principal, String tableId, BoardDrawRequest request) {
        if (request == null || request.action() == null || request.slideId() == null || request.slideId().isBlank()) {
            throw TableExceptions.invalidAction("slideId and draw action are required");
        }
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String roomId = ctx.roomId();
        String targetSlideId = request.slideId().trim();
        long now = clock.millis();

        if (request.action() == BoardDrawAction.LASER_MOVE) {
            RedisTableState current = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
            authService.requireControlPermission(current, principal.userId());
            if (findSlideIndex(current.homeworkSlides(), targetSlideId) < 0) {
                throw TableExceptions.invalidAction("Homework slide not found: " + targetSlideId);
            }
            return handleLaserMove(principal, roomId, tableId, targetSlideId, request.point(), current, now);
        }

        AtomicReference<BoardStroke> savedStrokeRef = new AtomicReference<>();
        AtomicReference<String> erasedStrokeIdRef = new AtomicReference<>();
        RedisTableState updatedState = stateStore.mutateTableState(roomId, tableId, current -> {
            authService.requireControlPermission(current, principal.userId());
            int slideIndex = findSlideIndex(current.homeworkSlides(), targetSlideId);
            if (slideIndex < 0) {
                throw TableExceptions.invalidAction("Homework slide not found: " + targetSlideId);
            }
            HomeworkSlide slide = current.homeworkSlides().get(slideIndex);
            savedStrokeRef.set(null);
            erasedStrokeIdRef.set(null);

            List<BoardStroke> nextStrokes = switch (request.action()) {
                case ADD_STROKE -> {
                    if (slide.strokes().size() >= MAX_STROKES_PER_SLIDE) {
                        throw TableExceptions.invalidAction("Slide has reached maximum stroke limit");
                    }
                    BoardStroke validated = BoardStrokeValidator.validateAndNormalize(
                            request.stroke(), principal.userId(), now);
                    savedStrokeRef.set(validated);
                    List<BoardStroke> updated = new ArrayList<>(slide.strokes());
                    updated.add(validated);
                    yield updated;
                }
                case ERASE_STROKE -> {
                    if (request.strokeId() == null || request.strokeId().isBlank()) {
                        throw TableExceptions.invalidAction("strokeId is required for ERASE_STROKE");
                    }
                    String targetId = request.strokeId().trim();
                    erasedStrokeIdRef.set(targetId);
                    yield slide.strokes().stream()
                            .filter(s -> !s.id().equals(targetId))
                            .toList();
                }
                case CLEAR_SLIDE -> List.of();
                case LASER_MOVE -> throw new IllegalStateException("LASER_MOVE handled above");
            };

            List<HomeworkSlide> nextSlides = new ArrayList<>(current.homeworkSlides());
            nextSlides.set(slideIndex, slide.withStrokes(nextStrokes));
            return current.withHomeworkSlides(nextSlides, current.activeSlideId());
        });

        TableWorkspaceEvent event = TableWorkspaceEvents.boardDraw(
                tableId, principal.userId(), targetSlideId, request.action(),
                savedStrokeRef.get(), erasedStrokeIdRef.get(), updatedState, now
        ).withRoomId(roomId);
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(roomId, tableId), event);
        return event;
    }

    private TableWorkspaceEvent handleLaserMove(
            AuthPrincipal principal,
            String roomId,
            String tableId,
            String targetSlideId,
            NormalizedPoint point,
            RedisTableState current,
            long now
    ) {
        if (point == null || !BoardStrokeValidator.isNormalized(point.x()) || !BoardStrokeValidator.isNormalized(point.y())) {
            throw TableExceptions.invalidAction("Laser pointer point must be within [0.0, 1.0]");
        }
        // shortcut: memory-based 10Hz burst throttle per pod; upgrade to Redis sliding token bucket if multi-pod clustered
        boolean[] allowed = { false };
        lastLaserEpochByUserId.compute(principal.userId(), (uid, prev) -> {
            if (prev == null || (now - prev) >= MIN_LASER_INTERVAL_MS) {
                allowed[0] = true;
                return now;
            }
            return prev;
        });
        if (!allowed[0]) {
            return null;
        }

        String nickname = (principal.nickname() != null && !principal.nickname().isBlank())
                ? principal.nickname()
                : principal.userId();
        TableWorkspaceEvent event = TableWorkspaceEvents.laserMove(
                tableId, principal.userId(), nickname, targetSlideId, point, current, now
        ).withRoomId(roomId);
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(roomId, tableId), event);
        return event;
    }

    @EventListener
    public void onSeatReleased(SeatReleasedEvent event) {
        if (event != null && event.userId() != null) {
            lastLaserEpochByUserId.remove(event.userId());
        }
    }

    private static int findSlideIndex(List<HomeworkSlide> slides, String slideId) {
        for (int i = 0; i < slides.size(); i += 1) {
            if (slideId.equals(slides.get(i).imageId())) {
                return i;
            }
        }
        return -1;
    }
}
