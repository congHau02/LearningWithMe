package com.studytogether.modules.room;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RoomConfig {

    public static final int DEFAULT_SHARD_CAPACITY = 50;

    private final int shardCapacity;

    public RoomConfig(@Value("${app.room.shard-capacity:" + DEFAULT_SHARD_CAPACITY + "}") int shardCapacity) {
        if (shardCapacity < 1) {
            throw new IllegalArgumentException("app.room.shard-capacity must be >= 1");
        }
        this.shardCapacity = shardCapacity;
    }

    public int getShardCapacity() {
        return shardCapacity;
    }
}
