package com.studytogether.modules.table;

import com.studytogether.config.AppProperties;
import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.TableEmptiedEvent;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.EphemeralImageMetadata;
import com.studytogether.modules.table.model.HomeworkSlide;
import com.studytogether.modules.table.model.HomeworkSlideAction;
import com.studytogether.modules.table.model.HomeworkSlideActionRequest;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TableHomeworkService {

    public static final int MAX_SLIDES_PER_TABLE = 5;
    public static final Duration EPHEMERAL_IMAGE_TTL = Duration.ofHours(6);

    public record LoadedEphemeralFile(byte[] bytes, String contentType) {}

    private final RoomStateStore stateStore;
    private final TableAuthorizationService authService;
    private final SimpMessagingTemplate messagingTemplate;
    private final Path homeworkDir;

    public TableHomeworkService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate,
            AppProperties appProperties
    ) {
        this.stateStore = stateStore;
        this.authService = authService;
        this.messagingTemplate = messagingTemplate;
        this.homeworkDir = Path.of(appProperties.storage().homeworkDir()).toAbsolutePath().normalize();
    }

    public HomeworkSlide uploadSlide(AuthPrincipal principal, String tableId, MultipartFile file) {
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String roomId = ctx.roomId();
        RedisTableState current = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
        authService.requireControlPermission(current, principal.userId());

        if (current.homeworkSlides().size() >= MAX_SLIDES_PER_TABLE) {
            throw TableExceptions.invalidAction("Table already has maximum 5 homework slides");
        }
        if (file == null || file.isEmpty()) {
            throw TableExceptions.invalidAction("Homework image file is required");
        }

        byte[] bytes = readMultipartBytes(file);
        // shortcut: browser normalizes to .webp; backend validates JPEG/PNG/WEBP magic bytes and stores as {imageId}.webp without native libwebp re-encoding
        HomeworkImageValidator.detectAndValidateImageType(bytes);

        String imageId = "img-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String fileName = imageId + ".webp";
        long now = System.currentTimeMillis();

        stateStore.saveEphemeralImage(
                new EphemeralImageMetadata(imageId, roomId, tableId, fileName, principal.userId(), now),
                EPHEMERAL_IMAGE_TTL
        );
        try {
            writeFileToTempDir(fileName, bytes);
        } catch (RuntimeException ex) {
            stateStore.deleteEphemeralImage(imageId);
            throw ex;
        }

        HomeworkSlide newSlide = new HomeworkSlide(
                imageId,
                fileName,
                "/api/v1/ephemeral-files/" + fileName,
                principal.userId(),
                now
        );
        List<HomeworkSlide> nextSlides = new ArrayList<>(current.homeworkSlides());
        nextSlides.add(newSlide);

        RedisTableState updated = current.withHomeworkSlides(nextSlides, imageId);
        stateStore.saveTableState(roomId, tableId, updated);

        TableWorkspaceEvent event = TableWorkspaceEvent.homeworkSlideEvent(
                "HOMEWORK_SLIDE_ADDED", tableId, principal.userId(), updated, now
        );
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(tableId), event);
        return newSlide;
    }

    public TableWorkspaceEvent handleSlideAction(
            AuthPrincipal principal,
            String tableId,
            HomeworkSlideActionRequest request
    ) {
        if (request == null || request.action() == null || request.imageId() == null || request.imageId().isBlank()) {
            throw TableExceptions.invalidAction("Homework slide action and imageId are required");
        }
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String roomId = ctx.roomId();
        RedisTableState current = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
        authService.requireControlPermission(current, principal.userId());

        String targetImageId = request.imageId().trim();
        HomeworkSlide targetSlide = current.homeworkSlides().stream()
                .filter(s -> s.imageId().equals(targetImageId))
                .findFirst()
                .orElseThrow(() -> TableExceptions.invalidAction("Homework slide not found: " + targetImageId));

        long now = System.currentTimeMillis();
        RedisTableState updated;
        String eventType;
        if (request.action() == HomeworkSlideAction.SELECT) {
            updated = current.withHomeworkSlides(current.homeworkSlides(), targetSlide.imageId());
            eventType = "HOMEWORK_SLIDE_SELECTED";
        } else {
            List<HomeworkSlide> remaining = current.homeworkSlides().stream()
                    .filter(s -> !s.imageId().equals(targetSlide.imageId()))
                    .toList();
            String nextActiveId = targetSlide.imageId().equals(current.activeSlideId())
                    ? (remaining.isEmpty() ? null : remaining.get(0).imageId())
                    : current.activeSlideId();
            updated = current.withHomeworkSlides(remaining, nextActiveId);
            eventType = "HOMEWORK_SLIDE_DELETED";
            deleteSlideArtifacts(targetSlide);
        }

        stateStore.saveTableState(roomId, tableId, updated);
        TableWorkspaceEvent event = TableWorkspaceEvent.homeworkSlideEvent(
                eventType, tableId, principal.userId(), updated, now
        );
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(tableId), event);
        return event;
    }

    public LoadedEphemeralFile loadEphemeralFile(String fileName) {
        String safeName = HomeworkImageValidator.validateSafeFileName(fileName);
        String imageId = HomeworkImageValidator.extractImageId(safeName);
        stateStore.getEphemeralImage(imageId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Ephemeral File Not Found", "Homework file expired or not found"));
        Path resolved = resolveSafePath(safeName);
        if (!Files.isRegularFile(resolved)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "Ephemeral File Not Found", "Homework file not found");
        }
        try {
            byte[] bytes = Files.readAllBytes(resolved);
            return new LoadedEphemeralFile(bytes, HomeworkImageValidator.detectImageContentTypeOrDefault(bytes));
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "File Read Error", "Could not read homework file");
        }
    }

    @EventListener
    public void onTableEmptied(TableEmptiedEvent event) {
        if (event != null) {
            purgeTableHomework(event.lastTableState());
        }
    }

    public void purgeTableHomework(RedisTableState tableState) {
        if (tableState == null || tableState.homeworkSlides().isEmpty()) {
            return;
        }
        for (HomeworkSlide slide : tableState.homeworkSlides()) {
            deleteSlideArtifacts(slide);
        }
    }

    private void deleteSlideArtifacts(HomeworkSlide slide) {
        stateStore.deleteEphemeralImage(slide.imageId());
        try {
            String safeName = HomeworkImageValidator.validateSafeFileName(slide.fileName());
            Files.deleteIfExists(resolveSafePath(safeName));
        } catch (RuntimeException | IOException ignored) {
            // Best-effort cleanup of deleted slide file
        }
    }

    private void writeFileToTempDir(String fileName, byte[] bytes) {
        try {
            Files.createDirectories(homeworkDir);
            Files.write(resolveSafePath(fileName), bytes);
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "Storage Error", "Failed to store homework image");
        }
    }

    private Path resolveSafePath(String safeFileName) {
        Path resolved = homeworkDir.resolve(safeFileName).normalize();
        if (!resolved.startsWith(homeworkDir)) {
            throw TableExceptions.invalidAction("Invalid storage path");
        }
        return resolved;
    }

    private static byte[] readMultipartBytes(MultipartFile file) {
        if (file.getSize() > HomeworkImageValidator.MAX_FILE_BYTES) {
            throw TableExceptions.invalidAction("Homework image exceeds 5MB limit");
        }
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw TableExceptions.invalidAction("Unable to read uploaded homework image");
        }
    }
}
