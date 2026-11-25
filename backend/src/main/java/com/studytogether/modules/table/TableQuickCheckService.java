package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.QuickCheckAction;
import com.studytogether.modules.table.model.QuickCheckRequest;
import com.studytogether.modules.table.model.QuickCheckSignal;
import com.studytogether.modules.table.model.QuickCheckSignalState;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceEvents;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TableQuickCheckService {

    private final RoomStateStore stateStore;
    private final TableAuthorizationService authService;
    private final SimpMessagingTemplate messagingTemplate;
    private final Clock clock;
    private final TableMutationRateLimiter rateLimiter;

    @Autowired
    public TableQuickCheckService(
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

    public TableWorkspaceEvent handleQuickCheck(AuthPrincipal principal, String tableId, QuickCheckRequest request) {
        if (request == null || request.action() == null) {
            throw TableExceptions.invalidAction("Quick check action is required");
        }
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        rateLimiter.enforce(principal.userId(), TableMutationType.QUICK_CHECK);

        long now = clock.millis();
        QuickCheckAction action = request.action();
        RedisTableState updated = stateStore.mutateTableState(ctx.roomId(), tableId, current -> {
            if (action == QuickCheckAction.RESET_ALL) {
                authService.requireHost(current, principal.userId());
                return current.withQuickCheckSignals(Map.of());
            }
            Map<String, QuickCheckSignalState> nextSignals = new HashMap<>(current.quickCheckSignals());
            if (action == QuickCheckAction.CLEAR) {
                nextSignals.remove(principal.userId());
            } else {
                QuickCheckSignal signal = action.toSignal();
                nextSignals.put(principal.userId(), new QuickCheckSignalState(signal, now));
            }
            return current.withQuickCheckSignals(nextSignals);
        });

        String nickname = (ctx.player().nickname() != null && !ctx.player().nickname().isBlank())
                ? ctx.player().nickname()
                : (principal.nickname() != null ? principal.nickname() : principal.userId());
        TableWorkspaceEvent event = TableWorkspaceEvents.quickCheckUpdated(
                tableId, principal.userId(), nickname, updated, now
        ).withRoomId(ctx.roomId());
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(ctx.roomId(), tableId), event);
        return event;
    }
}
