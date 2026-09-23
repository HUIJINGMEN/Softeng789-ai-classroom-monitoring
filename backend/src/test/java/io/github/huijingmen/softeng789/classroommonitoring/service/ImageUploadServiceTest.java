package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageUploadServiceTest {
    private final ImageUploadService service = new ImageUploadService();

    @Test
    void pngUploadIsDecodedAndStoredAsARealJpeg() throws Exception {
        BufferedImage source = new BufferedImage(4, 3, BufferedImage.TYPE_INT_ARGB);
        source.setRGB(0, 0, Color.GREEN.getRGB());
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(source, "png", png);

        byte[] result = service.normaliseToJpeg(new MockMultipartFile(
                "image", "capture.png", "image/png", png.toByteArray()));

        assertThat(result).startsWith((byte) 0xff, (byte) 0xd8);
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(result));
        assertThat(decoded.getWidth()).isEqualTo(4);
        assertThat(decoded.getHeight()).isEqualTo(3);
    }

    @Test
    void contentTypeCannotDisguiseANonImage() {
        MockMultipartFile upload = new MockMultipartFile(
                "image", "not-an-image.jpg", "image/jpeg", "plain text".getBytes());

        assertThatThrownBy(() -> service.normaliseToJpeg(upload))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("could not be read");
    }

    @Test
    void oversizedUploadIsRejectedBeforeDecode() {
        byte[] oversized = new byte[(int) ImageUploadService.MAX_UPLOAD_BYTES + 1];
        MockMultipartFile upload = new MockMultipartFile(
                "image", "large.jpg", "image/jpeg", oversized);

        assertThatThrownBy(() -> service.normaliseToJpeg(upload))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("8 MB or smaller");
    }
}
