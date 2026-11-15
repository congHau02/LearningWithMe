package com.studytogether.modules.table;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.table.model.HomeworkSlide;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;

final class TableHomeworkStorage {

    private final Path homeworkDir;

    TableHomeworkStorage(Path homeworkDir) {
        this.homeworkDir = homeworkDir.toAbsolutePath().normalize();
    }

    byte[] readMultipartBytes(MultipartFile file) {
        if (file.getSize() > HomeworkImageValidator.MAX_FILE_BYTES) {
            throw TableExceptions.invalidAction("Homework image exceeds 5MB limit");
        }
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw TableExceptions.invalidAction("Unable to read uploaded homework image");
        }
    }

    void writeFileToTempDir(String fileName, byte[] bytes) {
        try {
            Files.createDirectories(homeworkDir);
            Files.write(resolveSafePath(fileName), bytes);
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "Storage Error", "Failed to store homework image");
        }
    }

    byte[] readExistingFile(String safeFileName) {
        Path resolved = resolveSafePath(safeFileName);
        if (!Files.isRegularFile(resolved)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "Ephemeral File Not Found", "Homework file not found");
        }
        try {
            return Files.readAllBytes(resolved);
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "File Read Error", "Could not read homework file");
        }
    }

    void deleteFileBestEffort(HomeworkSlide slide) {
        try {
            String safeName = HomeworkImageValidator.validateSafeFileName(slide.fileName());
            Files.deleteIfExists(resolveSafePath(safeName));
        } catch (RuntimeException | IOException ignored) {
            // Best-effort cleanup of deleted slide file
        }
    }

    private Path resolveSafePath(String safeFileName) {
        Path resolved = homeworkDir.resolve(safeFileName).normalize();
        if (!resolved.startsWith(homeworkDir)) {
            throw TableExceptions.invalidAction("Invalid storage path");
        }
        return resolved;
    }
}
