package com.studytogether.modules.table;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studytogether.modules.table.TableHomeworkService.LoadedEphemeralFile;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class HomeworkControllerTest {

    private TableHomeworkService homeworkService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        homeworkService = mock(TableHomeworkService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new HomeworkController(homeworkService)).build();
    }

    @Test
    void servesEphemeralFilesWithExactMagicByteContentTypeAndNoStoreCacheHeader() throws Exception {
        byte[] webp = "RIFF\u0024\u0000\u0000\u0000WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1);
        byte[] png = new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        byte[] jpeg = new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10};

        when(homeworkService.loadEphemeralFile(any(), eq("img-webp.webp")))
                .thenReturn(new LoadedEphemeralFile(webp, "image/webp"));
        when(homeworkService.loadEphemeralFile(any(), eq("img-png.webp")))
                .thenReturn(new LoadedEphemeralFile(png, "image/png"));
        when(homeworkService.loadEphemeralFile(any(), eq("img-jpeg.webp")))
                .thenReturn(new LoadedEphemeralFile(jpeg, "image/jpeg"));

        mockMvc.perform(get("/api/v1/ephemeral-files/img-webp.webp"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/webp"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(content().bytes(webp));

        mockMvc.perform(get("/api/v1/ephemeral-files/img-png.webp"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(content().bytes(png));

        mockMvc.perform(get("/api/v1/ephemeral-files/img-jpeg.webp"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(content().bytes(jpeg));
    }
}
