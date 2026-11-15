package com.studytogether.modules.auth;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.stats.EquippedCustomizationDto;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

final class AccountUpgradeSupport {

    record ResolvedCredentials(String email, String passwordHash, String fallbackName) {}

    private AccountUpgradeSupport() {}

    static void validateCallerIsActiveGuest(
            AuthPrincipal principal,
            String optionalBodyGuestToken,
            JwtTokenService jwtTokenService
    ) {
        if (principal == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid Bearer guestToken is required");
        }
        if (principal.role() != AuthRole.GUEST) {
            throw AuthExceptions.alreadyRegistered();
        }
        if (optionalBodyGuestToken != null) {
            jwtTokenService.parseToken(optionalBodyGuestToken)
                    .filter(tp -> tp.role() == AuthRole.GUEST && tp.userId().equals(principal.userId()))
                    .orElseThrow(AuthExceptions::invalidGuestToken);
        }
    }

    static ResolvedCredentials resolveCredentials(
            AuthProvider provider,
            UpgradeAccountRequest request,
            GoogleTokenVerifier googleTokenVerifier,
            PasswordEncoder passwordEncoder
    ) {
        if (provider == AuthProvider.GOOGLE) {
            GoogleUserClaims claims = googleTokenVerifier.verify(request.googleIdToken());
            return new ResolvedCredentials(claims.email(), null, claims.name());
        }
        String hashedPassword = Boolean.TRUE.equals(request.existingAccount())
                ? null
                : passwordEncoder.encode(request.password());
        return new ResolvedCredentials(request.email(), hashedPassword, null);
    }

    static void verifyExistingAccountCredentials(
            UserEntity existingUser,
            AuthProvider targetProvider,
            String rawPassword,
            boolean explicitExistingMode,
            PasswordEncoder passwordEncoder
    ) {
        if (targetProvider == AuthProvider.LOCAL) {
            boolean matches = existingUser.getAuthProvider() == AuthProvider.LOCAL
                    && existingUser.getPasswordHash() != null
                    && rawPassword != null
                    && passwordEncoder.matches(rawPassword, existingUser.getPasswordHash());
            if (!matches) {
                throw explicitExistingMode
                        ? AuthExceptions.invalidCredentials("Invalid email or password")
                        : AuthExceptions.emailConflict("An account with this email already exists. Provide its password to merge, or sign in.");
            }
            return;
        }
        if (existingUser.getAuthProvider() != AuthProvider.GOOGLE) {
            throw AuthExceptions.emailConflict(
                    "An account with this email is already registered with Email & Password. Please sign in with your password."
            );
        }
    }

    static UserEntity buildNewUserEntity(
            String guestId,
            AuthProvider targetProvider,
            ResolvedCredentials credentials,
            long mergedMinutes,
            AuthPrincipal principal,
            EquippedCustomizationDto guestEquipped
    ) {
        String effectiveNickname = resolveNickname(principal.nickname(), credentials.fallbackName());
        String fallbackAvatar = principal.avatarId() != null && !principal.avatarId().isBlank()
                ? principal.avatarId() : GuestAuthService.DEFAULT_AVATAR_ID;
        String effectiveAvatarId = (guestEquipped != null && guestEquipped.skinId() != null && !guestEquipped.skinId().isBlank())
                ? guestEquipped.skinId() : fallbackAvatar;
        UserEntity user = new UserEntity(guestId, effectiveNickname, effectiveAvatarId, targetProvider);
        if (guestEquipped != null) {
            if (guestEquipped.hatId() != null && !guestEquipped.hatId().isBlank()) {
                user.setEquippedHatId(guestEquipped.hatId());
            }
            if (guestEquipped.deskPetId() != null && !guestEquipped.deskPetId().isBlank()) {
                user.setEquippedDeskPetId(guestEquipped.deskPetId());
            }
        }
        user.setEmail(credentials.email());
        user.setPasswordHash(credentials.passwordHash());
        user.setTotalStudyMinutes(mergedMinutes);
        return user;
    }

    static String resolveNickname(String guestNickname, String googleName) {
        if (guestNickname != null && !guestNickname.isBlank()) {
            return guestNickname;
        }
        if (googleName != null && !googleName.isBlank()) {
            return googleName.length() <= 20 ? googleName : googleName.substring(0, 20);
        }
        return "Thành viên mới";
    }
}
