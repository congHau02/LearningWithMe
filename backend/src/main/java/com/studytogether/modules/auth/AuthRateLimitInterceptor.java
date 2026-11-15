package com.studytogether.modules.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Enforces per-IP rate limiting on authentication POST endpoints and returns RFC 7807 429 ProblemDetail.
 */
final class AuthRateLimitInterceptor implements HandlerInterceptor {

    private static final URI RATE_LIMIT_TYPE =
            URI.create("https://studytogether.com/problems/rate-limit-exceeded");

    private final AuthRateLimiter authRateLimiter;
    private final ObjectMapper objectMapper;

    AuthRateLimitInterceptor(AuthRateLimiter authRateLimiter, ObjectMapper objectMapper) {
        this.authRateLimiter = authRateLimiter;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler
    ) throws IOException {
        if (!HttpMethod.POST.matches(request.getMethod())) {
            return true;
        }
        String clientIp = request.getRemoteAddr();
        if (authRateLimiter.isAllowed(clientIp)) {
            return true;
        }

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.TOO_MANY_REQUESTS,
                "Too many authentication requests. Please try again later."
        );
        problem.setType(RATE_LIMIT_TYPE);
        problem.setTitle("Too Many Requests");
        problem.setInstance(URI.create(request.getRequestURI()));

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(authRateLimiter.windowSeconds()));
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), problem);
        return false;
    }
}
