package com.studytogether.modules.auth;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

public class LoginRequestValidator implements ConstraintValidator<ValidLoginRequest, LoginRequest> {

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final int MAX_BCRYPT_PASSWORD_BYTES = 72;

    @Override
    public boolean isValid(LoginRequest request, ConstraintValidatorContext context) {
        if (request == null) {
            return true;
        }
        AuthProvider provider = request.provider();
        if (provider == null || provider == AuthProvider.GUEST) {
            addViolation(context, "provider", "provider must be LOCAL or GOOGLE");
            return false;
        }

        boolean valid = true;
        if (provider == AuthProvider.LOCAL) {
            valid &= validateEmail(request.email(), context);
            valid &= validatePassword(request.password(), context);
        } else if (provider == AuthProvider.GOOGLE) {
            if (request.googleIdToken() == null || request.googleIdToken().isBlank()) {
                addViolation(context, "googleIdToken", "googleIdToken must not be blank for GOOGLE login");
                valid = false;
            }
        }
        return valid;
    }

    private boolean validateEmail(String email, ConstraintValidatorContext context) {
        if (email == null || email.isBlank()) {
            addViolation(context, "email", "email must not be blank for LOCAL login");
            return false;
        }
        if (email.length() > 255 || !EMAIL_PATTERN.matcher(email).matches()) {
            addViolation(context, "email", "email must be a valid email address");
            return false;
        }
        return true;
    }

    private boolean validatePassword(String password, ConstraintValidatorContext context) {
        if (password == null || password.isBlank()) {
            addViolation(context, "password", "password must not be blank for LOCAL login");
            return false;
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_BCRYPT_PASSWORD_BYTES) {
            addViolation(context, "password", "password must be at most 72 UTF-8 bytes");
            return false;
        }
        return true;
    }

    private void addViolation(ConstraintValidatorContext context, String field, String message) {
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(message)
                .addPropertyNode(field)
                .addConstraintViolation();
    }
}
