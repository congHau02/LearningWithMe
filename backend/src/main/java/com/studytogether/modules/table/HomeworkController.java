package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.table.TableHomeworkService.LoadedEphemeralFile;
import com.studytogether.modules.table.model.HomeworkSlide;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
public class HomeworkController {

    private final TableHomeworkService homeworkService;

    public HomeworkController(TableHomeworkService homeworkService) {
        this.homeworkService = homeworkService;
    }

    @PostMapping(path = "/tables/{tableId}/homework-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public HomeworkSlide uploadHomeworkImage(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable String tableId,
            @RequestParam("file") MultipartFile file
    ) {
        return homeworkService.uploadSlide(principal, tableId, file);
    }

    @GetMapping("/ephemeral-files/{fileName}")
    public ResponseEntity<byte[]> getEphemeralFile(@PathVariable String fileName) {
        LoadedEphemeralFile loaded = homeworkService.loadEphemeralFile(fileName);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(loaded.contentType()))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePrivate())
                .body(loaded.bytes());
    }
}
