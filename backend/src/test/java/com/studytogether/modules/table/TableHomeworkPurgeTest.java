package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.studytogether.config.AppProperties;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.TableEmptiedEvent;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.model.HomeworkSlide;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TableHomeworkPurgeTest {

    @TempDir
    Path tempHomeworkDir;

    @Test
    void onTableEmptiedDeletesPhysicalWebpFilesAndRedisEphemeralKeys() throws Exception {
        RoomStateStore stateStore = mock(RoomStateStore.class);
        TableAuthorizationService authService = mock(TableAuthorizationService.class);
        SimpMessagingTemplate messagingTemplate = mock(SimpMessagingTemplate.class);
        AppProperties props = new AppProperties(
                new AppProperties.Jwt("test-secret-must-be-at-least-32-bytes-long"),
                new AppProperties.Storage(tempHomeworkDir.toAbsolutePath().toString()),
                new AppProperties.Cors(List.of("http://localhost:5173")),
                null
        );
        TableHomeworkService service = new TableHomeworkService(stateStore, authService, messagingTemplate, props);

        Path slide1 = tempHomeworkDir.resolve("img-111111111111.webp");
        Path slide2 = tempHomeworkDir.resolve("img-222222222222.webp");
        Path unrelated = tempHomeworkDir.resolve("img-999999999999.webp");
        byte[] webp = "RIFF\u0024\u0000\u0000\u0000WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1);
        Files.write(slide1, webp);
        Files.write(slide2, webp);
        Files.write(unrelated, webp);

        RedisTableState lastState = new RedisTableState(
                "u-host",
                List.of(),
                false,
                null,
                null,
                List.of(
                        new HomeworkSlide("img-111111111111", "img-111111111111.webp", "/api/v1/ephemeral-files/img-111111111111.webp", "u-host", 1000L),
                        new HomeworkSlide("img-222222222222", "img-222222222222.webp", "/api/v1/ephemeral-files/img-222222222222.webp", "u-host", 2000L)
                ),
                "img-111111111111"
        );

        service.onTableEmptied(new TableEmptiedEvent("main-library", "table_01", lastState));

        assertThat(Files.exists(slide1)).isFalse();
        assertThat(Files.exists(slide2)).isFalse();
        assertThat(Files.exists(unrelated)).isTrue();
        verify(stateStore).deleteEphemeralImage("img-111111111111");
        verify(stateStore).deleteEphemeralImage("img-222222222222");
    }
}
