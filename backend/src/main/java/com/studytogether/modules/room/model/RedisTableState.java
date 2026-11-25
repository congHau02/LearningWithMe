package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.studytogether.modules.table.model.HomeworkSlide;
import com.studytogether.modules.table.model.TableScratchpadState;
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
        String activeSlideId,
        TableScratchpadState scratchpadState,
        @JsonProperty("isTableLocked") @JsonAlias("tableLocked") boolean isTableLocked,
        String inviteCode
) {
    public RedisTableState {
        coHostUserIds = coHostUserIds == null ? List.of() : List.copyOf(coHostUserIds);
        videoState = videoState == null ? TableVideoState.empty() : videoState;
        homeworkSlides = homeworkSlides == null ? List.of() : List.copyOf(homeworkSlides);
        scratchpadState = scratchpadState == null ? TableScratchpadState.empty() : scratchpadState;
        inviteCode = (inviteCode == null || inviteCode.isBlank()) ? null : inviteCode.trim();
    }

    public RedisTableState(String hostUserId, List<String> coHostUserIds, boolean isFreeCollab, String sosBanner,
            TableVideoState videoState, List<HomeworkSlide> homeworkSlides, String activeSlideId,
            TableScratchpadState scratchpadState) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState, homeworkSlides, activeSlideId,
                scratchpadState, false, null);
    }

    public RedisTableState(String hostUserId, List<String> coHostUserIds, boolean isFreeCollab, String sosBanner,
            TableVideoState videoState, List<HomeworkSlide> homeworkSlides, String activeSlideId) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState, homeworkSlides, activeSlideId,
                TableScratchpadState.empty(), false, null);
    }

    public RedisTableState(String hostUserId, List<String> coHostUserIds, boolean isFreeCollab, String sosBanner,
            TableVideoState videoState) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState, List.of(), null,
                TableScratchpadState.empty(), false, null);
    }

    public RedisTableState(String hostUserId, List<String> coHostUserIds, boolean isFreeCollab, String sosBanner) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, TableVideoState.empty(), List.of(), null,
                TableScratchpadState.empty(), false, null);
    }

    public RedisTableState withHomeworkSlides(List<HomeworkSlide> nextSlides, String nextActiveSlideId) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState,
                nextSlides, nextActiveSlideId, scratchpadState, isTableLocked, inviteCode);
    }

    public RedisTableState withSosBanner(String nextSosBanner) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, nextSosBanner, videoState,
                homeworkSlides, activeSlideId, scratchpadState, isTableLocked, inviteCode);
    }

    public RedisTableState withVideoState(TableVideoState nextVideoState) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, nextVideoState,
                homeworkSlides, activeSlideId, scratchpadState, isTableLocked, inviteCode);
    }

    public RedisTableState withScratchpadState(TableScratchpadState nextScratchpadState) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState,
                homeworkSlides, activeSlideId, nextScratchpadState, isTableLocked, inviteCode);
    }

    public RedisTableState withPermissions(String nextHostUserId, List<String> nextCoHostUserIds, boolean nextFreeCollab) {
        return new RedisTableState(nextHostUserId, nextCoHostUserIds, nextFreeCollab, sosBanner, videoState,
                homeworkSlides, activeSlideId, scratchpadState, isTableLocked, inviteCode);
    }

    public RedisTableState withTableLock(boolean nextLocked, String nextInviteCode) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState,
                homeworkSlides, activeSlideId, scratchpadState, nextLocked, nextLocked ? nextInviteCode : null);
    }

    public static RedisTableState empty() {
        return new RedisTableState(null, List.of(), false, null, TableVideoState.empty(), List.of(), null,
                TableScratchpadState.empty(), false, null);
    }
}
