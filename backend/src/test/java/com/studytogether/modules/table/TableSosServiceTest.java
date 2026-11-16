package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.SosToggleRequest;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TableSosServiceTest {

    private RoomStateStore stateStore;
    private TableAuthorizationService authService;
    private SimpMessagingTemplate messagingTemplate;
    private TableSosService sosService;

    private static final AuthPrincipal HOST = new AuthPrincipal("u-host", AuthRole.GUEST, "Host", "avatar_01", null);
    private static final AuthPrincipal CO_HOST = new AuthPrincipal("u-cohost", AuthRole.GUEST, "CoHost", "avatar_02", null);
    private static final AuthPrincipal MEMBER = new AuthPrincipal("u-member", AuthRole.GUEST, "Member", "avatar_03", null);

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        authService = new TableAuthorizationService(stateStore);
        messagingTemplate = mock(SimpMessagingTemplate.class);
        sosService = new TableSosService(stateStore, authService, messagingTemplate);

        seedSeated("u-host", "seat_01");
        seedSeated("u-cohost", "seat_02");
        seedSeated("u-member", "seat_03");
    }

    private void seedSeated(String userId, String seatId) {
        stateStore.savePlayer("main-library", new RoomPlayerState(
                userId, userId, "avatar_01", "GUEST", "SEATED", 5, 5, "DOWN", "table_01", seatId, "ws-1", true, 1000L, false, 1000L
        ));
    }

    @Test
    void hostActivatesAndDeactivatesSosWithTrimmedTopic() {
        stateStore.saveTableState("main-library", "table_01", new RedisTableState("u-host", List.of("u-cohost"), false, null));

        TableWorkspaceEvent activated = sosService.toggleSos(HOST, "table_01", new SosToggleRequest(true, "  Cần giúp Tích phân từng phần  "));

        assertThat(activated.type()).isEqualTo("SOS_UPDATED");
        assertThat(activated.sosBanner()).isEqualTo("Cần giúp Tích phân từng phần");
        assertThat(stateStore.getTableState("main-library", "table_01").orElseThrow().sosBanner())
                .isEqualTo("Cần giúp Tích phân từng phần");

        ArgumentCaptor<RoomEvent> roomEventCaptor = ArgumentCaptor.forClass(RoomEvent.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/events"), roomEventCaptor.capture());
        assertThat(roomEventCaptor.getValue().type()).isEqualTo("SOS_UPDATED");
        assertThat(roomEventCaptor.getValue().tableId()).isEqualTo("table_01");
        assertThat(roomEventCaptor.getValue().sosBanner()).isEqualTo("Cần giúp Tích phân từng phần");

        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/table/table_01/workspace"), eq(activated));

        TableWorkspaceEvent deactivated = sosService.toggleSos(CO_HOST, "table_01", new SosToggleRequest(false, null));
        assertThat(deactivated.sosBanner()).isNull();
        assertThat(stateStore.getTableState("main-library", "table_01").orElseThrow().sosBanner()).isNull();
    }

    @Test
    void rejectsUnauthorizedMemberWhenFreeCollabIsOff() {
        stateStore.saveTableState("main-library", "table_01", new RedisTableState("u-host", List.of(), false, null));

        assertThatThrownBy(() -> sosService.toggleSos(MEMBER, "table_01", new SosToggleRequest(true, "Giải tích")))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.TABLE_PERMISSION_DENIED_TYPE);
    }

    @Test
    void allowsMemberWhenFreeCollabIsOnAndValidatesTopicLength() {
        stateStore.saveTableState("main-library", "table_01", new RedisTableState("u-host", List.of(), true, null));

        TableWorkspaceEvent event = sosService.toggleSos(MEMBER, "table_01", new SosToggleRequest(true, "Hóa hữu cơ"));
        assertThat(event.sosBanner()).isEqualTo("Hóa hữu cơ");

        assertThatThrownBy(() -> sosService.toggleSos(MEMBER, "table_01", new SosToggleRequest(true, "   ")))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);

        String tooLong = "A".repeat(TableSosService.MAX_SOS_TOPIC_LENGTH + 1);
        assertThatThrownBy(() -> sosService.toggleSos(MEMBER, "table_01", new SosToggleRequest(true, tooLong)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getType())
                .isEqualTo(TableExceptions.INVALID_TABLE_ACTION_TYPE);
    }
}
