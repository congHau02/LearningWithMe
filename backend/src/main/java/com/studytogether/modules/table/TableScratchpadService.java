package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.ScratchpadUpdateRequest;
import com.studytogether.modules.table.model.TableScratchpadState;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceEvents;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TableScratchpadService {

    public static final int MAX_SCRATCHPAD_LENGTH = 4000;

    private final RoomStateStore stateStore;
    private final TableAuthorizationService authService;
    private final SimpMessagingTemplate messagingTemplate;
    private final Clock clock;
    private final TableMutationRateLimiter rateLimiter;

    public TableScratchpadService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this(stateStore, authService, messagingTemplate, Clock.systemUTC(), TableMutationRateLimiter.noOp());
    }

    public TableScratchpadService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate,
            Clock clock
    ) {
        this(stateStore, authService, messagingTemplate, clock, TableMutationRateLimiter.noOp());
    }

    @Autowired
    public TableScratchpadService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate,
            Clock clock,
            TableMutationRateLimiter rateLimiter
    ) {
        this.stateStore = stateStore;
        this.authService = authService;
        this.messagingTemplate = messagingTemplate;
        this.clock = clock != null ? clock : Clock.systemUTC();
        this.rateLimiter = rateLimiter != null ? rateLimiter : TableMutationRateLimiter.noOp();
    }

    public TableWorkspaceEvent updateScratchpad(
            AuthPrincipal principal,
            String tableId,
            ScratchpadUpdateRequest request
    ) {
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String normalized = normalizeContent(request != null ? request.content() : "");
        if (normalized.length() > MAX_SCRATCHPAD_LENGTH) {
            throw TableExceptions.invalidAction("Scratchpad content must not exceed " + MAX_SCRATCHPAD_LENGTH + " characters");
        }
        rateLimiter.enforce(principal.userId(), TableMutationType.SCRATCHPAD_UPDATE);

        long now = clock.millis();
        String nickname = (ctx.player().nickname() != null && !ctx.player().nickname().isBlank())
                ? ctx.player().nickname()
                : (principal.nickname() != null && !principal.nickname().isBlank() ? principal.nickname() : principal.userId());
        TableScratchpadState nextScratchpad = new TableScratchpadState(normalized, principal.userId(), nickname, now);

        RedisTableState updatedState = stateStore.mutateTableState(ctx.roomId(), tableId, current -> {
            authService.requireControlPermission(current, principal.userId());
            return current.withScratchpadState(nextScratchpad);
        });

        TableWorkspaceEvent event = TableWorkspaceEvents.scratchpadUpdated(
                tableId, principal.userId(), nextScratchpad, updatedState, now
        ).withRoomId(ctx.roomId());
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(ctx.roomId(), tableId), event);
        return event;
    }

    private static String normalizeContent(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("\r\n", "\n").replace('\r', '\n');
    }
}
