package com.studytogether.modules.stats;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studytogether.config.AppProperties;
import com.studytogether.config.GlobalExceptionHandler;
import com.studytogether.config.SecurityConfig;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtAuthenticationFilter;
import com.studytogether.modules.auth.JwtTokenService;
import com.studytogether.modules.auth.ProblemDetailAuthenticationEntryPoint;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = StudyStatsController.class)
@EnableConfigurationProperties(AppProperties.class)
@Import({
    SecurityConfig.class,
    GlobalExceptionHandler.class,
    ProblemDetailAuthenticationEntryPoint.class,
    JwtTokenService.class,
    JwtAuthenticationFilter.class
})
class StudyStatsControllerWebTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    @MockitoBean
    private StudySessionService studySessionService;

    @Test
    void statsMeRequiresAuthenticationAndReturns401ProblemDetail() throws Exception {
        mockMvc.perform(get("/api/v1/stats/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void statsMeReturnsPersonalStudyStatsForAuthenticatedGuestAndRegisteredUser() throws Exception {
        String guestToken = jwtTokenService.issueGuestToken(new AuthPrincipal(
                "guest-1", AuthRole.GUEST, "Khách", "default_student", "Học React"
        ));
        when(studySessionService.getPersonalStats(any())).thenReturn(new PersonalStudyStatsResponse(
                "guest-1",
                AuthRole.GUEST,
                40L,
                2,
                List.of(
                        new StudySessionDto(null, "main-library", "table_02", "Học React",
                                Instant.parse("2026-11-14T10:00:00Z"), Instant.parse("2026-11-14T10:25:00Z"), 25),
                        new StudySessionDto(null, "main-library", "table_01", "Ôn Java",
                                Instant.parse("2026-11-14T09:00:00Z"), Instant.parse("2026-11-14T09:15:00Z"), 15)
                )
        ));

        mockMvc.perform(get("/api/v1/stats/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + guestToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("guest-1"))
                .andExpect(jsonPath("$.role").value("GUEST"))
                .andExpect(jsonPath("$.totalStudyMinutes").value(40))
                .andExpect(jsonPath("$.totalSessions").value(2))
                .andExpect(jsonPath("$.recentSessions[0].tableId").value("table_02"))
                .andExpect(jsonPath("$.recentSessions[0].durationMinutes").value(25));

        String regToken = jwtTokenService.issueRegisteredToken(new AuthPrincipal(
                "reg-1", AuthRole.REGISTERED, AuthProvider.LOCAL, "an@example.com", "An", "default_student", ""
        ));
        when(studySessionService.getPersonalStats(any())).thenReturn(new PersonalStudyStatsResponse(
                "reg-1",
                AuthRole.REGISTERED,
                120L,
                1,
                List.of(new StudySessionDto(10L, "main-library", "table_01", "Giải đề",
                        Instant.parse("2026-11-14T08:00:00Z"), Instant.parse("2026-11-14T10:00:00Z"), 120))
        ));

        mockMvc.perform(get("/api/v1/stats/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + regToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("reg-1"))
                .andExpect(jsonPath("$.role").value("REGISTERED"))
                .andExpect(jsonPath("$.totalStudyMinutes").value(120))
                .andExpect(jsonPath("$.recentSessions[0].id").value(10));
    }
}
