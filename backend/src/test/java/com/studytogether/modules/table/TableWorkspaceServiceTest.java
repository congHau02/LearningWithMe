package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.room.RoomTopologyService;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.PermissionAction;
import com.studytogether.modules.table.model.PermissionRequestPayload;
import com.studytogether.modules.table.model.PermissionRespondRequest;
import com.studytogether.modules.table.model.TableRole;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TableWorkspaceServiceTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private RoomTopologyService topologyService;
    private TableAuthorizationService authService;
    private SimpMessagingTemplate messagingTemplate;
    private TableWorkspaceService service;

    private final AuthPrincipal host = new AuthPrincipal("u-host", AuthRole.GUEST, "Host", "avatar_01", null);
    private final AuthPrincipal member = new AuthPrincipal("u-member", AuthRole.GUEST, "Member", "avatar_02", null);
    private final AuthPrincipal outsider = new AuthPrincipal("u-outsider", AuthRole.GUEST, "Outsider", "avatar_03", null);

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        topologyService = new RoomTopologyService(new ObjectMapper());
        authService = new TableAuthorizationService(stateStore);
        messagingTemplate = mock(SimpMessagingTemplate.class);
        service = new TableWorkspaceService(stateStore, topologyService, authService, messagingTemplate);

        long now = System.currentTimeMillis();
        stateStore.savePlayer("main-library", new RoomPlayerState(
                host.userId(), host.nickname(), host.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "seat_01", "ws-1", true, now, false, now - 10_000L
        ));
        stateStore.savePlayer("main-library", new RoomPlayerState(
                member.userId(), member.nickname(), member.avatarId(), "GUEST", "SEATED",
                5, 5, "DOWN", "table_01", "seat_02", "ws-2", true, now, false, now - 5_000L
        ));
        stateStore.savePlayer("main-library", new RoomPlayerState(
                outsider.userId(), outsider.nickname(), outsider.avatarId(), "GUEST", "FREE_ROAM",
                12, 13, "DOWN", null, null, "ws-3", true, now, false, 0L
        ));
        stateStore.saveTableState("main-library", "table_01", new RedisTableState(host.userId(), List.of(), false, null));
    }

    @Test
    void returnsWorkspaceSnapshotWithResolvedRolesAndSitStartTime() {
        TableWorkspaceSnapshot snapshot = service.getWorkspaceSnapshot(member, "main-library", "table_01");

        assertThat(snapshot.tableId()).isEqualTo("table_01");
        assertThat(snapshot.hostUserId()).isEqualTo("u-host");
        assertThat(snapshot.isFreeCollab()).isFalse();
        assertThat(snapshot.members()).hasSize(2);
        assertThat(snapshot.members().get(0).userId()).isEqualTo("u-host");
        assertThat(snapshot.members().get(0).tableRole()).isEqualTo(TableRole.TABLE_HOST);
        assertThat(snapshot.members().get(1).userId()).isEqualTo("u-member");
        assertThat(snapshot.members().get(1).tableRole()).isEqualTo(TableRole.MEMBER);
        assertThat(snapshot.members().get(1).sitStartTimeEpoch()).isPositive();
    }

    @Test
    void rejectsWorkspaceSnapshotAndControlActionsFromNonSeatedLearner() {
        assertThatThrownBy(() -> service.getWorkspaceSnapshot(outsider, "main-library", "table_01"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not seated at table");

        assertThatThrownBy(() -> service.requestControl(outsider, "table_01", new PermissionRequestPayload("help")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not seated at table");
    }

    @Test
    void rejectsPermissionRespondFromMemberWhenNotHost() {
        assertThatThrownBy(() -> service.respondPermission(
                member,
                "table_01",
                new PermissionRespondRequest(PermissionAction.GRANT, member.userId(), null)
        ))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Only Table Host");
    }

    @Test
    void executesFullPermissionHandshakeGrantRevokeTransferHostAndFreeCollab() {
        TableWorkspaceEvent reqEvent = service.requestControl(member, "table_01", new PermissionRequestPayload("Can I control?"));
        assertThat(reqEvent.type()).isEqualTo("PERMISSION_REQUESTED");
        assertThat(reqEvent.actorUserId()).isEqualTo("u-member");
        assertThat(reqEvent.requesterNickname()).isEqualTo("Member");

        TableWorkspaceEvent grantEvent = service.respondPermission(
                host, "table_01", new PermissionRespondRequest(PermissionAction.GRANT, "u-member", null)
        );
        assertThat(grantEvent.coHostUserIds()).containsExactly("u-member");
        assertThat(authService.canControlTable(stateStore.getTableState("main-library", "table_01").orElseThrow(), "u-member")).isTrue();

        TableWorkspaceEvent revokeEvent = service.respondPermission(
                host, "table_01", new PermissionRespondRequest(PermissionAction.REVOKE, "u-member", null)
        );
        assertThat(revokeEvent.coHostUserIds()).isEmpty();
        assertThat(authService.canControlTable(stateStore.getTableState("main-library", "table_01").orElseThrow(), "u-member")).isFalse();

        TableWorkspaceEvent freeCollabEvent = service.respondPermission(
                host, "table_01", new PermissionRespondRequest(PermissionAction.TOGGLE_FREE_COLLAB, null, true)
        );
        assertThat(freeCollabEvent.isFreeCollab()).isTrue();
        assertThat(authService.canControlTable(stateStore.getTableState("main-library", "table_01").orElseThrow(), "u-member")).isTrue();

        TableWorkspaceEvent transferEvent = service.respondPermission(
                host, "table_01", new PermissionRespondRequest(PermissionAction.TRANSFER_HOST, "u-member", null)
        );
        assertThat(transferEvent.hostUserId()).isEqualTo("u-member");
        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/events"), any(RoomEvent.class));
    }
}
