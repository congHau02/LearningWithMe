package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.model.PlayerMoveRequest;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class RoomMovementServiceTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private SimpMessagingTemplate messagingTemplate;
    private RoomTopologyService topologyService;
    private RoomMovementService service;

    private static final String ROOM_ID = "main-library";
    private static final AuthPrincipal PRINCIPAL = new AuthPrincipal(
            "user-1",
            AuthRole.GUEST,
            "Learner1",
            "student_glasses",
            null
    );

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        messagingTemplate = mock(SimpMessagingTemplate.class);
        topologyService = new RoomTopologyService(new ObjectMapper());
        service = new RoomMovementService(topologyService, stateStore, messagingTemplate);

        // Spawn player at (12, 13) in FREE_ROAM
        RoomPlayerState player = new RoomPlayerState(
                PRINCIPAL.userId(),
                PRINCIPAL.nickname(),
                PRINCIPAL.avatarId(),
                PRINCIPAL.role().name(),
                "FREE_ROAM",
                12,
                13,
                "DOWN",
                null,
                null,
                "ws-1",
                true,
                System.currentTimeMillis(),
                false
        );
        stateStore.savePlayer(ROOM_ID, player);
    }

    @Test
    void rejectsMoveWhenPlayerIsSeated() {
        RoomPlayerState seatedPlayer = new RoomPlayerState(
                PRINCIPAL.userId(),
                PRINCIPAL.nickname(),
                PRINCIPAL.avatarId(),
                PRINCIPAL.role().name(),
                "SEATED",
                3,
                4,
                "DOWN",
                "table_01",
                "T1_S1",
                "ws-1",
                true,
                System.currentTimeMillis(),
                false
        );
        stateStore.savePlayer(ROOM_ID, seatedPlayer);

        PlayerMoveRequest request = new PlayerMoveRequest(3, 5, "DOWN", true);

        assertThatThrownBy(() -> service.handleMove(PRINCIPAL, ROOM_ID, request, "ws-1"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Cannot move while SEATED");

        verify(messagingTemplate, never()).convertAndSend(any(String.class), any(Object.class));
    }

    @Test
    void rejectsMoveWhenOutOfBounds() {
        RoomPlayerState nearEdgePlayer = new RoomPlayerState(
                PRINCIPAL.userId(),
                PRINCIPAL.nickname(),
                PRINCIPAL.avatarId(),
                PRINCIPAL.role().name(),
                "FREE_ROAM",
                1,
                5,
                "LEFT",
                null,
                null,
                "ws-1",
                true,
                System.currentTimeMillis(),
                false
        );
        stateStore.savePlayer(ROOM_ID, nearEdgePlayer);

        PlayerMoveRequest request = new PlayerMoveRequest(-1, 5, "LEFT", true);

        assertThatThrownBy(() -> service.handleMove(PRINCIPAL, ROOM_ID, request, "ws-1"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not walkable");

        verify(messagingTemplate, never()).convertAndSend(any(String.class), any(Object.class));
    }

    @Test
    void rejectsMoveWhenIntoObstacle() {
        // (0, 0) is a wall in main-library
        // Player is at (12, 13). Moving to border wall (0, 13) exceeds distance, but let's test a nearby wall or furniture
        // In main-library, Table 1 has furniture tiles around (3, 4).
        // Let's place player at (3, 3) and try to step on table at (3, 4)
        RoomPlayerState nearTablePlayer = new RoomPlayerState(
                PRINCIPAL.userId(),
                PRINCIPAL.nickname(),
                PRINCIPAL.avatarId(),
                PRINCIPAL.role().name(),
                "FREE_ROAM",
                3,
                3,
                "DOWN",
                null,
                null,
                "ws-1",
                true,
                System.currentTimeMillis(),
                false
        );
        stateStore.savePlayer(ROOM_ID, nearTablePlayer);

        // Find a blocked tile in topology
        TileCoordinate blocked = topologyService.getRoomTopology(ROOM_ID).furniture().get(0);
        // Put player 1 step away from blocked
        stateStore.savePlayer(ROOM_ID, nearTablePlayer.withMovement(blocked.tileX(), blocked.tileY() - 1, "DOWN", false, System.currentTimeMillis()));

        PlayerMoveRequest request = new PlayerMoveRequest(blocked.tileX(), blocked.tileY(), "DOWN", true);

        assertThatThrownBy(() -> service.handleMove(PRINCIPAL, ROOM_ID, request, "ws-1"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not walkable");
    }

    @Test
    void rejectsTeleportExceeding4Tiles() {
        // Player is at (12, 13). Jumping to (12, 18) is distance 5 > 4
        PlayerMoveRequest request = new PlayerMoveRequest(12, 18, "DOWN", true);

        assertThatThrownBy(() -> service.handleMove(PRINCIPAL, ROOM_ID, request, "ws-1"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("exceeds maximum allowed threshold of 4 tiles");

        // Player in store remains at (12, 13)
        RoomPlayerState unchanged = stateStore.getPlayer(ROOM_ID, PRINCIPAL.userId()).orElseThrow();
        assertThat(unchanged.x()).isEqualTo(12);
        assertThat(unchanged.y()).isEqualTo(13);
    }

    @Test
    void silentlyDropsIntermediateMovingPacketsExceeding10HzJitter() {
        PlayerMoveRequest move1 = new PlayerMoveRequest(12, 12, "UP", true);
        RoomEvent event1 = service.handleMove(PRINCIPAL, ROOM_ID, move1, "ws-1");
        assertThat(event1).isNotNull();
        assertThat(event1.player().x()).isEqualTo(12);
        assertThat(event1.player().y()).isEqualTo(12);
        assertThat(event1.player().isMoving()).isTrue();

        // 2nd moving packet arrives almost immediately (e.g. 10ms later) due to network jitter
        PlayerMoveRequest move2 = new PlayerMoveRequest(12, 11, "UP", true);
        RoomEvent event2 = service.handleMove(PRINCIPAL, ROOM_ID, move2, "ws-1");

        // Silent drop: returns null, no error thrown, no broadcast
        assertThat(event2).isNull();
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/room/" + ROOM_ID + "/events"), any(RoomEvent.class));

        // Player in Redis is still at (12, 12) from move1
        RoomPlayerState current = stateStore.getPlayer(ROOM_ID, PRINCIPAL.userId()).orElseThrow();
        assertThat(current.x()).isEqualTo(12);
        assertThat(current.y()).isEqualTo(12);
    }

    @Test
    void alwaysProcessesStopPacketEvenImmediatelyAfterMove() {
        PlayerMoveRequest move1 = new PlayerMoveRequest(12, 14, "DOWN", true);
        service.handleMove(PRINCIPAL, ROOM_ID, move1, "ws-1");

        // Immediate stop packet at (12, 14) with isMoving: false
        PlayerMoveRequest stopPacket = new PlayerMoveRequest(12, 14, "DOWN", false);
        RoomEvent stopEvent = service.handleMove(PRINCIPAL, ROOM_ID, stopPacket, "ws-1");

        assertThat(stopEvent).isNotNull();
        assertThat(stopEvent.player().isMoving()).isFalse();
        assertThat(stopEvent.player().x()).isEqualTo(12);
        assertThat(stopEvent.player().y()).isEqualTo(14);

        RoomPlayerState current = stateStore.getPlayer(ROOM_ID, PRINCIPAL.userId()).orElseThrow();
        assertThat(current.isMoving()).isFalse();

        verify(messagingTemplate, times(2)).convertAndSend(eq("/topic/room/" + ROOM_ID + "/events"), any(RoomEvent.class));
    }

    @Test
    void successfulMoveUpdatesRedisAndBroadcastsPlayerMoved() {
        PlayerMoveRequest move = new PlayerMoveRequest(12, 14, "DOWN", true);
        RoomEvent event = service.handleMove(PRINCIPAL, ROOM_ID, move, "ws-1");

        assertThat(event).isNotNull();
        assertThat(event.type()).isEqualTo("PLAYER_MOVED");
        assertThat(event.userId()).isEqualTo(PRINCIPAL.userId());
        assertThat(event.player().x()).isEqualTo(12);
        assertThat(event.player().y()).isEqualTo(14);
        assertThat(event.player().facingDir()).isEqualTo("DOWN");
        assertThat(event.player().isMoving()).isTrue();

        ArgumentCaptor<RoomEvent> captor = ArgumentCaptor.forClass(RoomEvent.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/" + ROOM_ID + "/events"), captor.capture());
        assertThat(captor.getValue().type()).isEqualTo("PLAYER_MOVED");
        assertThat(captor.getValue().player().x()).isEqualTo(12);
    }
}
