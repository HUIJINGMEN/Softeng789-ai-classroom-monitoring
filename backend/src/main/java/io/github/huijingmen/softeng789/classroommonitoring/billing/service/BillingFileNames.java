package io.github.huijingmen.softeng789.classroommonitoring.billing.service;

/** Keeps a browser-supplied file name safe for database storage and Content-Disposition headers. */
final class BillingFileNames {
    private static final int MAX_FILE_NAME_LENGTH = 255;

    private BillingFileNames() {
    }

    static String safeClientName(String value, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String normalised = value.replace('\\', '/');
        String leaf = normalised.substring(normalised.lastIndexOf('/') + 1);
        String safe = leaf.replaceAll("[\\p{Cntrl}\\\\/]", "_").trim();
        if (safe.isBlank()) return fallback;
        if (safe.codePointCount(0, safe.length()) <= MAX_FILE_NAME_LENGTH) return safe;
        return safe.substring(0, safe.offsetByCodePoints(0, MAX_FILE_NAME_LENGTH));
    }
}
