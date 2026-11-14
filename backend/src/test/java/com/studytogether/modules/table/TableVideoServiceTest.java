package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.VideoSyncAction;
import com.studytogether.modules.table.model.VideoSyncRequest;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TableVideoServiceTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private TableAuthorizationService authService;
    private SimpMessagingTemplate messagingTemplate;
    private TableVideoService videoService;

    private final AuthPrincipal host = new AuthPrincipal("u-host", AuthRole.GUEST, AuthProvider.GUEST, "Host", "avatar_01");
    private final AuthPrincipal member = new AuthPrincipal("u-member", AuthRole.GUEST, AuthProvider.GUEST, "Member", "avatar_02");

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        authService = new TableAuthorizationService(stateStore);
        messagingTemplate = mock(SimpMessagingTemplate.class);
        videoService = new TableVideoService(stateStore, authService, messagingTemplate);

        long now = System.currentTimeMillis();
        stateStore.savePlayer("main-library", new RoomPlayerState(
                host.userId(), host.nickname(), host.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "seat_01", "ws-1", true, now, false, now - 10_000L
        ));
        stateStore.savePlayer("main-library", new RoomPlayerState(
                member.userId(), member.nickname(), member.avatarId(), "GUEST", "SEATED",
                5, 5, "DOWN", "table_01", "seat_02", "ws-2", true, now, false, now - 5_000L
        ));
        stateStore.saveTableState("main-library", "table_01", new RedisTableState(host.userId(), List.of(), false, null));
    }

    @Test
    void hostCanChangeUrlPlayPauseAndSeekWithUrlFormats() {
        TableWorkspaceEvent changeFull = videoService.syncVideo(
                host, "table_01", new VideoSyncRequest(VideoSyncAction.CHANGE_URL, "https://www.youtube.com/watch?v=jfKfPfyJRdk", 0.0)
        );
        assertThat(changeFull.type()).isEqualTo("VIDEO_SYNCED");
        assertThat(changeFull.videoState().videoId()).isEqualTo("jfKfPfyJRdk");
        assertThat(changeFull.videoState().isPlaying()).isTrue();
        verify(messagingTemplate).convertAndSend(eq("/topic/table/table_01/workspace"), eq(changeFull));

        TableWorkspaceEvent changeShort = videoService.syncVideo(
                host, "table_01", new VideoSyncRequest(VideoSyncAction.CHANGE_URL, "https://youtu.be/5qap5aO4i9A?si=xyz", 12.5)
        );
        assertThat(changeShort.videoState().videoId()).isEqualTo("5qap5aO4i9A");
        assertThat(changeShort.videoState().currentTime()).isEqualTo(12.5);

        TableWorkspaceEvent paused = videoService.syncVideo(
                host, "table_01", new VideoSyncRequest(VideoSyncAction.PAUSE, null, 42.0)
        );
        assertThat(paused.videoState().isPlaying()).isFalse();
        assertThat(paused.videoState().currentTime()).isEqualTo(42.0);

        TableWorkspaceEvent seeked = videoService.syncVideo(
                host, "table_01", new VideoSyncRequest(VideoSyncAction.SEEK, null, 95.0)
        );
        assertThat(seeked.videoState().currentTime()).isEqualTo(95.0);
        assertThat(seeked.videoState().isPlaying()).isFalse();

        TableWorkspaceEvent played = videoService.syncVideo(
                host, "table_01", new VideoSyncRequest(VideoSyncAction.PLAY, null, null)
        );
        assertThat(played.videoState().isPlaying()).isTrue();
        assertThat(played.videoState().currentTime()).isEqualTo(95.0);
    }

    @Test
    void rejectsUnauthorizedMemberAndAllowsCoHostOrFreeCollab() {
        assertThatThrownBy(() -> videoService.syncVideo(
                member, "table_01", new VideoSyncRequest(VideoSyncAction.CHANGE_URL, "jfKfPfyJRdk", 0.0)
        ))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Table control requires");

        stateStore.saveTableState("main-library", "table_01", new RedisTableState(host.userId(), List.of("u-member"), false, null));
        TableWorkspaceEvent coHostEv = videoService.syncVideo(
                member, "table_01", new VideoSyncRequest(VideoSyncAction.CHANGE_URL, "jfKfPfyJRdk", 0.0)
        );
        assertThat(coHostEv.videoState().videoId()).isEqualTo("jfKfPfyJRdk");

        stateStore.saveTableState("main-library", "table_01", new RedisTableState(host.userId(), List.of(), true, null, coHostEv.videoState()));
        TableWorkspaceEvent freeCollabPause = videoService.syncVideo(
                member, "table_01", new VideoSyncRequest(VideoSyncAction.PAUSE, null, 15.0)
        );
        assertThat(freeCollabPause.videoState().isPlaying()).isFalse();
    }

    @Test
    void rejectsInvalidYouTubeUrl() {
        assertThatThrownBy(() -> videoService.syncVideo(
                host, "table_01", new VideoSyncRequest(VideoSyncAction.CHANGE_URL, "https://example.com/nope", 0.0)
        ))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Invalid YouTube");
    }
}
