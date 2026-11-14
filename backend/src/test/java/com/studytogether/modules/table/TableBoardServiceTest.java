package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.room.SeatReleasedEvent;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.BoardDrawAction;
import com.studytogether.modules.table.model.BoardDrawRequest;
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
}
