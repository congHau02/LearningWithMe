package com.studytogether.modules.room.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class RedisTableStateDeserializationTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void ignoresLegacyTimerFieldWhenDeserializingPreExistingRedisTableState() throws Exception {
        String legacyJson = """
                {
                  "hostUserId": "u-host-1",
                  "coHostUserIds": ["u-cohost-2"],
                  "isFreeCollab": true,
                  "sosBanner": "Cần hỗ trợ Giải tích",
                  "videoState": {
                    "videoId": "jfKfPfyJRdk",
                    "isPlaying": true,
                    "currentTime": 42.5,
                    "lastUpdatedEpoch": 1700000000000
                  },
                  "homeworkSlides": [],
                  "activeSlideId": null,
                  "focusCycleState": {
                    "phase": "FOCUS",
                    "isRunning": true,
                    "focusMinutes": 25,
                    "breakMinutes": 5,
                    "remainingSeconds": 1200,
                    "lastUpdatedEpoch": 1700000000000
                  },
                  "scratchpadState": {
                    "content": "f(x) = x^2",
                    "updatedByUserId": "u-host-1",
                    "updatedByNickname": "Host",
                    "updatedAtEpoch": 1700000000000
                  }
                }
                """;

        RedisTableState state = objectMapper.readValue(legacyJson, RedisTableState.class);

        assertThat(state.hostUserId()).isEqualTo("u-host-1");
        assertThat(state.coHostUserIds()).containsExactly("u-cohost-2");
        assertThat(state.isFreeCollab()).isTrue();
        assertThat(state.sosBanner()).isEqualTo("Cần hỗ trợ Giải tích");
        assertThat(state.videoState().videoId()).isEqualTo("jfKfPfyJRdk");
        assertThat(state.videoState().isPlaying()).isTrue();
        assertThat(state.scratchpadState().content()).isEqualTo("f(x) = x^2");
    }
}
