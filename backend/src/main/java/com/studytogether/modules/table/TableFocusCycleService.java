package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.FocusCycleAction;
import com.studytogether.modules.table.model.FocusCyclePhase;
import com.studytogether.modules.table.model.FocusCycleSyncRequest;
import com.studytogether.modules.table.model.TableFocusCycleState;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceEvents;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Synchronizes a Table's shared Focus Cycle (FOCUS / SHORT_BREAK) using wall-clock Epoch timestamps.
 */
@Service
public class TableFocusCycleService {

    private final RoomStateStore stateStore;
    private final TableAuthorizationService authService;
    private final SimpMessagingTemplate messagingTemplate;
    private final TableMutationRateLimiter rateLimiter;
    private final Clock clock;

    public TableFocusCycleService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this(stateStore, authService, messagingTemplate, TableMutationRateLimiter.noOp(), Clock.systemUTC());
    }

    @Autowired
    public TableFocusCycleService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate,
            TableMutationRateLimiter rateLimiter,
            Clock clock
    ) {
        this.stateStore = stateStore;
        this.authService = authService;
        this.messagingTemplate = messagingTemplate;
        this.rateLimiter = rateLimiter != null ? rateLimiter : TableMutationRateLimiter.noOp();
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    public TableWorkspaceEvent syncFocusCycle(AuthPrincipal principal, String tableId, FocusCycleSyncRequest request) {
        if (request == null || request.action() == null) {
            throw TableExceptions.invalidAction("Focus cycle action is required");
        }
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        rateLimiter.enforce(principal.userId(), TableMutationType.FOCUS_CYCLE);
        String roomId = ctx.roomId();
        long now = clock.millis();

        RedisTableState updated = stateStore.mutateTableState(roomId, tableId, current -> {
            authService.requireControlPermission(current, principal.userId());
            TableFocusCycleState previous = current.focusCycleState() != null
                    ? current.focusCycleState()
                    : TableFocusCycleState.initial();
            TableFocusCycleState next = computeNextState(previous, request, now);
            return current.withFocusCycleState(next);
        });

        TableWorkspaceEvent event = TableWorkspaceEvents.focusCycleUpdated(
                tableId, principal.userId(), request.action(), updated.focusCycleState(), updated, now
        ).withRoomId(roomId);
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(roomId, tableId), event);
        return event;
    }

    public static int computeRemainingSeconds(TableFocusCycleState state, long nowEpoch) {
        if (state == null) {
            return TableFocusCycleState.DEFAULT_FOCUS_MINUTES * 60;
        }
        if (!state.isRunning() || state.lastUpdatedEpoch() <= 0L) {
            return Math.max(0, state.remainingSeconds());
        }
        long elapsedSeconds = Math.max(0L, (nowEpoch - state.lastUpdatedEpoch()) / 1000L);
        return (int) Math.max(0L, state.remainingSeconds() - elapsedSeconds);
    }

    private static TableFocusCycleState computeNextState(
            TableFocusCycleState previous,
            FocusCycleSyncRequest request,
            long now
    ) {
        int currentRemaining = computeRemainingSeconds(previous, now);
        FocusCycleAction action = request.action();
        return switch (action) {
            case START, RESUME -> {
                int nextRemaining = currentRemaining > 0
                        ? currentRemaining
                        : previous.durationSecondsFor(previous.phase());
                yield new TableFocusCycleState(
                        previous.phase(), true, nextRemaining,
                        previous.focusMinutes(), previous.breakMinutes(), now
                );
            }
            case PAUSE -> new TableFocusCycleState(
                    previous.phase(), false, currentRemaining,
                    previous.focusMinutes(), previous.breakMinutes(), now
            );
            case RESET -> new TableFocusCycleState(
                    previous.phase(), false, previous.durationSecondsFor(previous.phase()),
                    previous.focusMinutes(), previous.breakMinutes(), now
            );
            case SWITCH_PHASE -> {
                FocusCyclePhase nextPhase = request.phase() != null
                        ? request.phase()
                        : (previous.phase() == FocusCyclePhase.FOCUS ? FocusCyclePhase.SHORT_BREAK : FocusCyclePhase.FOCUS);
                yield new TableFocusCycleState(
                        nextPhase, false, previous.durationSecondsFor(nextPhase),
                        previous.focusMinutes(), previous.breakMinutes(), now
                );
            }
            case SET_PRESET -> applyPreset(previous, request, now);
        };
    }

    private static TableFocusCycleState applyPreset(
            TableFocusCycleState previous,
            FocusCycleSyncRequest request,
            long now
    ) {
        Integer focusMinutes = request.focusMinutes();
        Integer breakMinutes = request.breakMinutes();
        boolean isStandard = Integer.valueOf(25).equals(focusMinutes) && Integer.valueOf(5).equals(breakMinutes);
        boolean isDeep = Integer.valueOf(50).equals(focusMinutes) && Integer.valueOf(10).equals(breakMinutes);
        if (!isStandard && !isDeep) {
            throw TableExceptions.invalidAction("Supported presets are 25/5 or 50/10 minutes");
        }
        int nextDuration = (previous.phase() == FocusCyclePhase.SHORT_BREAK ? breakMinutes : focusMinutes) * 60;
        return new TableFocusCycleState(
                previous.phase(), false, nextDuration, focusMinutes, breakMinutes, now
        );
    }
}
