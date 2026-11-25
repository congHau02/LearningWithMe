package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.studytogether.modules.table.model.HomeworkSlide;
import com.studytogether.modules.table.model.QuickCheckSignalState;
import com.studytogether.modules.table.model.TableScratchpadState;
import com.studytogether.modules.table.model.TableVideoState;
import java.util.List;
import java.util.Map;

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
        String inviteCode,
        Map<String, QuickCheckSignalState> quickCheckSignals
) {
    public RedisTableState {
        coHostUserIds = coHostUserIds == null ? List.of() : List.copyOf(coHostUserIds);
        videoState = videoState == null ? TableVideoState.empty() : videoState;
        homeworkSlides = homeworkSlides == null ? List.of() : List.copyOf(homeworkSlides);
        scratchpadState = scratchpadState == null ? TableScratchpadState.empty() : scratchpadState;
        inviteCode = (inviteCode == null || inviteCode.isBlank()) ? null : inviteCode.trim();
        quickCheckSignals = quickCheckSignals == null ? Map.of() : Map.copyOf(quickCheckSignals);
    }

    public RedisTableState(String hostUserId, List<String> coHostUserIds, boolean isFreeCollab, String sosBanner,
            TableVideoState videoState, List<HomeworkSlide> homeworkSlides, String activeSlideId,
            TableScratchpadState scratchpadState, boolean isTableLocked, String inviteCode) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState, homeworkSlides, activeSlideId,
                scratchpadState, isTableLocked, inviteCode, Map.of());
    }

    public RedisTableState(String hostUserId, List<String> coHostUserIds, boolean isFreeCollab, String sosBanner,
            TableVideoState videoState, List<HomeworkSlide> homeworkSlides, String activeSlideId,
            TableScratchpadState scratchpadState) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState, homeworkSlides, activeSlideId,
                scratchpadState, false, null, Map.of());
    }

    public RedisTableState(String hostUserId, List<String> coHostUserIds, boolean isFreeCollab, String sosBanner,
            TableVideoState videoState, List<HomeworkSlide> homeworkSlides, String activeSlideId) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState, homeworkSlides, activeSlideId,
                TableScratchpadState.empty(), false, null, Map.of());
    }

    public RedisTableState(String hostUserId, List<String> coHostUserIds, boolean isFreeCollab, String sosBanner,
            TableVideoState videoState) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState, List.of(), null,
                TableScratchpadState.empty(), false, null, Map.of());
    }

    public RedisTableState(String hostUserId, List<String> coHostUserIds, boolean isFreeCollab, String sosBanner) {
        this(hostUserId, coHostUserIds, isFreeCollab, sosBanner, TableVideoState.empty(), List.of(), null,
                TableScratchpadState.empty(), false, null, Map.of());
    }

    public RedisTableState withHomeworkSlides(List<HomeworkSlide> nextSlides, String nextActiveSlideId) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState,
                nextSlides, nextActiveSlideId, scratchpadState, isTableLocked, inviteCode, quickCheckSignals);
    }

    public RedisTableState withSosBanner(String nextSosBanner) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, nextSosBanner, videoState,
                homeworkSlides, activeSlideId, scratchpadState, isTableLocked, inviteCode, quickCheckSignals);
    }

    public RedisTableState withVideoState(TableVideoState nextVideoState) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, nextVideoState,
                homeworkSlides, activeSlideId, scratchpadState, isTableLocked, inviteCode, quickCheckSignals);
    }

    public RedisTableState withScratchpadState(TableScratchpadState nextScratchpadState) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState,
                homeworkSlides, activeSlideId, nextScratchpadState, isTableLocked, inviteCode, quickCheckSignals);
    }

    public RedisTableState withPermissions(String nextHostUserId, List<String> nextCoHostUserIds, boolean nextFreeCollab) {
        return new RedisTableState(nextHostUserId, nextCoHostUserIds, nextFreeCollab, sosBanner, videoState,
                homeworkSlides, activeSlideId, scratchpadState, isTableLocked, inviteCode, quickCheckSignals);
    }

    public RedisTableState withTableLock(boolean nextLocked, String nextInviteCode) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState,
                homeworkSlides, activeSlideId, scratchpadState, nextLocked, nextLocked ? nextInviteCode : null,
                quickCheckSignals);
    }

    public RedisTableState withQuickCheckSignals(Map<String, QuickCheckSignalState> nextSignals) {
        return new RedisTableState(hostUserId, coHostUserIds, isFreeCollab, sosBanner, videoState,
                homeworkSlides, activeSlideId, scratchpadState, isTableLocked, inviteCode, nextSignals);
    }

    public static RedisTableState empty() {
        return new RedisTableState(null, List.of(), false, null, TableVideoState.empty(), List.of(), null,
                TableScratchpadState.empty(), false, null, Map.of());
    }
}
