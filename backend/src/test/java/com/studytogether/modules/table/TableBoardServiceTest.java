package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.room.SeatReleasedEvent;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.BoardDrawAction;
import com.studytogether.modules.table.model.BoardDrawRequest;
import com.studytogether.modules.table.model.BoardStroke;
import com.studytogether.modules.table.model.BoardStrokeTool;
import com.studytogether.modules.table.model.HomeworkSlide;
import com.studytogether.modules.table.model.NormalizedPoint;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TableBoardServiceTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private SimpMessagingTemplate messagingTemplate;
    private AtomicLong nowMs;
    private TableBoardService boardService;
    private final AuthPrincipal host = new AuthPrincipal("u-host", AuthRole.GUEST, "Host", "avatar_01", null);

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        messagingTemplate = mock(SimpMessagingTemplate.class);
        nowMs = new AtomicLong(1_700_000_000_000L);
        Clock clock = new Clock() {
            @Override
            public ZoneOffset getZone() { return ZoneOffset.UTC; }
            @Override
            public Clock withZone(java.time.ZoneId zone) { return this; }
            @Override
            public Instant instant() { return Instant.ofEpochMilli(nowMs.get()); }
        };
        boardService = new TableBoardService(stateStore, new TableAuthorizationService(stateStore), messagingTemplate, clock);

        stateStore.savePlayer("main-library", new RoomPlayerState(
                host.userId(), host.nickname(), host.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "seat_01", "ws-1", true, nowMs.get(), false, nowMs.get()
        ));
        HomeworkSlide slide = new HomeworkSlide("img-1", "img-1.webp", "/api/v1/ephemeral-files/img-1.webp", host.userId(), nowMs.get());
        stateStore.saveTableState("main-library", "table_01",
                new RedisTableState(host.userId(), List.of(), false, null).withHomeworkSlides(List.of(slide), "img-1"));
    }

    @Test
    void enforces100msLaserRateLimitAtomicallyAcrossConcurrentThreadsAndCleansUpOnLeave() throws Exception {
        BoardDrawRequest req = new BoardDrawRequest("img-1", BoardDrawAction.LASER_MOVE, null, null, new NormalizedPoint(0.5, 0.5));
        int threads = 8;
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            List<Callable<TableWorkspaceEvent>> tasks = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                tasks.add(() -> {
                    ready.countDown();
                    go.await();
                    return boardService.handleDraw(host, "table_01", req);
                });
            }
            List<Future<TableWorkspaceEvent>> futures = tasks.stream().map(pool::submit).toList();
            ready.await();
            go.countDown();

            long emitted = 0;
            for (Future<TableWorkspaceEvent> f : futures) {
                if (f.get() != null) emitted++;
            }
            assertThat(emitted).isEqualTo(1L);
        } finally {
            pool.shutdownNow();
        }

        // At +99ms still throttled; at +100ms allowed
        nowMs.addAndGet(99L);
        assertThat(boardService.handleDraw(host, "table_01", req)).isNull();
        nowMs.addAndGet(1L);
        assertThat(boardService.handleDraw(host, "table_01", req)).isNotNull();

        // Seat release clears per-user throttle entry so immediate re-sit works without waiting
        boardService.onSeatReleased(new SeatReleasedEvent("main-library", "table_01", "seat_01", host.userId(), 0L, nowMs.get()));
        assertThat(boardService.handleDraw(host, "table_01", req)).isNotNull();
    }

    @Test
    void rejectsStrokeWithMoreThan500PointsAndAllows500Points() {
        List<NormalizedPoint> exact500 = java.util.Collections.nCopies(500, new NormalizedPoint(0.5, 0.5));
        BoardStroke validStroke = new BoardStroke(
                "stroke-500", BoardStrokeTool.PEN, "#ef4444", 3.0, exact500, null, null, 0L);
        TableWorkspaceEvent okEvent = boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, validStroke, null, null));
        assertThat(okEvent.stroke()).isNotNull();
        assertThat(okEvent.stroke().points()).hasSize(500);

        List<NormalizedPoint> over500 = java.util.Collections.nCopies(501, new NormalizedPoint(0.5, 0.5));
        BoardStroke oversizedStroke = new BoardStroke(
                "stroke-501", BoardStrokeTool.PEN, "#ef4444", 3.0, over500, null, null, 0L);
        assertThatThrownBy(() -> boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, oversizedStroke, null, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);
    }

    @Test
    void validatesGeometricTwoPointStrokesAndLatexContent() {
        List<NormalizedPoint> twoPts = List.of(new NormalizedPoint(0.1, 0.2), new NormalizedPoint(0.8, 0.7));
        for (BoardStrokeTool shapeTool : List.of(
                BoardStrokeTool.LINE, BoardStrokeTool.ARROW, BoardStrokeTool.RECT, BoardStrokeTool.CIRCLE)) {
            BoardStroke shape = new BoardStroke(
                    "shape-" + shapeTool.name(), shapeTool, "#38bdf8", 3.0, twoPts, null, null, 0L);
            TableWorkspaceEvent event = boardService.handleDraw(
                    host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, shape, null, null));
            assertThat(event.stroke()).isNotNull();
            assertThat(event.stroke().tool()).isEqualTo(shapeTool);
            assertThat(event.stroke().authorUserId()).isEqualTo(host.userId());
        }

        // Single point geometric stroke must be rejected
        BoardStroke invalidLine = new BoardStroke(
                "bad-line", BoardStrokeTool.LINE, "#38bdf8", 3.0, List.of(new NormalizedPoint(0.1, 0.2)), null, null, 0L);
        assertThatThrownBy(() -> boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, invalidLine, null, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);

        // Valid LATEX stroke accepted; blank LATEX rejected
        BoardStroke validLatex = new BoardStroke(
                "latex-1", BoardStrokeTool.LATEX, "#E6ECE8", 18.0,
                List.of(new NormalizedPoint(0.5, 0.4)), "  \\frac{a}{b} + \\sqrt{x}  ", null, 0L);
        TableWorkspaceEvent latexEvent = boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, validLatex, null, null));
        assertThat(latexEvent.stroke().text()).isEqualTo("\\frac{a}{b} + \\sqrt{x}");

        BoardStroke blankLatex = new BoardStroke(
                "latex-blank", BoardStrokeTool.LATEX, "#E6ECE8", 18.0,
                List.of(new NormalizedPoint(0.5, 0.4)), "   ", null, 0L);
        assertThatThrownBy(() -> boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, blankLatex, null, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);
    }

    @Test
    void undoStrokeRemovesOnlyActingAuthorsStrokeAndRejectsOtherAuthorsStroke() {
        AuthPrincipal coHost = new AuthPrincipal("u-cohost", AuthRole.GUEST, "CoHost", "avatar_02", null);
        stateStore.savePlayer("main-library", new RoomPlayerState(
                coHost.userId(), coHost.nickname(), coHost.avatarId(), "GUEST", "SEATED",
                5, 5, "DOWN", "table_01", "seat_02", "ws-2", true, nowMs.get(), false, nowMs.get()
        ));
        stateStore.mutateTableState("main-library", "table_01",
                cur -> cur.withPermissions(cur.hostUserId(), List.of(coHost.userId()), cur.isFreeCollab()));

        BoardStroke hostStroke = new BoardStroke(
                "s-host-1", BoardStrokeTool.LINE, "#ef4444", 3.0,
                List.of(new NormalizedPoint(0.1, 0.1), new NormalizedPoint(0.4, 0.4)), null, null, 0L);
        BoardStroke coHostStroke = new BoardStroke(
                "s-cohost-1", BoardStrokeTool.ARROW, "#22c55e", 3.0,
                List.of(new NormalizedPoint(0.2, 0.2), new NormalizedPoint(0.6, 0.6)), null, null, 0L);

        boardService.handleDraw(host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, hostStroke, null, null));
        boardService.handleDraw(coHost, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, coHostStroke, null, null));

        // Host cannot UNDO_STROKE targeting coHost's stroke
        assertThatThrownBy(() -> boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.UNDO_STROKE, null, "s-cohost-1", null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.TABLE_PERMISSION_DENIED_TYPE);

        // Host implicit UNDO_STROKE (null strokeId) skips coHost's newer stroke and removes host's stroke
        TableWorkspaceEvent undoEvent = boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.UNDO_STROKE, null, null, null));
        assertThat(undoEvent.drawAction()).isEqualTo(BoardDrawAction.UNDO_STROKE);
        assertThat(undoEvent.erasedStrokeId()).isEqualTo("s-host-1");

        List<BoardStroke> remaining = stateStore.getTableState("main-library", "table_01")
                .orElseThrow().homeworkSlides().get(0).strokes();
        assertThat(remaining).extracting(BoardStroke::id).containsExactly("s-cohost-1");

        // Re-adding a stroke with the same ID (idempotent redo/retry) must not duplicate it
        boardService.handleDraw(host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, hostStroke, null, null));
        boardService.handleDraw(host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, hostStroke, null, null));
        List<BoardStroke> afterRedo = stateStore.getTableState("main-library", "table_01")
                .orElseThrow().homeworkSlides().get(0).strokes();
        assertThat(afterRedo).extracting(BoardStroke::id).containsExactly("s-cohost-1", "s-host-1");
    }

    @Test
    void validatesAndSynchronizesEuclideanGeometryStrokesAndRejectsMalformedOrUnauthorizedRequests() {
        List<NormalizedPoint> twoPts = List.of(new NormalizedPoint(0.2, 0.3), new NormalizedPoint(0.6, 0.7));
        List<NormalizedPoint> threePts = List.of(
                new NormalizedPoint(0.3, 0.2),
                new NormalizedPoint(0.15, 0.7),
                new NormalizedPoint(0.65, 0.7)
        );

        TableWorkspaceEvent dashedEvent = boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE,
                        new BoardStroke("geo-dashed", BoardStrokeTool.DASHED_LINE, "#38bdf8", 3.0, twoPts, null, null, 0L),
                        null, null));
        assertThat(dashedEvent.stroke().tool()).isEqualTo(BoardStrokeTool.DASHED_LINE);

        TableWorkspaceEvent circleCenterEvent = boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE,
                        new BoardStroke("geo-circle", BoardStrokeTool.CIRCLE_CENTER, "#ef4444", 3.0, twoPts, null, null, 0L),
                        null, null));
        assertThat(circleCenterEvent.stroke().tool()).isEqualTo(BoardStrokeTool.CIRCLE_CENTER);

        TableWorkspaceEvent triangleEvent = boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE,
                        new BoardStroke("geo-tri", BoardStrokeTool.TRIANGLE, "#22c55e", 3.0, threePts, null, null, 0L),
                        null, null));
        assertThat(triangleEvent.stroke().tool()).isEqualTo(BoardStrokeTool.TRIANGLE);
        assertThat(triangleEvent.stroke().points()).hasSize(3);

        for (String subtype : List.of("right_angle", "ANGLE_ARC_1", "ANGLE_ARC_2")) {
            TableWorkspaceEvent markEvent = boardService.handleDraw(
                    host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE,
                            new BoardStroke("geo-mark-" + subtype, BoardStrokeTool.GEO_MARK, "#facc15", 3.0, threePts, subtype, null, 0L),
                            null, null));
            assertThat(markEvent.stroke().text()).isEqualTo(subtype.toUpperCase());
        }
        for (String tick : List.of("TICK_1", "TICK_2")) {
            TableWorkspaceEvent tickEvent = boardService.handleDraw(
                    host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE,
                            new BoardStroke("geo-tick-" + tick, BoardStrokeTool.GEO_MARK, "#f8fafc", 3.0, twoPts, tick, null, 0L),
                            null, null));
            assertThat(tickEvent.stroke().text()).isEqualTo(tick);
        }

        // Invalid point counts & invalid GEO_MARK subtype
        BoardStroke badTriangle = new BoardStroke(
                "bad-tri", BoardStrokeTool.TRIANGLE, "#22c55e", 3.0, twoPts, null, null, 0L);
        assertThatThrownBy(() -> boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, badTriangle, null, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);

        BoardStroke badTick = new BoardStroke(
                "bad-tick", BoardStrokeTool.GEO_MARK, "#f8fafc", 3.0, threePts, "TICK_1", null, 0L);
        assertThatThrownBy(() -> boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, badTick, null, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);

        BoardStroke badSubtype = new BoardStroke(
                "bad-sub", BoardStrokeTool.GEO_MARK, "#f8fafc", 3.0, twoPts, "UNKNOWN_MARK", null, 0L);
        assertThatThrownBy(() -> boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE, badSubtype, null, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);

        // Unauthorized MEMBER cannot commit Euclidean strokes
        AuthPrincipal member = new AuthPrincipal("u-member", AuthRole.GUEST, "Member", "avatar_03", null);
        stateStore.savePlayer("main-library", new RoomPlayerState(
                member.userId(), member.nickname(), member.avatarId(), "GUEST", "SEATED",
                6, 5, "DOWN", "table_01", "seat_03", "ws-3", true, nowMs.get(), false, nowMs.get()
        ));
        assertThatThrownBy(() -> boardService.handleDraw(
                member, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ADD_STROKE,
                        new BoardStroke("unauth-tri", BoardStrokeTool.TRIANGLE, "#22c55e", 3.0, threePts, null, null, 0L),
                        null, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.TABLE_PERMISSION_DENIED_TYPE);

        // Undo & Erase work on Euclidean strokes
        TableWorkspaceEvent undoTick = boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.UNDO_STROKE, null, null, null));
        assertThat(undoTick.erasedStrokeId()).isEqualTo("geo-tick-TICK_2");

        TableWorkspaceEvent eraseTri = boardService.handleDraw(
                host, "table_01", new BoardDrawRequest("img-1", BoardDrawAction.ERASE_STROKE, null, "geo-tri", null));
        assertThat(eraseTri.erasedStrokeId()).isEqualTo("geo-tri");
        assertThat(stateStore.getTableState("main-library", "table_01").orElseThrow()
                .homeworkSlides().get(0).strokes())
                .extracting(BoardStroke::id)
                .doesNotContain("geo-tri", "geo-tick-TICK_2");
    }
}
