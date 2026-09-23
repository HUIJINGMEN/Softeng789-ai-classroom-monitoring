package io.github.huijingmen.softeng789.classroommonitoring.service;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Locale;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE;

/** Validates uploaded image bytes and produces a real JPEG for the storage layer. */
@Service
public class ImageUploadService {
    static final long MAX_UPLOAD_BYTES = 8L * 1024L * 1024L;
    static final long MAX_IMAGE_PIXELS = 25_000_000L;

    public byte[] normaliseToJpeg(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "Image is required.");
        }
        if (image.getSize() > MAX_UPLOAD_BYTES) {
            throw new ResponseStatusException(PAYLOAD_TOO_LARGE, "Image must be 8 MB or smaller.");
        }

        try {
            byte[] bytes = image.getBytes();
            BufferedImage source = decodeSupportedImage(bytes);
            BufferedImage jpeg = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = jpeg.createGraphics();
            try {
                graphics.setColor(Color.WHITE);
                graphics.fillRect(0, 0, jpeg.getWidth(), jpeg.getHeight());
                graphics.drawImage(source, 0, 0, null);
            } finally {
                graphics.dispose();
            }

            ByteArrayOutputStream output = new ByteArrayOutputStream();
            if (!ImageIO.write(jpeg, "jpg", output)) {
                throw invalidImage();
            }
            return output.toByteArray();
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Uploaded image could not be read.", ex);
        }
    }

    private BufferedImage decodeSupportedImage(byte[] bytes) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (input == null) {
                throw invalidImage();
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw invalidImage();
            }

            ImageReader reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!"jpeg".equals(format) && !"jpg".equals(format) && !"png".equals(format)) {
                    throw new ResponseStatusException(BAD_REQUEST, "Only JPEG and PNG images are supported.");
                }
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_IMAGE_PIXELS) {
                    throw new ResponseStatusException(BAD_REQUEST, "Image dimensions are too large.");
                }
                BufferedImage decoded = reader.read(0);
                if (decoded == null) {
                    throw invalidImage();
                }
                return decoded;
            } finally {
                reader.dispose();
            }
        }
    }

    private ResponseStatusException invalidImage() {
        return new ResponseStatusException(BAD_REQUEST, "Uploaded image could not be read.");
    }
}
