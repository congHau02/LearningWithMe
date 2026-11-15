package com.studytogether.modules.stats;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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

@WebMvcTest(controllers = CharacterCustomizationController.class)
@EnableConfigurationProperties(AppProperties.class)
@Import({
    SecurityConfig.class,
    GlobalExceptionHandler.class,
    ProblemDetailAuthenticationEntryPoint.class,
    JwtTokenService.class,
    JwtAuthenticationFilter.class
})
class CharacterCustomizationControllerWebTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    @MockitoBean
    private CharacterCustomizationService customizationService;

    @Test
    void itemsCatalogRequiresAuthenticationAndReturns401ProblemDetail() throws Exception {
        mockMvc.perform(get("/api/v1/items"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void itemsCatalogReturnsUnlockedAndEquippedItemsForAuthenticatedUser() throws Exception {
        String token = jwtTokenService.issueRegisteredToken(new AuthPrincipal(
                "user-1", AuthRole.REGISTERED, AuthProvider.LOCAL, "user@example.com", "Hau", "skin_hoodie_blue", ""
        ));
        when(customizationService.getCatalog(any())).thenReturn(new CharacterItemsCatalogResponse(
                90L,
                new EquippedCustomizationDto("skin_hoodie_blue", "hat_none", "pet_sprout_pot"),
                List.of(
                        new CharacterItemDto("default_student", "Học Sinh Mặc Định", CharacterItemType.SKIN, 0, true, 0L, false),
                        new CharacterItemDto("skin_hoodie_blue", "Áo Hoodie Xanh Thư Viện", CharacterItemType.SKIN, 60, true, 0L, true),
                        new CharacterItemDto("hat_headphones", "Tai Nghe Lofi Chống Ồn", CharacterItemType.HAT, 120, false, 30L, false)
                )
        ));

        mockMvc.perform(get("/api/v1/items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalStudyMinutes").value(90))
                .andExpect(jsonPath("$.equipped.skinId").value("skin_hoodie_blue"))
                .andExpect(jsonPath("$.equipped.hatId").value("hat_none"))
                .andExpect(jsonPath("$.equipped.deskPetId").value("pet_sprout_pot"))
                .andExpect(jsonPath("$.items[1].unlocked").value(true))
                .andExpect(jsonPath("$.items[1].equipped").value(true))
                .andExpect(jsonPath("$.items[2].unlocked").value(false))
                .andExpect(jsonPath("$.items[2].remainingMinutes").value(30));
    }

    @Test
    void patchCustomizationRejectsInvalidItemPatternWith400ProblemDetail() throws Exception {
        String token = jwtTokenService.issueGuestToken(new AuthPrincipal(
                "guest-1", AuthRole.GUEST, "Khách", "default_student", ""
        ));

        mockMvc.perform(patch("/api/v1/users/me/customization")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "skinId": "bad id with spaces!",
                                  "hatId": "hat_none",
                                  "deskPetId": "pet_sprout_pot"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors.skinId").exists());
    }

    @Test
    void patchCustomizationReturns403ProblemDetailWhenItemLocked() throws Exception {
        String token = jwtTokenService.issueGuestToken(new AuthPrincipal(
                "guest-1", AuthRole.GUEST, "Khách", "default_student", ""
        ));
        when(customizationService.updateCustomization(any(), any()))
                .thenThrow(CustomizationExceptions.itemLocked("hat_graduation_cap", 600, 15));

        mockMvc.perform(patch("/api/v1/users/me/customization")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "skinId": "default_student",
                                  "hatId": "hat_graduation_cap",
                                  "deskPetId": "pet_sprout_pot"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.title").value("Character Item Locked"))
                .andExpect(jsonPath("$.type").value("https://studytogether.com/problems/item-locked"));
    }
}
