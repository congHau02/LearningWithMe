package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.studytogether.modules.table.model.TableVideoState;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RedisTableState(
        String hostUserId,
        List<String> coHostUserIds,
        @JsonProperty("isFreeCollab") @JsonAlias("freeCollab") boolean isFreeCollab,
        @JsonDeserialize(using = SosBannerDeserializer.class) String sosBanner,
        TableVideoState videoState
) {
    public RedisTableState {
        coHostUserIds = coHostUserIds == null ? List.of() : List.copyOf(coHostUserIds);
        videoState = videoState == null ? TableVideoState.empty() : videoState;
    }

    public RedisTableState(
            String hostUserId,
            List<String> coHostUserIds,
            boolean isFreeCollab,
            String sosBanner
    ) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, TableVideoState.empty());
    }

    public static RedisTableState empty() {
        return new RedisTableState(null, List.of(), false, null, TableVideoState.empty());
    }
}
