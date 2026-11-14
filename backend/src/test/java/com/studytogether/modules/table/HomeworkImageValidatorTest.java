package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studytogether.config.BusinessException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class HomeworkImageValidatorTest {

    @Test
    void acceptsValidJpegPngAndWebpMagicBytes() {
        byte[] jpeg = new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10};
        byte[] png = new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        byte[] webp = "RIFF\u0024\u0000\u0000\u0000WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1);

        assertThat(HomeworkImageValidator.detectAndValidateImageType(jpeg)).isEqualTo("image/jpeg");
        assertThat(HomeworkImageValidator.detectAndValidateImageType(png)).isEqualTo("image/png");
        assertThat(HomeworkImageValidator.detectAndValidateImageType(webp)).isEqualTo("image/webp");
    }

    @Test
    void rejectsSpoofedExtensionOrEmptyOrOversizedPayload() {
        byte[] spoofedText = "not-an-image-script".getBytes(StandardCharsets.UTF_8);
        byte[] truncatedWebp = "RIFF1234WEB".getBytes(StandardCharsets.ISO_8859_1);

        assertThatThrownBy(() -> HomeworkImageValidator.detectAndValidateImageType(spoofedText))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        assertThatThrownBy(() -> HomeworkImageValidator.detectAndValidateImageType(truncatedWebp))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        assertThatThrownBy(() -> HomeworkImageValidator.detectAndValidateImageType(new byte[0]))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        byte[] oversized = new byte[HomeworkImageValidator.MAX_FILE_BYTES + 1];
        oversized[0] = (byte) 0xFF;
        oversized[1] = (byte) 0xD8;
        oversized[2] = (byte) 0xFF;
        assertThatThrownBy(() -> HomeworkImageValidator.detectAndValidateImageType(oversized))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void rejectsPathTraversalFileNamesAndAcceptsSimpleWebpName() {
        assertThat(HomeworkImageValidator.validateSafeFileName("slide-abc_123.webp"))
                .isEqualTo("slide-abc_123.webp");

        assertThatThrownBy(() -> HomeworkImageValidator.validateSafeFileName("../secret.txt"))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        assertThatThrownBy(() -> HomeworkImageValidator.validateSafeFileName("sub/slide.webp"))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        assertThatThrownBy(() -> HomeworkImageValidator.validateSafeFileName("..\\slide.webp"))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
