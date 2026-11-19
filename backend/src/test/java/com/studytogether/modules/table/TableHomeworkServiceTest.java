package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.studytogether.config.AppProperties;
import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.EphemeralImageMetadata;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TableHomeworkServiceTest {

    @TempDir
    Path tempHomeworkDir;

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private TableHomeworkService service;

    private final AuthPrincipal host = new AuthPrincipal("u-host", AuthRole.GUEST, "Host", "avatar_01", null);
    private final AuthPrincipal otherTable = new AuthPrincipal("u-other-table", AuthRole.GUEST, "OtherTable", "avatar_02", null);
    private final AuthPrincipal otherShard = new AuthPrincipal("u-other-shard", AuthRole.GUEST, "OtherShard", "avatar_03", null);
    private final AuthPrincipal freeRoam = new AuthPrincipal("u-roam", AuthRole.GUEST, "Roam", "avatar_04", null);

    @BeforeEach
    void setUp() throws Exception {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        TableAuthorizationService authService = new TableAuthorizationService(stateStore);
        SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
        AppProperties props = new AppProperties(
                new AppProperties.Jwt("test-secret-must-be-at-least-32-bytes-long"),
                new AppProperties.Storage(tempHomeworkDir.toAbsolutePath().toString()),
                new AppProperties.Cors(List.of("http://localhost:5173")),
                null
        );
        service = new TableHomeworkService(stateStore, authService, messagingTemplate, props);

        long now = System.currentTimeMillis();
        stateStore.savePlayer("main-library", new RoomPlayerState(
                host.userId(), host.nickname(), host.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "T1_S1", "ws-1", true, now, false, now - 5_000L
        ));
        stateStore.savePlayer("main-library", new RoomPlayerState(
                otherTable.userId(), otherTable.nickname(), otherTable.avatarId(), "GUEST", "SEATED",
                10, 5, "DOWN", "table_02", "T2_S1", "ws-2", true, now, false, now - 5_000L
        ));
        stateStore.savePlayer("main-library-2", new RoomPlayerState(
                otherShard.userId(), otherShard.nickname(), otherShard.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "T1_S1", "ws-3", true, now, false, now - 5_000L
        ));
        stateStore.savePlayer("main-library", new RoomPlayerState(
                freeRoam.userId(), freeRoam.nickname(), freeRoam.avatarId(), "GUEST", "FREE_ROAM",
                12, 12, "DOWN", null, null, "ws-4", true, now, false, 0L
        ));

        byte[] webp = "RIFF\u0024\u0000\u0000\u0000WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1);
        Files.write(tempHomeworkDir.resolve("img-111111111111.webp"), webp);
        stateStore.saveEphemeralImage(
                new EphemeralImageMetadata(
                        "img-111111111111", "main-library", "table_01", "img-111111111111.webp", host.userId(), now
                ),
                Duration.ofHours(6)
        );
    }

    @Test
    void loadEphemeralFileAllowsSeatedLearnerAtOwningTableAndRejectsOthers() {
        TableHomeworkService.LoadedEphemeralFile loaded = service.loadEphemeralFile(host, "img-111111111111.webp");
        assertThat(loaded.contentType()).isEqualTo("image/webp");
        assertThat(loaded.bytes()).isNotEmpty();

        assertThatThrownBy(() -> service.loadEphemeralFile(null, "img-111111111111.webp"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        assertThatThrownBy(() -> service.loadEphemeralFile(freeRoam, "img-111111111111.webp"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getStatus())
                .isEqualTo(HttpStatus.FORBIDDEN);

        assertThatThrownBy(() -> service.loadEphemeralFile(otherTable, "img-111111111111.webp"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getStatus())
                .isEqualTo(HttpStatus.FORBIDDEN);

        assertThatThrownBy(() -> service.loadEphemeralFile(otherShard, "img-111111111111.webp"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getStatus())
                .isEqualTo(HttpStatus.FORBIDDEN);

        assertThatThrownBy(() -> service.loadEphemeralFile(host, "img-999999999999.webp"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getStatus())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void loadEphemeralFileReturnsExactMimeTypeFromMagicBytesForPngAndJpegPayloads() throws Exception {
        long now = System.currentTimeMillis();
        byte[] png = new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        byte[] jpeg = new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10};

        Files.write(tempHomeworkDir.resolve("img-222222222222.webp"), png);
        Files.write(tempHomeworkDir.resolve("img-333333333333.webp"), jpeg);
        stateStore.saveEphemeralImage(
                new EphemeralImageMetadata("img-222222222222", "main-library", "table_01", "img-222222222222.webp", host.userId(), now),
                Duration.ofHours(6)
        );
        stateStore.saveEphemeralImage(
                new EphemeralImageMetadata("img-333333333333", "main-library", "table_01", "img-333333333333.webp", host.userId(), now),
                Duration.ofHours(6)
        );

        TableHomeworkService.LoadedEphemeralFile loadedPng = service.loadEphemeralFile(host, "img-222222222222.webp");
        assertThat(loadedPng.contentType()).isEqualTo("image/png");
        assertThat(loadedPng.bytes()).isEqualTo(png);

        TableHomeworkService.LoadedEphemeralFile loadedJpeg = service.loadEphemeralFile(host, "img-333333333333.webp");
        assertThat(loadedJpeg.contentType()).isEqualTo("image/jpeg");
        assertThat(loadedJpeg.bytes()).isEqualTo(jpeg);
    }
}
