package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.room.model.SeatSitRequest;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class RoomSeatServiceTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private RoomTopologyService topologyService;
    private SimpMessagingTemplate messagingTemplate;
    private ApplicationEventPublisher eventPublisher;
    private RoomSeatService seatService;

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        topologyService = new RoomTopologyService(new ObjectMapper());
        messagingTemplate = mock(SimpMessagingTemplate.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        seatService = new RoomSeatService(
                topologyService,
                stateStore,
                messagingTemplate,
                eventPublisher
        );
    }

    @Test
    void sitAtEmptyTableAssignsInitialTableHostAndBroadcastsSeatLocked() {
        String roomId = "main-library";
        AuthPrincipal principal = guest("u-1", "Alice");
        stateStore.savePlayer(roomId, playerState("u-1", "Alice", "FREE_ROAM", 12, 13, null, null, 0L));

        RoomEvent event = seatService.handleSit(principal, roomId, new SeatSitRequest("table_01", "T1_S1"), "ws-1");

        assertThat(event.type()).isEqualTo("SEAT_LOCKED");
        assertThat(event.userId()).isEqualTo("u-1");
        assertThat(event.tableId()).isEqualTo("table_01");
        assertThat(event.seatId()).isEqualTo("T1_S1");
        assertThat(event.hostUserId()).isEqualTo("u-1");
        assertThat(event.player().state()).isEqualTo("SEATED");

        RoomPlayerState updated = stateStore.getPlayer(roomId, "u-1").orElseThrow();
        assertThat(updated.state()).isEqualTo("SEATED");
        assertThat(updated.tableId()).isEqualTo("table_01");
        assertThat(updated.seatId()).isEqualTo("T1_S1");
        assertThat(updated.sitStartTimeEpoch()).isGreaterThan(0L);

        RedisTableState tableState = stateStore.getTableState(roomId, "table_01").orElseThrow();
        assertThat(tableState.hostUserId()).isEqualTo("u-1");

        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/events"), any(RoomEvent.class));
    }

    @Test
    void sitAtTableWithExistingHostKeepsHostIntact() {
        String roomId = "main-library";
        stateStore.saveTableState(roomId, "table_01", new RedisTableState("u-host", List.of(), false, null));
        stateStore.putSeat(roomId, "T1_S1", "u-host");
        stateStore.savePlayer(roomId, playerState("u-host", "Host", "SEATED", 3, 4, "table_01", "T1_S1", 1000L));

        AuthPrincipal secondLearner = guest("u-2", "Bob");
        stateStore.savePlayer(roomId, playerState("u-2", "Bob", "FREE_ROAM", 12, 13, null, null, 0L));

        RoomEvent event = seatService.handleSit(secondLearner, roomId, new SeatSitRequest("table_01", "T1_S2"), "ws-2");

        assertThat(event.hostUserId()).isEqualTo("u-host");
        RedisTableState tableState = stateStore.getTableState(roomId, "table_01").orElseThrow();
        assertThat(tableState.hostUserId()).isEqualTo("u-host");
    }

    @Test
    void sitFailsWhenSeatOccupiedOrUserAlreadySeated() {
        String roomId = "main-library";
        stateStore.putSeat(roomId, "T1_S1", "u-other");

        AuthPrincipal learner = guest("u-1", "Alice");
        stateStore.savePlayer(roomId, playerState("u-1", "Alice", "FREE_ROAM", 12, 13, null, null, 0L));

        assertThatThrownBy(() -> seatService.handleSit(learner, roomId, new SeatSitRequest("table_01", "T1_S1"), "ws-1"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getType()).isEqualTo(RoomExceptions.SEAT_OCCUPIED_TYPE));

        // Already seated
        stateStore.savePlayer(roomId, playerState("u-1", "Alice", "SEATED", 3, 4, "table_01", "T1_S2", 1000L));
        stateStore.putSeat(roomId, "T1_S2", "u-1");
        assertThatThrownBy(() -> seatService.handleSit(learner, roomId, new SeatSitRequest("table_02", "T2_S1"), "ws-1"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getType()).isEqualTo(RoomExceptions.ALREADY_SEATED_TYPE));
    }

    @Test
    void leaveSeatEmitsSeatReleasedEventAndClearsEmptyTableState() {
        String roomId = "main-library";
        AuthPrincipal host = guest("u-host", "Host");
        stateStore.savePlayer(roomId, playerState("u-host", "Host", "SEATED", 3, 4, "table_01", "T1_S1", 1000L));
        stateStore.putSeat(roomId, "T1_S1", "u-host");
        stateStore.saveTableState(roomId, "table_01", new RedisTableState("u-host", List.of(), false, null));

        RoomEvent event = seatService.handleLeave(host, roomId, "ws-1");

        assertThat(event.type()).isEqualTo("SEAT_RELEASED");
        assertThat(event.userId()).isEqualTo("u-host");
        assertThat(event.tableId()).isEqualTo("table_01");
        assertThat(event.seatId()).isEqualTo("T1_S1");
        assertThat(event.hostUserId()).isNull();

        RoomPlayerState updated = stateStore.getPlayer(roomId, "u-host").orElseThrow();
        assertThat(updated.state()).isEqualTo("FREE_ROAM");
        assertThat(updated.tableId()).isNull();
        assertThat(updated.seatId()).isNull();

        assertThat(stateStore.getTableState(roomId, "table_01")).isEmpty();
        assertThat(stateStore.getSeats(roomId)).doesNotContainKey("T1_S1");

        ArgumentCaptor<SeatReleasedEvent> captor = ArgumentCaptor.forClass(SeatReleasedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        SeatReleasedEvent released = captor.getValue();
        assertThat(released.roomId()).isEqualTo("main-library");
        assertThat(released.tableId()).isEqualTo("table_01");
        assertThat(released.seatId()).isEqualTo("T1_S1");
        assertThat(released.userId()).isEqualTo("u-host");
        assertThat(released.sitStartTimeEpoch()).isEqualTo(1000L);
    }

    @Test
    void leaveSeatAutoHostSuccessionPrefersCoHostThenEarliestMember() {
        String roomId = "main-library";
        AuthPrincipal host = guest("u-host", "Host");
        stateStore.savePlayer(roomId, playerState("u-host", "Host", "SEATED", 11, 3, "table_02", "T2_S1", 500L));
        stateStore.putSeat(roomId, "T2_S1", "u-host");

        // Member sat earlier at 1000L
        stateStore.savePlayer(roomId, playerState("u-member", "Member", "SEATED", 12, 3, "table_02", "T2_S2", 1000L));
        stateStore.putSeat(roomId, "T2_S2", "u-member");

        // Co-Host sat later at 2000L
        stateStore.savePlayer(roomId, playerState("u-cohost", "CoHost", "SEATED", 11, 5, "table_02", "T2_S3", 2000L));
        stateStore.putSeat(roomId, "T2_S3", "u-cohost");

        stateStore.saveTableState(roomId, "table_02", new RedisTableState("u-host", List.of("u-cohost"), false, null));

        RoomEvent event = seatService.handleLeave(host, roomId, "ws-1");

        assertThat(event.hostUserId()).isEqualTo("u-cohost");
        RedisTableState nextTable = stateStore.getTableState(roomId, "table_02").orElseThrow();
        assertThat(nextTable.hostUserId()).isEqualTo("u-cohost");
        assertThat(nextTable.coHostUserIds()).doesNotContain("u-cohost");

        // Now co-host leaves, remaining member should become host
        AuthPrincipal newHost = guest("u-cohost", "CoHost");
        RoomEvent secondEvent = seatService.handleLeave(newHost, roomId, "ws-3");
        assertThat(secondEvent.hostUserId()).isEqualTo("u-member");
        RedisTableState thirdTable = stateStore.getTableState(roomId, "table_02").orElseThrow();
        assertThat(thirdTable.hostUserId()).isEqualTo("u-member");
    }

    @Test
    void leaveSeatAutoHostSuccessionPrefersOnlineMemberOverDisconnectedCoHostInGrace() {
        String roomId = "main-library";
        AuthPrincipal host = guest("u-host", "Host");
        stateStore.savePlayer(roomId, playerState("u-host", "Host", "SEATED", 11, 3, "table_02", "T2_S1", 500L));
        stateStore.putSeat(roomId, "T2_S1", "u-host");

        // Co-Host sat earlier at 1000L BUT disconnected (in Grace Period)
        stateStore.savePlayer(roomId, playerState("u-cohost", "CoHost", "SEATED", 11, 5, "table_02", "T2_S3", 1000L, false));
        stateStore.putSeat(roomId, "T2_S3", "u-cohost");

        // Member sat later at 2000L BUT is online (connected = true)
        stateStore.savePlayer(roomId, playerState("u-member", "Member", "SEATED", 12, 3, "table_02", "T2_S2", 2000L, true));
        stateStore.putSeat(roomId, "T2_S2", "u-member");

        stateStore.saveTableState(roomId, "table_02", new RedisTableState("u-host", List.of("u-cohost"), false, null));

        RoomEvent event = seatService.handleLeave(host, roomId, "ws-1");

        // Online member must win over disconnected Co-Host in Grace Period
        assertThat(event.hostUserId()).isEqualTo("u-member");
        RedisTableState nextTable = stateStore.getTableState(roomId, "table_02").orElseThrow();
        assertThat(nextTable.hostUserId()).isEqualTo("u-member");
    }

    @Test
    void leaveSeatAutoHostSuccessionFallsBackToGraceCoHostWhenNoOneOnline() {
        String roomId = "main-library";
        AuthPrincipal host = guest("u-host", "Host");
        stateStore.savePlayer(roomId, playerState("u-host", "Host", "SEATED", 11, 3, "table_02", "T2_S1", 500L));
        stateStore.putSeat(roomId, "T2_S1", "u-host");

        // Both are disconnected (in Grace Period)
        stateStore.savePlayer(roomId, playerState("u-member", "Member", "SEATED", 12, 3, "table_02", "T2_S2", 1000L, false));
        stateStore.putSeat(roomId, "T2_S2", "u-member");

        stateStore.savePlayer(roomId, playerState("u-cohost", "CoHost", "SEATED", 11, 5, "table_02", "T2_S3", 2000L, false));
        stateStore.putSeat(roomId, "T2_S3", "u-cohost");

        stateStore.saveTableState(roomId, "table_02", new RedisTableState("u-host", List.of("u-cohost"), false, null));

        RoomEvent event = seatService.handleLeave(host, roomId, "ws-1");

        // Fallback: disconnected Co-Host in Grace wins over disconnected Member in Grace
        assertThat(event.hostUserId()).isEqualTo("u-cohost");
        RedisTableState nextTable = stateStore.getTableState(roomId, "table_02").orElseThrow();
        assertThat(nextTable.hostUserId()).isEqualTo("u-cohost");
    }

    @Test
    void evictGracePeriodSeatReleasesSeatPublishesEventAndElectsSuccessor() {
        String roomId = "main-library";
        // Host disconnected in Grace Period
        stateStore.savePlayer(roomId, playerState("u-host", "Host", "SEATED", 11, 3, "table_02", "T2_S1", 500L, false));
        stateStore.putSeat(roomId, "T2_S1", "u-host");
        stateStore.recordDisconnect(roomId, "u-host", 1_700_000_000_000L);

        // Member is online
        stateStore.savePlayer(roomId, playerState("u-member", "Member", "SEATED", 12, 3, "table_02", "T2_S2", 1000L, true));
        stateStore.putSeat(roomId, "T2_S2", "u-member");

        stateStore.saveTableState(roomId, "table_02", new RedisTableState("u-host", List.of(), false, null));

        seatService.evictGracePeriodSeat(roomId, "u-host", "T2_S1");

        // Seat and player removed
        assertThat(stateStore.getSeats(roomId)).doesNotContainKey("T2_S1");
        assertThat(stateStore.getPlayer(roomId, "u-host")).isEmpty();
        assertThat(stateStore.hasDisconnectRecord(roomId, "u-host")).isFalse();

        // Succession to u-member
        RedisTableState nextTable = stateStore.getTableState(roomId, "table_02").orElseThrow();
        assertThat(nextTable.hostUserId()).isEqualTo("u-member");

        // Spring ApplicationEvent published
        ArgumentCaptor<SeatReleasedEvent> captor = ArgumentCaptor.forClass(SeatReleasedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        SeatReleasedEvent released = captor.getValue();
        assertThat(released.seatId()).isEqualTo("T2_S1");
        assertThat(released.userId()).isEqualTo("u-host");

        // STOMP events broadcasted: SEAT_RELEASED and PLAYER_LEFT
        ArgumentCaptor<RoomEvent> eventCaptor = ArgumentCaptor.forClass(RoomEvent.class);
        verify(messagingTemplate, org.mockito.Mockito.atLeast(2)).convertAndSend(eq("/topic/room/main-library/events"), eventCaptor.capture());
        List<RoomEvent> captured = eventCaptor.getAllValues();
        assertThat(captured.stream().anyMatch(e -> "SEAT_RELEASED".equals(e.type()) && "u-member".equals(e.hostUserId()))).isTrue();
        assertThat(captured.stream().anyMatch(e -> "PLAYER_LEFT".equals(e.type()) && "u-host".equals(e.userId()))).isTrue();
    }

    @Test
    void evictGracePeriodSeatOnLastMemberDeletesTableState() {
        String roomId = "main-library";
        stateStore.savePlayer(roomId, playerState("u-lone", "Lone", "SEATED", 3, 4, "table_01", "T1_S1", 1000L, false));
        stateStore.putSeat(roomId, "T1_S1", "u-lone");
        stateStore.recordDisconnect(roomId, "u-lone", 1_700_000_000_000L);
        stateStore.saveTableState(roomId, "table_01", new RedisTableState("u-lone", List.of(), false, null));

        seatService.evictGracePeriodSeat(roomId, "u-lone", "T1_S1");

        assertThat(stateStore.getSeats(roomId)).doesNotContainKey("T1_S1");
        assertThat(stateStore.getPlayer(roomId, "u-lone")).isEmpty();
        assertThat(stateStore.getTableState(roomId, "table_01")).isEmpty();
    }

    @Test
    void concurrentSitRequestsOnlyOneSucceedsOthersFailWithSeatOccupied() throws InterruptedException {
        String roomId = "main-library";
        int threadCount = 10;
        java.util.concurrent.CountDownLatch startGate = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch doneGate = new java.util.concurrent.CountDownLatch(threadCount);
        java.util.concurrent.atomic.AtomicInteger successCount = new java.util.concurrent.atomic.AtomicInteger();
        java.util.concurrent.atomic.AtomicInteger occupiedErrorCount = new java.util.concurrent.atomic.AtomicInteger();

        for (int i = 1; i <= threadCount; i++) {
            String uid = "u-concurrent-" + i;
            stateStore.savePlayer(roomId, playerState(uid, "User " + i, "FREE_ROAM", 12, 13, null, null, 0L));
            new Thread(() -> {
                try {
                    startGate.await();
                    seatService.handleSit(guest(uid, "User " + uid), roomId, new SeatSitRequest("table_01", "T1_S1"), "ws-" + uid);
                    successCount.incrementAndGet();
                } catch (BusinessException ex) {
                    if (RoomExceptions.SEAT_OCCUPIED_TYPE.equals(ex.getType())) {
                        occupiedErrorCount.incrementAndGet();
                    }
                } catch (Exception ignored) {
                } finally {
                    doneGate.countDown();
                }
            }).start();
        }

        startGate.countDown();
        assertThat(doneGate.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();

        assertThat(successCount.get()).isEqualTo(1);
        assertThat(occupiedErrorCount.get()).isEqualTo(threadCount - 1);
        assertThat(stateStore.getSeats(roomId)).containsKey("T1_S1");
    }

    @Test
    void leaveSeatPublishesTableEmptiedEventWithLastStateWhenLastLearnerLeaves() {
        String roomId = "main-library";
        AuthPrincipal host = guest("u-host", "Host");
        stateStore.savePlayer(roomId, playerState("u-host", "Host", "SEATED", 3, 4, "table_01", "T1_S1", 1000L));
        stateStore.putSeat(roomId, "T1_S1", "u-host");
        RedisTableState tableState = new RedisTableState("u-host", List.of(), false, null);
        stateStore.saveTableState(roomId, "table_01", tableState);

        seatService.handleLeave(host, roomId, "ws-1");

        ArgumentCaptor<TableEmptiedEvent> captor = ArgumentCaptor.forClass(TableEmptiedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().roomId()).isEqualTo(roomId);
        assertThat(captor.getValue().tableId()).isEqualTo("table_01");
        assertThat(captor.getValue().lastTableState()).isEqualTo(tableState);
    }

    @Test
    void leaveSeatDoesNotPublishTableEmptiedEventWhenAnotherLearnerRemains() {
        String roomId = "main-library";
        AuthPrincipal host = guest("u-host", "Host");
        stateStore.savePlayer(roomId, playerState("u-host", "Host", "SEATED", 3, 4, "table_01", "T1_S1", 1000L));
        stateStore.savePlayer(roomId, playerState("u-2", "Bob", "SEATED", 4, 4, "table_01", "T1_S2", 2000L));
        stateStore.putSeat(roomId, "T1_S1", "u-host");
        stateStore.putSeat(roomId, "T1_S2", "u-2");
        stateStore.saveTableState(roomId, "table_01", new RedisTableState("u-host", List.of(), false, null));

        seatService.handleLeave(host, roomId, "ws-1");

        verify(eventPublisher, org.mockito.Mockito.never()).publishEvent(any(TableEmptiedEvent.class));
    }

    private static AuthPrincipal guest(String userId, String nickname) {
        return new AuthPrincipal(userId, AuthRole.GUEST, nickname, "default_student", "Study");
    }

    private static RoomPlayerState playerState(
            String userId, String nickname, String state, int x, int y,
            String tableId, String seatId, long sitStartTime
    ) {
        return playerState(userId, nickname, state, x, y, tableId, seatId, sitStartTime, true);
    }

    private static RoomPlayerState playerState(
            String userId, String nickname, String state, int x, int y,
            String tableId, String seatId, long sitStartTime, boolean connected
    ) {
        return new RoomPlayerState(
                userId, nickname, "default_student", "GUEST", state,
                x, y, "DOWN", tableId, seatId, "ws-" + userId, connected,
                1_700_000_000_000L, false, sitStartTime
        );
    }
}
