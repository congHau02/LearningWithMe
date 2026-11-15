package com.studytogether.modules.stats;

import com.studytogether.modules.auth.AuthPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CharacterCustomizationController {

    private final CharacterCustomizationService customizationService;

    public CharacterCustomizationController(CharacterCustomizationService customizationService) {
        this.customizationService = customizationService;
    }

    @GetMapping("/items")
    public ResponseEntity<CharacterItemsCatalogResponse> getCatalog(
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return ResponseEntity.ok(customizationService.getCatalog(principal));
    }

    @PatchMapping("/users/me/customization")
    public ResponseEntity<UpdateCustomizationResponse> updateMyCustomization(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody UpdateCustomizationRequest request
    ) {
        return ResponseEntity.ok(customizationService.updateCustomization(principal, request));
    }
}
