package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

@JsonIgnoreProperties(ignoreUnknown = true)
public record NormalizedPoint(
        @DecimalMin(value = "0.0", message = "Normalized x must be >= 0.0")
        @DecimalMax(value = "1.0", message = "Normalized x must be <= 1.0")
        double x,
        @DecimalMin(value = "0.0", message = "Normalized y must be >= 0.0")
        @DecimalMax(value = "1.0", message = "Normalized y must be <= 1.0")
        double y
) {}
