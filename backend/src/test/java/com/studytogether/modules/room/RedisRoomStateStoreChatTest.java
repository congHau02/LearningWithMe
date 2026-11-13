package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.room.model.RoomChatMessage;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

class RedisRoomStateStoreChatTest {

    private StringRedisTemplate redisTemplate;
    private ListOperations<String, String> listOperations;
    private ObjectMapper objectMapper;
    private RedisRoomStateStore store;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redisTemplate = mock(StringRedisTemplate.class);
        listOperations = mock(ListOperations.class);
        when(redisTemplate.opsForList()).thenReturn(listOperations);
        objectMapper = new ObjectMapper();
        store = new RedisRoomStateStore(redisTemplate, objectMapper);
    }

    @Test
    void appendChatMessagePushesTrimsAndSetsTtl() throws Exception {
        RoomChatMessage message = new RoomChatMessage(
                "msg-123",
                "user-456",
                "Alice",
                "student_glasses",
                "Hello world!",
                1_700_000_000_000L
        );

        store.appendChatMessage("main-library", message, 30);

        String expectedKey = RedisRoomStateStore.chatKey("main-library");
        ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
        verify(listOperations).rightPush(eq(expectedKey), jsonCaptor.capture());
        RoomChatMessage deserialized = objectMapper.readValue(jsonCaptor.getValue(), RoomChatMessage.class);
        assertThat(deserialized.id()).isEqualTo("msg-123");
        assertThat(deserialized.content()).isEqualTo("Hello world!");

        verify(listOperations).trim(expectedKey, -30, -1);
        verify(redisTemplate).expire(eq(expectedKey), eq(Duration.ofHours(24)));
    }
}
