package com.studytogether.modules.stats;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/stats")
public class StudyStatsController {

    private final StudySessionService studySessionService;
    private final StudyLeaderboardService studyLeaderboardService;

    public StudyStatsController(
            StudySessionService studySessionService,
            StudyLeaderboardService studyLeaderboardService
    ) {
        this.studySessionService = studySessionService;
        this.studyLeaderboardService = studyLeaderboardService;
    }

    @GetMapping("/me")
    public PersonalStudyStatsResponse getMyStats(@AuthenticationPrincipal AuthPrincipal principal) {
        if (principal == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid Bearer JWT is required");
        }
        return studySessionService.getPersonalStats(principal);
    }

    @GetMapping("/leaderboard")
    public StudyLeaderboardResponse getLeaderboard(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit
    ) {
        if (principal == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid Bearer JWT is required");
        }
        return studyLeaderboardService.getLeaderboard(principal, limit);
    }
}
