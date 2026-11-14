package com.studytogether.modules.room;

import com.studytogether.modules.room.model.RedisTableState;

/**
 * Published synchronously when the last seated learner leaves a table.
 */
public record TableEmptiedEvent(
        String roomId,
        String tableId,
        RedisTableState lastTableState
) {}
