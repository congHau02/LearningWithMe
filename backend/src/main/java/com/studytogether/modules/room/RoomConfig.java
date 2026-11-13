package com.studytogether.modules.room;

import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;

@Component
public class RoomConfig {

    public static final int DEFAULT_SHARD_CAPACITY = 50;
    public static final long DEFAULT_SEAT_GRACE_SECONDS = 30L;

    private final int shardCapacity;
    private final Duration seatGraceDuration;

    public RoomConfig(int shardCapacity) {
        this(shardCapacity, DEFAULT_SEAT_GRACE_SECONDS, 0L);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public RoomConfig(
            @Value("${app.room.shard-capacity:" + DEFAULT_SHARD_CAPACITY + "}") int shardCapacity,
            @Value("${app.room.seat-grace-seconds:" + DEFAULT_SEAT_GRACE_SECONDS + "}") long seatGraceSeconds,
            @Value("${app.room.seat-grace-ms:0}") long seatGraceMs
    ) {
        if (shardCapacity < 1) {
            throw new IllegalArgumentException("app.room.shard-capacity must be >= 1");
        }
        if (seatGraceSeconds < 0 || seatGraceMs < 0) {
            throw new IllegalArgumentException("Seat grace duration must be >= 0");
        }
        this.shardCapacity = shardCapacity;
        this.seatGraceDuration = seatGraceMs > 0 ? Duration.ofMillis(seatGraceMs) : Duration.ofSeconds(seatGraceSeconds);
    }

    public int getShardCapacity() {
        return shardCapacity;
    }

    public Duration getSeatGraceDuration() {
        return seatGraceDuration;
    }

    @Bean
    @ConditionalOnMissingBean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
