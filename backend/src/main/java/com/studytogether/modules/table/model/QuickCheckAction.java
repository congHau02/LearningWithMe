package com.studytogether.modules.table.model;

public enum QuickCheckAction {
    UNDERSTOOD,
    SLOW_DOWN,
    RAISE_HAND,
    CLEAR,
    RESET_ALL;

    public QuickCheckSignal toSignal() {
        return switch (this) {
            case UNDERSTOOD -> QuickCheckSignal.UNDERSTOOD;
            case SLOW_DOWN -> QuickCheckSignal.SLOW_DOWN;
            case RAISE_HAND -> QuickCheckSignal.RAISE_HAND;
            case CLEAR, RESET_ALL -> null;
        };
    }
}
