package com.studytogether.modules.table;

public enum TableMutationType {
    HOMEWORK_UPLOAD("homework-upload", 60_000L, 10, "homework image upload"),
    PERMISSION_REQUEST("permission-request", 30_000L, 5, "permission.request"),
    VOICE_SIGNAL("voice-signal", 10_000L, 40, "voice.signal"),
    VIDEO_SYNC("video-sync", 10_000L, 10, "video.sync"),
    BOARD_SLIDE("board-slide", 10_000L, 10, "board.slide"),
    BOARD_DRAW("board-draw", 5_000L, 20, "board.draw"),
    FOCUS_CYCLE("focus-cycle", 10_000L, 15, "focus.sync"),
    SCRATCHPAD_UPDATE("scratchpad-update", 5_000L, 25, "scratchpad.update");

    private final String keyScope;
    private final long windowMs;
    private final int maxRequests;
    private final String label;

    TableMutationType(String keyScope, long windowMs, int maxRequests, String label) {
        this.keyScope = keyScope;
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.label = label;
    }

    public String keyScope() {
        return keyScope;
    }

    public long windowMs() {
        return windowMs;
    }

    public int maxRequests() {
        return maxRequests;
    }

    public String label() {
        return label;
    }
}
