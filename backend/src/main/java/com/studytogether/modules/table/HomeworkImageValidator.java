package com.studytogether.modules.table;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * Validates homework image payloads by magic bytes, size limit, and path-safe filenames.
 */
public final class HomeworkImageValidator {

    public static final int MAX_FILE_BYTES = 5 * 1024 * 1024;
    private static final Pattern SAFE_WEBP_NAME = Pattern.compile("^[a-zA-Z0-9_-]+\\.webp$");

    private HomeworkImageValidator() {}

    public static String detectAndValidateImageType(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw TableExceptions.invalidAction("Homework image file is empty");
        }
        if (bytes.length > MAX_FILE_BYTES) {
            throw TableExceptions.invalidAction("Homework image exceeds 5MB limit");
        }
        String mimeType = detectMimeType(bytes);
        if (mimeType == null) {
            throw TableExceptions.invalidAction("Unsupported homework image format. Allowed: JPEG, PNG, WEBP");
        }
        return mimeType;
    }

    public static String detectImageContentTypeOrDefault(byte[] bytes) {
        String mimeType = detectMimeType(bytes);
        return mimeType != null ? mimeType : "image/webp";
    }

    private static String detectMimeType(byte[] bytes) {
        if (bytes == null) return null;
        if (isJpeg(bytes)) return "image/jpeg";
        if (isPng(bytes)) return "image/png";
        if (isWebp(bytes)) return "image/webp";
        return null;
    }

    public static String validateSafeFileName(String fileName) {
        if (fileName == null || !SAFE_WEBP_NAME.matcher(fileName).matches()) {
            throw TableExceptions.invalidAction("Invalid ephemeral homework file name");
        }
        return fileName;
    }

    private static boolean isJpeg(byte[] b) {
        return b.length >= 3
                && (b[0] & 0xFF) == 0xFF
                && (b[1] & 0xFF) == 0xD8
                && (b[2] & 0xFF) == 0xFF;
    }

    private static boolean isPng(byte[] b) {
        return b.length >= 4
                && (b[0] & 0xFF) == 0x89
                && b[1] == 0x50
                && b[2] == 0x4E
                && b[3] == 0x47;
    }

    private static boolean isWebp(byte[] b) {
        if (b.length < 12) {
            return false;
        }
        String riff = new String(b, 0, 4, StandardCharsets.US_ASCII);
        String webp = new String(b, 8, 4, StandardCharsets.US_ASCII);
        return "RIFF".equals(riff) && "WEBP".equals(webp);
    }
}
