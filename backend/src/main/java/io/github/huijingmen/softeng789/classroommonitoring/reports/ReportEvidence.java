package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.ReportModels.*;

final class ReportEvidence {
    private static final String DRAFT_POLICY = "student-report-v2:";
    private ReportEvidence() { }
    static String fingerprint(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    static Section section(Topic topic, String title, List<String> facts) {
        return new Section(topic, title, List.copyOf(facts), DRAFT_POLICY + fingerprint(String.join("\n", facts)),
                "", "", false, false, null, null);
    }
    static boolean current(Section section) { return section.fingerprint().startsWith(DRAFT_POLICY); }
    static String safe(String value) { return value == null ? "Not recorded" : value; }
}
