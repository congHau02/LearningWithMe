package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.TableVideoState;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.VideoSyncAction;
import com.studytogether.modules.table.model.VideoSyncRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TableVideoService {

    private final RoomStateStore stateStore;
    private final TableAuthorizationService authService;
    private final SimpMessagingTemplate messagingTemplate;

    public TableVideoService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.stateStore = stateStore;
        this.authService = authService;
        this.messagingTemplate = messagingTemplate;
    }

    public TableWorkspaceEvent syncVideo(AuthPrincipal principal, String tableId, VideoSyncRequest request) {
        if (request == null || request.action() == null) {
            throw TableExceptions.invalidAction("Video sync action is required");
        }
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String roomId = ctx.roomId();
        RedisTableState current = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
        authService.requireControlPermission(current, principal.userId());

        long now = System.currentTimeMillis();
        TableVideoState previous = current.videoState() != null ? current.videoState() : TableVideoState.empty();
        TableVideoState nextVideo = computeNextVideoState(previous, request, now);

        RedisTableState updated = new RedisTableState(
                current.hostUserId(),
                current.coHostUserIds(),
                current.isFreeCollab(),
                current.sosBanner(),
                nextVideo
        );
        stateStore.saveTableState(roomId, tableId, updated);

        TableWorkspaceEvent event = TableWorkspaceEvent.videoSynced(
                tableId,
                principal.userId(),
                nextVideo,
                updated.hostUserId(),
                updated.coHostUserIds(),
                updated.isFreeCollab(),
                now
        );
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(tableId), event);
        return event;
    }

    private static TableVideoState computeNextVideoState(
            TableVideoState previous,
            VideoSyncRequest request,
            long now
    ) {
        VideoSyncAction action = request.action();
        if (action == VideoSyncAction.CHANGE_URL) {
            String videoId = YouTubeUrlParser.extractVideoId(request.videoUrlOrId());
            double startTime = sanitizeTime(request.currentTime() != null ? request.currentTime() : 0.0);
            return new TableVideoState(videoId, true, startTime, now);
        }

        if (previous.videoId() == null || previous.videoId().isBlank()) {
            throw TableExceptions.invalidAction("No active video is loaded at this table");
        }

        return switch (action) {
            case PLAY -> new TableVideoState(
                    previous.videoId(),
                    true,
                    request.currentTime() != null ? sanitizeTime(request.currentTime()) : previous.currentTime(),
                    now
            );
            case PAUSE -> new TableVideoState(
                    previous.videoId(),
                    false,
                    request.currentTime() != null ? sanitizeTime(request.currentTime()) : previous.currentTime(),
                    now
            );
            case SEEK -> {
                if (request.currentTime() == null) {
                    throw TableExceptions.invalidAction("currentTime is required for SEEK action");
                }
                yield new TableVideoState(
                        previous.videoId(),
                        previous.isPlaying(),
                        sanitizeTime(request.currentTime()),
                        now
                );
            }
            case CHANGE_URL -> throw new IllegalStateException("Unreachable");
        };
    }

    private static double sanitizeTime(double rawSeconds) {
        if (!Double.isFinite(rawSeconds) || rawSeconds < 0.0) {
            return 0.0;
        }
        return rawSeconds;
    }
}
