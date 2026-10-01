package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class BankTransferReceiptStorage {
    private static final long MAX_RECEIPT_BYTES = 8L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "application/pdf", "image/jpeg", "image/png", "image/webp"
    );

    private final Path storageRoot;

    public BankTransferReceiptStorage(
            @Value("${app.storage.bank-transfer-receipt-dir:../data/bank-transfer-receipts}") String storageRoot
    ) {
        this.storageRoot = Path.of(storageRoot);
    }

    public void save(UUID submissionId, MultipartFile receipt) {
        validate(receipt);
        Path temporary = null;
        try {
            Files.createDirectories(storageRoot);
            temporary = Files.createTempFile(storageRoot, ".receipt-", ".tmp");
            receipt.transferTo(temporary);
            move(temporary, receiptPath(submissionId));
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not save the payment receipt.", ex);
        } finally {
            if (temporary != null) {
                try { Files.deleteIfExists(temporary); } catch (IOException ignored) { }
            }
        }
    }

    public Resource load(UUID submissionId) {
        Path path = receiptPath(submissionId);
        if (!Files.isRegularFile(path)) {
            throw new ResponseStatusException(NOT_FOUND, "Payment receipt not found.");
        }
        return new FileSystemResource(path);
    }

    public void delete(UUID submissionId) {
        try {
            Files.deleteIfExists(receiptPath(submissionId));
        } catch (IOException ignored) { }
    }

    public void validate(MultipartFile receipt) {
        if (receipt == null || receipt.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "Attach a bank transfer receipt.");
        }
        if (receipt.getSize() > MAX_RECEIPT_BYTES) {
            throw new ResponseStatusException(BAD_REQUEST, "Receipt files must be 8 MB or smaller.");
        }
        if (!ALLOWED_TYPES.contains(receipt.getContentType())) {
            throw new ResponseStatusException(BAD_REQUEST, "Upload a PDF, JPG, PNG or WebP receipt.");
        }
        if (!matchesDeclaredType(receipt)) {
            throw new ResponseStatusException(BAD_REQUEST, "The receipt content does not match its file type.");
        }
    }

    private boolean matchesDeclaredType(MultipartFile receipt) {
        try {
            byte[] header = receipt.getInputStream().readNBytes(12);
            return switch (receipt.getContentType()) {
                case "application/pdf" -> startsWith(header, new byte[]{'%', 'P', 'D', 'F', '-'});
                case "image/jpeg" -> startsWith(header, new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff});
                case "image/png" -> startsWith(header, new byte[]{
                        (byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a
                });
                case "image/webp" -> startsWith(header, new byte[]{'R', 'I', 'F', 'F'})
                        && header.length >= 12
                        && Arrays.equals(Arrays.copyOfRange(header, 8, 12), new byte[]{'W', 'E', 'B', 'P'});
                default -> false;
            };
        } catch (IOException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Could not read the payment receipt.", ex);
        }
    }

    private boolean startsWith(byte[] value, byte[] prefix) {
        return value.length >= prefix.length
                && Arrays.equals(Arrays.copyOf(value, prefix.length), prefix);
    }

    private void move(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException ex) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private Path receiptPath(UUID submissionId) {
        return storageRoot.resolve(submissionId + ".receipt").normalize();
    }
}
