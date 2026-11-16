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
import com.studytogether.modules.table.model.TableWorkspaceEvents;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final TableHomeworkStorage storage;
    private final TableMutationRateLimiter rateLimiter;

    public TableHomeworkService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate,
            AppProperties appProperties
    ) {
        this(stateStore, authService, messagingTemplate, appProperties, TableMutationRateLimiter.noOp());
    }

    @Autowired
    public TableHomeworkService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate,
            AppProperties appProperties,
            TableMutationRateLimiter rateLimiter
    ) {
        this.stateStore = stateStore;
        this.authService = authService;
        this.messagingTemplate = messagingTemplate;
        this.storage = new TableHomeworkStorage(Path.of(appProperties.storage().homeworkDir()));
        this.rateLimiter = rateLimiter != null ? rateLimiter : TableMutationRateLimiter.noOp();
    }

    public HomeworkSlide uploadSlide(AuthPrincipal principal, String tableId, MultipartFile file) {
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String roomId = ctx.roomId();
        RedisTableState preCheck = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
        authService.requireControlPermission(preCheck, principal.userId());
        rateLimiter.enforce(principal.userId(), TableMutationType.HOMEWORK_UPLOAD);

        if (file == null || file.isEmpty()) {
            throw TableExceptions.invalidAction("Homework image file is required");
        }
        byte[] bytes = storage.readMultipartBytes(file);
        // shortcut: browser normalizes to .webp; backend validates JPEG/PNG/WEBP magic bytes and stores as {imageId}.webp without native libwebp re-encoding
        HomeworkImageValidator.detectAndValidateImageType(bytes);

        long now = System.currentTimeMillis();
        AtomicReference<HomeworkSlide> createdSlideRef = new AtomicReference<>();
        RedisTableState updated;
        try {
            updated = stateStore.mutateTableState(roomId, tableId, current -> {
                authService.requireControlPermission(current, principal.userId());
                if (current.homeworkSlides().size() >= MAX_SLIDES_PER_TABLE) {
                    throw TableExceptions.invalidAction("Table already has maximum 5 homework slides");
                }
                HomeworkSlide slide = createdSlideRef.get();
                if (slide == null) {
                    slide = persistSlideArtifacts(principal.userId(), roomId, tableId, bytes, now);
                    createdSlideRef.set(slide);
                }
                List<HomeworkSlide> nextSlides = new ArrayList<>(current.homeworkSlides());
                nextSlides.add(slide);
                return current.withHomeworkSlides(nextSlides, slide.imageId());
            });
        } catch (RuntimeException ex) {
            if (createdSlideRef.get() != null) {
                deleteSlideArtifacts(createdSlideRef.get());
            }
            throw ex;
        }

        HomeworkSlide newSlide = createdSlideRef.get();
        TableWorkspaceEvent event = TableWorkspaceEvents.homeworkSlideEvent(
                "HOMEWORK_SLIDE_ADDED", tableId, principal.userId(), updated, now
        ).withRoomId(roomId);
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(roomId, tableId), event);
        return newSlide;
    }

    private HomeworkSlide persistSlideArtifacts(String userId, String roomId, String tableId, byte[] bytes, long now) {
        String imageId = "img-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String fileName = imageId + ".webp";
        stateStore.saveEphemeralImage(
                new EphemeralImageMetadata(imageId, roomId, tableId, fileName, userId, now),
                EPHEMERAL_IMAGE_TTL
        );
        try {
            storage.writeFileToTempDir(fileName, bytes);
        } catch (RuntimeException ex) {
            stateStore.deleteEphemeralImage(imageId);
            throw ex;
        }
        return new HomeworkSlide(imageId, fileName, "/api/v1/ephemeral-files/" + fileName, userId, now);
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
        rateLimiter.enforce(principal.userId(), TableMutationType.BOARD_SLIDE);
        String roomId = ctx.roomId();
        String targetImageId = request.imageId().trim();
        long now = System.currentTimeMillis();
        AtomicReference<HomeworkSlide> deletedSlideRef = new AtomicReference<>();

        RedisTableState updated = stateStore.mutateTableState(roomId, tableId, current -> {
            authService.requireControlPermission(current, principal.userId());
            HomeworkSlide targetSlide = current.homeworkSlides().stream()
                    .filter(s -> s.imageId().equals(targetImageId))
                    .findFirst()
                    .orElseThrow(() -> TableExceptions.invalidAction("Homework slide not found: " + targetImageId));

            if (request.action() == HomeworkSlideAction.SELECT) {
                return current.withHomeworkSlides(current.homeworkSlides(), targetSlide.imageId());
            }
            deletedSlideRef.set(targetSlide);
            List<HomeworkSlide> remaining = current.homeworkSlides().stream()
                    .filter(s -> !s.imageId().equals(targetSlide.imageId()))
                    .toList();
            String nextActiveId = targetSlide.imageId().equals(current.activeSlideId())
                    ? (remaining.isEmpty() ? null : remaining.get(0).imageId())
                    : current.activeSlideId();
            return current.withHomeworkSlides(remaining, nextActiveId);
        });

        String eventType = request.action() == HomeworkSlideAction.SELECT
                ? "HOMEWORK_SLIDE_SELECTED"
                : "HOMEWORK_SLIDE_DELETED";
        if (deletedSlideRef.get() != null) {
            deleteSlideArtifacts(deletedSlideRef.get());
        }

        TableWorkspaceEvent event = TableWorkspaceEvents.homeworkSlideEvent(
                eventType, tableId, principal.userId(), updated, now
        ).withRoomId(roomId);
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(roomId, tableId), event);
        return event;
    }

    public LoadedEphemeralFile loadEphemeralFile(AuthPrincipal principal, String fileName) {
        if (principal == null || principal.userId() == null || principal.userId().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid Bearer token is required");
        }
        String safeName = HomeworkImageValidator.validateSafeFileName(fileName);
        String imageId = HomeworkImageValidator.extractImageId(safeName);
        SeatedContext seated = authService.requireSeatedAnywhere(principal.userId());
        EphemeralImageMetadata metadata = stateStore.getEphemeralImage(imageId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Ephemeral File Not Found", "Homework file expired or not found"));
        if (!seated.roomId().equals(metadata.roomId()) || !seated.tableId().equals(metadata.tableId())) {
            throw TableExceptions.notSeatedAtTable(metadata.tableId());
        }
        byte[] bytes = storage.readExistingFile(safeName);
        return new LoadedEphemeralFile(bytes, HomeworkImageValidator.detectImageContentTypeOrDefault(bytes));
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
        storage.deleteFileBestEffort(slide);
    }
}
