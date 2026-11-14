package com.studytogether.modules.table;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;

public final class YouTubeUrlParser {

    private static final Pattern VIDEO_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]{11}$");

    private YouTubeUrlParser() {
    }

    public static String extractVideoId(String rawInput) {
        if (rawInput == null || rawInput.isBlank()) {
            throw TableExceptions.invalidAction("YouTube URL or videoId is required");
        }
        String trimmed = rawInput.trim();
        if (VIDEO_ID_PATTERN.matcher(trimmed).matches()) {
            return trimmed;
        }

        URI uri;
        try {
            String normalized = (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
                    ? trimmed
                    : "https://" + trimmed;
            uri = URI.create(normalized);
        } catch (IllegalArgumentException ex) {
            throw TableExceptions.invalidAction("Invalid YouTube URL or videoId");
        }

        String host = uri.getHost() != null ? uri.getHost().toLowerCase(Locale.ROOT) : "";
        if (host.startsWith("www.")) {
            host = host.substring(4);
        }

        String candidate = null;
        if ("youtu.be".equals(host)) {
            String path = uri.getPath();
            if (path != null && path.length() > 1) {
                candidate = path.substring(1).split("/")[0];
            }
        } else if ("youtube.com".equals(host) || "m.youtube.com".equals(host) || "music.youtube.com".equals(host)) {
            String path = uri.getPath() != null ? uri.getPath() : "";
            if ("/watch".equals(path)) {
                candidate = extractQueryParam(uri.getRawQuery(), "v");
            } else {
                String[] segments = path.split("/");
                if (segments.length >= 3
                        && ("embed".equals(segments[1]) || "shorts".equals(segments[1]) || "live".equals(segments[1]))) {
                    candidate = segments[2];
                }
            }
        }

        if (candidate == null || !VIDEO_ID_PATTERN.matcher(candidate).matches()) {
            throw TableExceptions.invalidAction("Invalid YouTube URL or 11-character videoId");
        }
        return candidate;
    }

    private static String extractQueryParam(String rawQuery, String key) {
        if (rawQuery == null || rawQuery.isBlank()) {
            return null;
        }
        for (String pair : rawQuery.split("&")) {
            int idx = pair.indexOf('=');
            if (idx > 0 && key.equals(pair.substring(0, idx))) {
                return pair.substring(idx + 1);
            }
        }
        return null;
    }
}
