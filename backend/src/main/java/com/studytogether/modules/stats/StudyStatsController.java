package com.studytogether.modules.stats;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/stats")
public class StudyStatsController {

    private final StudySessionService studySessionService;

    public StudyStatsController(StudySessionService studySessionService) {
        this.studySessionService = studySessionService;
    }

    @GetMapping("/me")
    public PersonalStudyStatsResponse getMyStats(@AuthenticationPrincipal AuthPrincipal principal) {
        if (principal == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid Bearer JWT is required");
        }
        return studySessionService.getPersonalStats(principal);
    }
}
