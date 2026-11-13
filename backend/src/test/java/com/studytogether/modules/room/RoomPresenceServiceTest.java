package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AccountIdentityUpgradedEvent;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomJoinResponse;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.room.model.RoomSnapshotResponse;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class RoomPresenceServiceTest {

    private InMemoryRoomStateStore stateStore;
    private StompSessionRegistry sessionRegistry;
    private SimpMessagingTemplate messagingTemplate;
    private RoomPresenceService service;

    @BeforeEach
    void setUp() {
        stateStore = new InMemoryRoomStateStore();
        sessionRegistry = new StompSessionRegistry();
        messagingTemplate = mock(SimpMessagingTemplate.class);
        RoomTopologyService topologyService = new RoomTopologyService(new ObjectMapper());
        service = new RoomPresenceService(
                new RoomConfig(3),
                stateStore,
                topologyService,
                sessionRegistry,
                messagingTemplate
        );
    }

    @Test
    void joinShardPrioritizesExistingUserAndSelectsLowestOpenShard() {
        AuthPrincipal u1 = guest("u-1", "One");
        AuthPrincipal u2 = guest("u-2", "Two");
        AuthPrincipal u3 = guest("u-3", "Three");
        AuthPrincipal u4 = guest("u-4", "Four");

        assertThat(service.joinShard(u1)).isEqualTo(new RoomJoinResponse("main-library", 3, 0));

        stateStore.savePlayer("main-library", playerState("u-1", "One", "FREE_ROAM", 12, 13, null, null, "ws-1", true));
        stateStore.savePlayer("main-library", playerState("u-2", "Two", "FREE_ROAM", 12, 13, null, null, "ws-2", true));
        stateStore.savePlayer("main-library", playerState("u-3", "Three", "FREE_ROAM", 12, 13, null, null, "ws-3", true));

        // Full shard still accepts returning user (F5 / Grace Period)
        assertThat(service.joinShard(u2)).isEqualTo(new RoomJoinResponse("main-library", 3, 3));

        // New user overflows to main-library-2
        assertThat(service.joinShard(u4)).isEqualTo(new RoomJoinResponse("main-library-2", 3, 0));
        stateStore.savePlayer("main-library-2", playerState("u-4", "Four", "FREE_ROAM", 12, 13, null, null, "ws-4", true));

        // If main-library drops below capacity, lowest open shard wins again
        stateStore.deletePlayer("main-library", "u-3");
        assertThat(service.joinShard(guest("u-5", "Five"))).isEqualTo(new RoomJoinResponse("main-library", 3, 2));
    }

    @Test
    void getRoomSnapshotAssemblesPlayersSeatsTablesAndRecentMessages() {
        stateStore.savePlayer("main-library", playerState("u-1", "Alice", "SEATED", 3, 4, "table_01", "T1_S1", "ws-1", true));
        stateStore.putSeat("main-library", "T1_S1", "u-1");
        stateStore.putTableState("main-library", "table_01", new RedisTableState("u-1", List.of("u-2"), true, "Calculus"));
        stateStore.addMessage("main-library", new RoomChatMessage("m-1", "u-1", "Alice", "avatar_01", "hello", 1_700_000_000_000L));
        stateStore.incrementEventSeq("main-library");

        RoomSnapshotResponse snapshot = service.getRoomSnapshot("main-library");

        assertThat(snapshot.roomId()).isEqualTo("main-library");
        assertThat(snapshot.capacityLimit()).isEqualTo(3);
        assertThat(snapshot.eventSeq()).isEqualTo(1L);
        assertThat(snapshot.players()).hasSize(1);
        assertThat(snapshot.players().get(0).userId()).isEqualTo("u-1");
        assertThat(snapshot.seats()).containsEntry("T1_S1", "u-1");
        assertThat(snapshot.tables()).anySatisfy(table -> {
            assertThat(table.tableId()).isEqualTo("table_01");
            assertThat(table.hostUserId()).isEqualTo("u-1");
            assertThat(table.coHostUserIds()).containsExactly("u-2");
            assertThat(table.isFreeCollab()).isTrue();
            assertThat(table.sosBanner()).isEqualTo("Calculus");
            assertThat(table.occupiedSeats()).isEqualTo(1);
        });
        assertThat(snapshot.recentMessages()).hasSize(1);
        assertThat(snapshot.recentMessages().get(0).content()).isEqualTo("hello");

        assertThatThrownBy(() -> service.getRoomSnapshot("bad-room"))
                .isInstanceOf(RoomNotFoundException.class);
    }

    @Test
    void registerStompJoinAndHandleDisconnectFollowFreeRoamAndSeatedRules() {
        AuthPrincipal alice = guest("u-alice", "Alice");
        sessionRegistry.registerConnectedSession("u-alice", "ws-alice");
        RoomEvent joined = service.registerStompJoin(alice, "main-library", "ws-alice");

        assertThat(joined.type()).isEqualTo("PLAYER_JOINED");
        assertThat(joined.player().x()).isEqualTo(12);
        assertThat(joined.player().y()).isEqualTo(13);
        assertThat(joined.player().facingDir()).isEqualTo("DOWN");
        assertThat(joined.player().state()).isEqualTo("FREE_ROAM");
        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/events"), any(RoomEvent.class));

        // Disconnecting valid FREE_ROAM removes player and emits PLAYER_LEFT
        service.handleDisconnect("u-alice", "main-library", "ws-alice");
        assertThat(stateStore.getPlayer("main-library", "u-alice")).isEmpty();

        ArgumentCaptor<RoomEvent> eventCaptor = ArgumentCaptor.forClass(RoomEvent.class);
        verify(messagingTemplate, org.mockito.Mockito.times(2))
                .convertAndSend(eq("/topic/room/main-library/events"), eventCaptor.capture());
        assertThat(eventCaptor.getAllValues().get(1).type()).isEqualTo("PLAYER_LEFT");

        // SEATED disconnect preserves player & records grace
        stateStore.savePlayer("main-library", playerState("u-bob", "Bob", "SEATED", 3, 4, "table_01", "T1_S1", "ws-bob", true));
        sessionRegistry.registerConnectedSession("u-bob", "ws-bob");
        sessionRegistry.attachRoom("ws-bob", "main-library");
        service.handleDisconnect("u-bob", "main-library", "ws-bob");

        assertThat(stateStore.getPlayer("main-library", "u-bob"))
                .isPresent()
                .get()
                .satisfies(p -> {
                    assertThat(p.state()).isEqualTo("SEATED");
                    assertThat(p.connected()).isFalse();
                });
        assertThat(stateStore.hasDisconnectRecord("main-library", "u-bob")).isTrue();
    }

    @Test
    void accountUpgradeSyncsProfileAndReplacesUserIdWithoutDroppingSession() {
        stateStore.savePlayer("main-library", playerState("reg-42", "MergedName", "FREE_ROAM", 12, 13, null, null, "ws-g1", true));
        sessionRegistry.registerConnectedSession("guest-1", "ws-g1");
        sessionRegistry.attachRoom("ws-g1", "main-library");

        service.onAccountIdentityUpgraded(new AccountIdentityUpgradedEvent(
                "guest-1", "reg-42", "MergedName", "avatar_04", "IELTS"
        ));

        ArgumentCaptor<RoomEvent> captor = ArgumentCaptor.forClass(RoomEvent.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/events"), captor.capture());
        RoomEvent updatedEvent = captor.getValue();
        assertThat(updatedEvent.type()).isEqualTo("PLAYER_UPDATED");
        assertThat(updatedEvent.userId()).isEqualTo("reg-42");
        assertThat(updatedEvent.previousUserId()).isEqualTo("guest-1");
        assertThat(updatedEvent.player().nickname()).isEqualTo("MergedName");
        assertThat(updatedEvent.player().avatarId()).isEqualTo("avatar_04");
        assertThat(updatedEvent.player().role()).isEqualTo("REGISTERED");

        // Disconnect of upgrading old WS session must NOT remove player
        var disconnect = sessionRegistry.unregisterOnDisconnect("ws-g1");
        assertThat(disconnect.kind()).isEqualTo(StompSessionRegistry.DisconnectKind.IGNORED_UPGRADE_RECONNECT);
        assertThat(stateStore.getPlayer("main-library", "reg-42")).isPresent();
        verify(messagingTemplate, never()).convertAndSend(eq("/user/queue/errors"), any(Object.class));
    }

    private static AuthPrincipal guest(String id, String nickname) {
        return new AuthPrincipal(id, AuthRole.GUEST, AuthProvider.GUEST, null, nickname, "avatar_01", "Focus");
    }

    private static RoomPlayerState playerState(
            String userId, String nickname, String state, int x, int y,
            String tableId, String seatId, String wsSessionId, boolean connected
    ) {
        return new RoomPlayerState(
                userId, nickname, "avatar_01", "GUEST", state, x, y, "DOWN",
                tableId, seatId, wsSessionId, connected, 1_700_000_000_000L
        );
    }

    static final class InMemoryRoomStateStore implements RoomStateStore {
        private final Map<String, Map<String, RoomPlayerState>> playersByRoom = new ConcurrentHashMap<>();
        private final Map<String, Map<String, String>> seatsByRoom = new ConcurrentHashMap<>();
        private final Map<String, Map<String, Long>> disconnectsByRoom = new ConcurrentHashMap<>();
        private final Map<String, Map<String, RedisTableState>> tablesByRoom = new ConcurrentHashMap<>();
        private final Map<String, List<RoomChatMessage>> chatByRoom = new ConcurrentHashMap<>();
        private final Map<String, AtomicLong> seqByRoom = new ConcurrentHashMap<>();

        @Override
        public Optional<String> findUserShard(String userId) {
            return playersByRoom.entrySet().stream()
                    .filter(e -> e.getValue().containsKey(userId))
                    .map(Map.Entry::getKey)
                    .sorted()
                    .findFirst()
                    .or(() -> seatsByRoom.entrySet().stream()
                            .filter(e -> e.getValue().containsValue(userId))
                            .map(Map.Entry::getKey)
                            .sorted()
                            .findFirst());
        }

        @Override
        public long countPlayers(String roomId) {
            return playersByRoom.getOrDefault(roomId, Map.of()).size();
        }

        @Override
        public boolean isShardKnownOrActive(String roomId) {
            return countPlayers(roomId) > 0 || !seatsByRoom.getOrDefault(roomId, Map.of()).isEmpty();
        }

        @Override
        public long incrementEventSeq(String roomId) {
            return seqByRoom.computeIfAbsent(roomId, k -> new AtomicLong()).incrementAndGet();
        }

        @Override
        public long currentEventSeq(String roomId) {
            AtomicLong seq = seqByRoom.get(roomId);
            return seq != null ? seq.get() : 0L;
        }

        @Override
        public Optional<RoomPlayerState> getPlayer(String roomId, String userId) {
            return Optional.ofNullable(playersByRoom.getOrDefault(roomId, Map.of()).get(userId));
        }

        @Override
        public List<RoomPlayerState> getAllPlayers(String roomId) {
            return List.copyOf(playersByRoom.getOrDefault(roomId, Map.of()).values());
        }

        @Override
        public void savePlayer(String roomId, RoomPlayerState player) {
            playersByRoom.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>()).put(player.userId(), player);
        }

        @Override
        public boolean deletePlayer(String roomId, String userId) {
            Map<String, RoomPlayerState> players = playersByRoom.get(roomId);
            return players != null && players.remove(userId) != null;
        }

        @Override
        public void recordDisconnect(String roomId, String userId, long disconnectedAtEpoch) {
            disconnectsByRoom.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>()).put(userId, disconnectedAtEpoch);
        }

        @Override
        public void removeDisconnect(String roomId, String userId) {
            Map<String, Long> disconnects = disconnectsByRoom.get(roomId);
            if (disconnects != null) {
                disconnects.remove(userId);
            }
        }

        @Override
        public Map<String, String> getSeats(String roomId) {
            return Map.copyOf(seatsByRoom.getOrDefault(roomId, Map.of()));
        }

        @Override
        public synchronized SeatLockResult lockSeat(String roomId, String seatId, String userId) {
            Map<String, String> seats = seatsByRoom.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());
            if (seats.containsValue(userId)) {
                return SeatLockResult.ALREADY_SEATED;
            }
            if (seats.putIfAbsent(seatId, userId) != null) {
                return SeatLockResult.SEAT_OCCUPIED;
            }
            return SeatLockResult.SUCCESS;
        }

        @Override
        public boolean releaseSeat(String roomId, String seatId) {
            Map<String, String> seats = seatsByRoom.get(roomId);
            return seats != null && seats.remove(seatId) != null;
        }

        @Override
        public Optional<RedisTableState> getTableState(String roomId, String tableId) {
            return Optional.ofNullable(tablesByRoom.getOrDefault(roomId, Map.of()).get(tableId));
        }

        @Override
        public void saveTableState(String roomId, String tableId, RedisTableState state) {
            tablesByRoom.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>()).put(tableId, state);
        }

        @Override
        public boolean deleteTableState(String roomId, String tableId) {
            Map<String, RedisTableState> tables = tablesByRoom.get(roomId);
            return tables != null && tables.remove(tableId) != null;
        }

        @Override
        public List<RoomChatMessage> getRecentMessages(String roomId, int limit) {
            List<RoomChatMessage> list = chatByRoom.getOrDefault(roomId, List.of());
            return list.size() <= limit ? List.copyOf(list) : List.copyOf(list.subList(list.size() - limit, list.size()));
        }

        void putSeat(String roomId, String seatId, String userId) {
            seatsByRoom.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>()).put(seatId, userId);
        }

        void putTableState(String roomId, String tableId, RedisTableState state) {
            tablesByRoom.computeIfAbsent(roomId, k -> new ConcurrentHashMap<>()).put(tableId, state);
        }

        void addMessage(String roomId, RoomChatMessage msg) {
            chatByRoom.computeIfAbsent(roomId, k -> new CopyOnWriteArrayList<>()).add(msg);
        }

        boolean hasDisconnectRecord(String roomId, String userId) {
            return disconnectsByRoom.getOrDefault(roomId, Map.of()).containsKey(userId);
        }
    }
}
