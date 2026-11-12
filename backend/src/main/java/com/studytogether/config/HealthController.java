package com.studytogether.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.net.URI;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;

    public HealthController(JdbcTemplate jdbcTemplate, StringRedisTemplate redisTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.redisTemplate = redisTemplate;
    }

    public record HealthResponse(
            String status,
            String service,
            String mysql,
            String redis
    ) {}

    public record EchoProbeRequest(
            @NotBlank(message = "nickname must not be blank")
            @Size(max = 20, message = "nickname must be at most 20 characters")
            String nickname,
            @Size(max = 60, message = "studyGoal must be at most 60 characters")
            String studyGoal
    ) {}

    @GetMapping
    public HealthResponse checkHealth() {
        String mysqlStatus = checkMysql();
        String redisStatus = checkRedis();
        String overall = ("UP".equals(mysqlStatus) && "UP".equals(redisStatus)) ? "UP" : "DEGRADED";
        return new HealthResponse(overall, "study-together-backend", mysqlStatus, redisStatus);
    }

    @PostMapping("/echo")
    public EchoProbeRequest verifyValidationAndError(@Valid @RequestBody EchoProbeRequest request) {
        if ("conflict_probe".equalsIgnoreCase(request.nickname())) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "Seat Already Occupied",
                    "Requested seat is already locked by another learner",
                    URI.create("https://studytogether.com/problems/seat-occupied")
            );
        }
        return request;
    }

    private String checkMysql() {
        try {
            Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return Integer.valueOf(1).equals(result) ? "UP" : "DOWN";
        } catch (Exception ex) {
            return "DOWN";
        }
    }

    private String checkRedis() {
        try {
            String pong = redisTemplate.execute(connection -> connection.ping(), true);
            return "PONG".equalsIgnoreCase(pong) ? "UP" : "DOWN";
        } catch (Exception ex) {
            return "DOWN";
        }
    }
}
