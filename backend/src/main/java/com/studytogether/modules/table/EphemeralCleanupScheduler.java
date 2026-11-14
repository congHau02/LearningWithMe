package com.studytogether.modules.table;

import com.studytogether.config.AppProperties;
import com.studytogether.modules.room.RoomStateStore;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodically scans ephemeral homework storage and deletes files that exceed the 6-hour TTL
 * or no longer have a matching {@code ephemeral:img:{imageId}} Redis metadata key.
 */
@Component
public class EphemeralCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(EphemeralCleanupScheduler.class);
    private static final String WEBP_EXTENSION = ".webp";

    private final RoomStateStore stateStore;
    private final Path homeworkDir;
    private final Clock clock;
    private final Duration ttl;

    @Autowired
    public EphemeralCleanupScheduler(
            RoomStateStore stateStore,
            AppProperties appProperties,
            Clock clock
    ) {
        this(
                stateStore,
                Path.of(appProperties.storage().homeworkDir()).toAbsolutePath().normalize(),
                clock,
                TableHomeworkService.EPHEMERAL_IMAGE_TTL
        );
    }

    EphemeralCleanupScheduler(
            RoomStateStore stateStore,
            Path homeworkDir,
            Clock clock,
            Duration ttl
    ) {
        this.stateStore = stateStore;
        this.homeworkDir = homeworkDir.toAbsolutePath().normalize();
        this.clock = clock != null ? clock : Clock.systemUTC();
        this.ttl = ttl != null ? ttl : TableHomeworkService.EPHEMERAL_IMAGE_TTL;
    }

    @Scheduled(fixedDelayString = "${app.storage.cleanup-interval-ms:300000}")
    public int cleanupOrphanedAndExpiredFiles() {
        if (!Files.isDirectory(homeworkDir)) {
            return 0;
        }
        Instant cutoff = clock.instant().minus(ttl);
        int deletedCount = 0;
        try (Stream<Path> entries = Files.list(homeworkDir)) {
            List<Path> files = entries.filter(Files::isRegularFile).toList();
            for (Path file : files) {
                if (shouldDelete(file, cutoff) && deleteQuietly(file)) {
                    deletedCount++;
                }
            }
        } catch (IOException ex) {
            log.warn("Failed to scan ephemeral homework directory {}: {}", homeworkDir, ex.getMessage());
        }
        if (deletedCount > 0) {
            log.info("EphemeralCleanupScheduler removed {} expired/orphaned homework file(s)", deletedCount);
        }
        return deletedCount;
    }

    private boolean shouldDelete(Path file, Instant cutoff) {
        try {
            Instant lastModified = Files.getLastModifiedTime(file).toInstant();
            boolean expired = lastModified.isBefore(cutoff);
            String imageId = extractImageId(file.getFileName().toString());
            if (imageId == null) {
                return expired;
            }
            if (expired) {
                stateStore.deleteEphemeralImage(imageId);
                return true;
            }
            return stateStore.getEphemeralImage(imageId).isEmpty();
        } catch (IOException ex) {
            return false;
        }
    }

    private static String extractImageId(String fileName) {
        if (fileName == null || !fileName.endsWith(WEBP_EXTENSION) || fileName.length() <= WEBP_EXTENSION.length()) {
            return null;
        }
        try {
            return HomeworkImageValidator.extractImageId(fileName);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static boolean deleteQuietly(Path file) {
        try {
            return Files.deleteIfExists(file);
        } catch (IOException ex) {
            log.warn("Failed to delete ephemeral homework file {}: {}", file, ex.getMessage());
            return false;
        }
    }
}
