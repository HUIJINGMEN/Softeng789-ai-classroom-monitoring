package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.vision.*;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Component;
import tools.jackson.databind.*;
import tools.jackson.databind.node.*;
import static io.github.huijingmen.softeng789.classroommonitoring.kiosk.KioskViews.*;

/** Encryption and irreversible terminal transitions. Never include biometric material in diagnostics. */
@Component
class KioskPayloads {
    final VisionCrypto crypto;
    final ObjectMapper json;
    final EntityManager em;
    KioskPayloads(VisionCrypto crypto, ObjectMapper json, EntityManager em) { this.crypto = crypto; this.json = json; this.em = em; }
    JsonNode decode(String purpose, String payload) {
        try { return json.readTree(crypto.decrypt(purpose, payload)); }
        catch (org.springframework.web.server.ResponseStatusException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("Invalid encrypted kiosk payload."); }
    }
    JsonNode candidates(KioskAttempt a) {
        return a.encryptedCandidates == null ? json.createArrayNode() : decode("kiosk-candidates:" + a.id, a.encryptedCandidates);
    }
    static String shortName(Student student) {
        String last = student.getLastName();
        return student.getFirstName() + (last == null || last.isBlank() ? "" : " " + last.substring(0, last.offsetByCodePoints(0, 1)) + ".");
    }
    ArrayNode candidateSnapshot(JsonNode face, VisionService.Snapshot snapshot) {
        var result = json.createArrayNode();
        var revisions = new HashMap<UUID, String>();
        snapshot.roster().forEach(n -> revisions.put(UUID.fromString(n.path("studentId").asText()), n.path("revision").asText()));
        // Query the database again: a request-scoped persistence context may still contain
        // a student deleted while recognition was running.
        var ids = new ArrayList<UUID>();
        face.path("candidates").forEach(n -> ids.add(UUID.fromString(n.path("studentId").asText())));
        var existing = new HashMap<UUID, Student>();
        if (!ids.isEmpty()) em.createQuery("select s from Student s where s.id in :ids", Student.class)
                .setParameter("ids", ids).getResultList().forEach(s -> existing.put(s.getId(), s));
        var students = ids.stream().map(existing::get).filter(Objects::nonNull).toList();
        var shortNames = students.stream().map(KioskPayloads::shortName).toList();
        var names = new ArrayList<String>();
        for (int i = 0; i < students.size(); i++) {
            var st = students.get(i); String name = shortNames.get(i);
            names.add(Collections.frequency(shortNames, name) > 1 ? st.getFullName() : name);
        }
        for (int i = 0; i < students.size(); i++) {
            var st = students.get(i); String name = names.get(i);
            if (Collections.frequency(names, name) > 1) {
                String number = st.getStudentNumber(); name += " ·" + number.substring(Math.max(0, number.length() - 3));
            }
            result.addObject().put("candidateId", "c" + (i + 1)).put("rank", i + 1).put("displayName", name)
                    .put("studentId", st.getId().toString()).put("revision", revisions.get(st.getId()));
        }
        return result;
    }
    void finish(KioskAttempt a, String state) {
        if (!a.open()) return;
        var candidates = candidates(a);
        if (!candidates.isEmpty()) {
            UUID top = UUID.fromString(candidates.get(0).path("studentId").asText());
            a.topStudentId = em.createQuery("select s.id from Student s where s.id = :id", UUID.class)
                    .setParameter("id", top).getResultList().isEmpty() ? null : top;
        }
        boolean keep = "CONFIRMED".equals(state) || "BLOCKED_NOT_ENROLLED".equals(state)
                || "ALREADY_RECORDED".equals(state) && a.selectedRank != null && a.selectedRank > 1;
        if (keep && a.encryptedCapture != null) {
            var payload = decode("kiosk-capture:" + a.id, a.encryptedCapture);
            var evidence = new KioskEvidence(); evidence.attemptId = a.id; evidence.contentType = payload.path("contentType").asText();
            evidence.encryptedImage = crypto.encrypt("kiosk-evidence:" + a.id, payload.path("image").asText());
            evidence.capturedAt = a.capturedAt; evidence.deleteAfter = a.capturedAt.plus(30, ChronoUnit.DAYS); em.persist(evidence);
        }
        String kind = "BLOCKED_NOT_ENROLLED".equals(state) ? "NOT_ENROLLED_ATTEMPT"
                : Set.of("CONFIRMED", "ALREADY_RECORDED").contains(state) && a.selectedRank != null && a.selectedRank > 1
                    ? "CANDIDATE_SELECTION_MISMATCH" : null;
        if (kind != null) {
            var review = new KioskReviewItem(); review.id = UUID.randomUUID(); review.attemptId = a.id;
            review.kind = kind; review.state = "OPEN"; review.createdAt = KioskTime.now(); em.persist(review);
        }
        a.state = state; a.processedAt = KioskTime.now(); a.encryptedCandidates = null; a.encryptedCapture = null;
    }
    List<Map<String, Object>> candidateCards(KioskAttempt a) {
        var cards = new ArrayList<Map<String, Object>>();
        if (a.open()) candidates(a).forEach(c -> cards.add(fields("candidateId", c.path("candidateId").asText(),
                "rank", c.path("rank").asInt(), "displayName", c.path("displayName").asText(), "photo", null)));
        return cards;
    }
}
