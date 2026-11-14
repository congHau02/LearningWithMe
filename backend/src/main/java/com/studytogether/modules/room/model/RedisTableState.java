package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.studytogether.modules.table.model.HomeworkSlide;
import com.studytogether.modules.table.model.TableVideoState;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RedisTableState(
        String hostUserId,
        List<String> coHostUserIds,
        @JsonProperty("isFreeCollab") @JsonAlias("freeCollab") boolean isFreeCollab,
        @JsonDeserialize(using = SosBannerDeserializer.class) String sosBanner,
        TableVideoState videoState,
        List<HomeworkSlide> homeworkSlides,
        String activeSlideId
) {
    public RedisTableState {
        coHostUserIds = coHostUserIds == null ? List.of() : List.copyOf(coHostUserIds);
        videoState = videoState == null ? TableVideoState.empty() : videoState;
        homeworkSlides = homeworkSlides == null ? List.of() : List.copyOf(homeworkSlides);
    }

    public RedisTableState(
            String hostUserId,
            List<String> coHostUserIds,
            boolean isFreeCollab,
            String sosBanner,
            TableVideoState videoState
    ) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState, List.of(), null);
    }

    public RedisTableState(
            String hostUserId,
            List<String> coHostUserIds,
            boolean isFreeCollab,
            String sosBanner
    ) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, TableVideoState.empty(), List.of(), null);
    }

    public RedisTableState withHomeworkSlides(List<HomeworkSlide> nextSlides, String nextActiveSlideId) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState, nextSlides, nextActiveSlideId);
    }

    public RedisTableState withSosBanner(String nextSosBanner) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, nextSosBanner, videoState, homeworkSlides, activeSlideId);
    }

    public RedisTableState withVideoState(TableVideoState nextVideoState) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, nextVideoState, homeworkSlides, activeSlideId);
    }

    public RedisTableState withPermissions(String nextHostUserId, List<String> nextCoHostUserIds, boolean nextFreeCollab) {
        return new RedisTableState(nextHostUserId, nextCoHostUserIds, nextFreeCollab, sosBanner, videoState, homeworkSlides, activeSlideId);
    }

    public static RedisTableState empty() {
        return new RedisTableState(null, List.of(), false, null, TableVideoState.empty(), List.of(), null);
    }
}
