package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.VoiceSignalRequest;
import com.studytogether.modules.table.model.VoiceSignalType;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TableVoiceServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private TableAuthorizationService authService;
    private SimpMessagingTemplate messagingTemplate;
    private TableVoiceService voiceService;

    private final AuthPrincipal alice = new AuthPrincipal("u-alice", AuthRole.GUEST, "Alice", "avatar_01", null);
    private final AuthPrincipal bob = new AuthPrincipal("u-bob", AuthRole.GUEST, "Bob", "avatar_02", null);
    private final AuthPrincipal otherTableUser = new AuthPrincipal("u-other", AuthRole.GUEST, "Other", "avatar_03", null);
    private final AuthPrincipal freeRoamer = new AuthPrincipal("u-roam", AuthRole.GUEST, "Roamer", "avatar_04", null);

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        authService = new TableAuthorizationService(stateStore);
        messagingTemplate = mock(SimpMessagingTemplate.class);
        voiceService = new TableVoiceService(stateStore, authService, messagingTemplate);

        long now = System.currentTimeMillis();
        stateStore.savePlayer("main-library", new RoomPlayerState(
                alice.userId(), alice.nickname(), alice.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "T1_S1", "ws-1", true, now, false, now - 5_000L
        ));
        stateStore.savePlayer("main-library", new RoomPlayerState(
                bob.userId(), bob.nickname(), bob.avatarId(), "GUEST", "SEATED",
                5, 5, "DOWN", "table_01", "T1_S2", "ws-2", true, now, false, now - 3_000L
        ));
        stateStore.savePlayer("main-library", new RoomPlayerState(
                otherTableUser.userId(), otherTableUser.nickname(), otherTableUser.avatarId(), "GUEST", "SEATED",
                10, 5, "DOWN", "table_02", "T2_S1", "ws-3", true, now, false, now - 2_000L
        ));
        stateStore.savePlayer("main-library", new RoomPlayerState(
                freeRoamer.userId(), freeRoamer.nickname(), freeRoamer.avatarId(), "GUEST", "FREE_ROAM",
                12, 13, "DOWN", null, null, "ws-4", true, now, false, 0L
        ));
        stateStore.saveTableState("main-library", "table_01", new RedisTableState(alice.userId(), List.of(), false, null));
    }

    @Test
    void rejectsSignalsFromNonSeatedOrDifferentTableLearners() {
        VoiceSignalRequest joinReq = new VoiceSignalRequest(VoiceSignalType.VOICE_JOIN, null, false, null, null);

        assertThatThrownBy(() -> voiceService.relaySignal(freeRoamer, "table_01", joinReq))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.NOT_SEATED_AT_TABLE_TYPE);

        assertThatThrownBy(() -> voiceService.relaySignal(otherTableUser, "table_01", joinReq))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.NOT_SEATED_AT_TABLE_TYPE);
    }

    @Test
    void rejectsTargetedPeerSignalsWhenTargetIsMissingSelfOrNotSeatedAtSameTable() {
        ObjectNode offerSdp = MAPPER.createObjectNode().put("type", "offer").put("sdp", "v=0...");

        assertThatThrownBy(() -> voiceService.relaySignal(
                alice, "table_01", new VoiceSignalRequest(VoiceSignalType.SDP_OFFER, null, null, offerSdp, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);

        assertThatThrownBy(() -> voiceService.relaySignal(
                alice, "table_01", new VoiceSignalRequest(VoiceSignalType.SDP_OFFER, alice.userId(), null, offerSdp, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);

        assertThatThrownBy(() -> voiceService.relaySignal(
                alice, "table_01", new VoiceSignalRequest(VoiceSignalType.SDP_OFFER, otherTableUser.userId(), null, offerSdp, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.TARGET_NOT_SEATED_AT_TABLE_TYPE);

        assertThatThrownBy(() -> voiceService.relaySignal(
                alice, "table_01", new VoiceSignalRequest(VoiceSignalType.ICE_CANDIDATE, bob.userId(), null, null, null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);
    }

    @Test
    void routesPeerSignalsToPrivateVoiceQueueAndBroadcastsPresenceOrMuteToRoomScopedWorkspaceTopic() {
        ObjectNode offerSdp = MAPPER.createObjectNode().put("type", "offer").put("sdp", "v=0-offer");
        ObjectNode answerSdp = MAPPER.createObjectNode().put("type", "answer").put("sdp", "v=0-answer");
        ObjectNode ice = MAPPER.createObjectNode().put("candidate", "candidate:1 1 udp 2122260223 192.0.2.1 54400 typ host");

        TableWorkspaceEvent joinEvent = voiceService.relaySignal(
                alice, "table_01", new VoiceSignalRequest(VoiceSignalType.VOICE_JOIN, null, false, null, null));
        assertThat(joinEvent.type()).isEqualTo("VOICE_SIGNAL");
        assertThat(joinEvent.roomId()).isEqualTo("main-library");
        assertThat(joinEvent.voiceSignal().signalType()).isEqualTo(VoiceSignalType.VOICE_JOIN);
        assertThat(joinEvent.voiceSignal().senderUserId()).isEqualTo("u-alice");
        assertThat(joinEvent.voiceSignal().muted()).isFalse();

        TableWorkspaceEvent offerEvent = voiceService.relaySignal(
                alice, "table_01", new VoiceSignalRequest(VoiceSignalType.SDP_OFFER, "u-bob", null, offerSdp, null));
        TableWorkspaceEvent answerEvent = voiceService.relaySignal(
                bob, "table_01", new VoiceSignalRequest(VoiceSignalType.SDP_ANSWER, "u-alice", null, answerSdp, null));
        assertThat(answerEvent.targetUserId()).isEqualTo("u-alice");
        assertThat(answerEvent.voiceSignal().sdp().path("type").asText()).isEqualTo("answer");

        TableWorkspaceEvent iceEvent = voiceService.relaySignal(
                alice, "table_01", new VoiceSignalRequest(VoiceSignalType.ICE_CANDIDATE, "u-bob", null, null, ice));
        assertThat(iceEvent.voiceSignal().candidate().path("candidate").asText()).contains("candidate:1");

        TableWorkspaceEvent muteEvent = voiceService.relaySignal(
                alice, "table_01", new VoiceSignalRequest(VoiceSignalType.MUTE_STATUS, null, true, null, null));
        assertThat(muteEvent.voiceSignal().muted()).isTrue();

        TableWorkspaceEvent leaveEvent = voiceService.relaySignal(
                alice, "table_01", new VoiceSignalRequest(VoiceSignalType.VOICE_LEAVE, null, null, null, null));

        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/table/table_01/workspace"), eq(joinEvent));
        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/table/table_01/workspace"), eq(muteEvent));
        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/table/table_01/workspace"), eq(leaveEvent));

        verify(messagingTemplate).convertAndSendToUser(eq("u-bob"), eq("/queue/voice"), eq(offerEvent));
        verify(messagingTemplate).convertAndSendToUser(eq("u-alice"), eq("/queue/voice"), eq(answerEvent));
        verify(messagingTemplate).convertAndSendToUser(eq("u-bob"), eq("/queue/voice"), eq(iceEvent));

        verify(messagingTemplate, never()).convertAndSend(eq("/topic/room/main-library/table/table_01/workspace"), eq(offerEvent));
        verify(messagingTemplate, never()).convertAndSend(eq("/topic/room/main-library/table/table_01/workspace"), eq(answerEvent));
        verify(messagingTemplate, never()).convertAndSend(eq("/topic/room/main-library/table/table_01/workspace"), eq(iceEvent));
    }
}
