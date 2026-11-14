package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.table.model.EphemeralImageMetadata;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class EphemeralCleanupSchedulerTest {

    @TempDir
    Path tempHomeworkDir;

    @Test
    void deletesExpiredAndOrphanedFilesWhileKeepingValidFreshFiles() throws Exception {
        Instant now = Instant.parse("2026-11-14T15:00:00Z");
        Clock fixedClock = Clock.fixed(now, ZoneOffset.UTC);
        RoomStateStore stateStore = mock(RoomStateStore.class);

        byte[] webp = "RIFF\u0024\u0000\u0000\u0000WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1);
        Path expiredFile = tempHomeworkDir.resolve("img-expired00001.webp");
        Path orphanFile = tempHomeworkDir.resolve("img-orphan000002.webp");
        Path validFile = tempHomeworkDir.resolve("img-valid0000003.webp");
        Files.write(expiredFile, webp);
        Files.write(orphanFile, webp);
        Files.write(validFile, webp);

        // expiredFile is 6 hours + 1 second old
        Files.setLastModifiedTime(expiredFile, FileTime.from(now.minusSeconds(21601)));
        // orphanFile and validFile are 10 minutes old
        Files.setLastModifiedTime(orphanFile, FileTime.from(now.minusSeconds(600)));
        Files.setLastModifiedTime(validFile, FileTime.from(now.minusSeconds(600)));

        when(stateStore.getEphemeralImage("img-expired00001"))
                .thenReturn(Optional.of(new EphemeralImageMetadata("img-expired00001", "main-library", "table_01", "img-expired00001.webp", "u1", now.minusSeconds(21601).toEpochMilli())));
        when(stateStore.getEphemeralImage("img-orphan000002"))
                .thenReturn(Optional.empty());
        when(stateStore.getEphemeralImage("img-valid0000003"))
                .thenReturn(Optional.of(new EphemeralImageMetadata("img-valid0000003", "main-library", "table_01", "img-valid0000003.webp", "u1", now.minusSeconds(600).toEpochMilli())));

        EphemeralCleanupScheduler scheduler = new EphemeralCleanupScheduler(
                stateStore,
                tempHomeworkDir,
                fixedClock,
                Duration.ofHours(6)
        );

        int deleted = scheduler.cleanupOrphanedAndExpiredFiles();

        assertThat(deleted).isEqualTo(2);
        assertThat(Files.exists(expiredFile)).isFalse();
        assertThat(Files.exists(orphanFile)).isFalse();
        assertThat(Files.exists(validFile)).isTrue();
        verify(stateStore).deleteEphemeralImage("img-expired00001");
    }
}
