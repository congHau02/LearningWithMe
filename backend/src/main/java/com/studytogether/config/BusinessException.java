package com.studytogether.config;

import java.net.URI;
import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {

    private final HttpStatus status;
    private final String title;
    private final URI type;

    public BusinessException(HttpStatus status, String title, String detail) {
        this(status, title, detail, URI.create("https://studytogether.com/problems/business-error"));
    }

    public BusinessException(HttpStatus status, String title, String detail, URI type) {
        super(detail);
        this.status = status;
        this.title = title;
        this.type = type;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getTitle() {
        return title;
    }

    public URI getType() {
        return type;
    }
}
