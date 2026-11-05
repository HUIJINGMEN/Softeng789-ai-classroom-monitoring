package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class KioskRetention {
    private final KioskSessionService sessions;
    private final KioskPayloads payloads;
    private final EntityManager em;
    public KioskRetention(KioskSessionService sessions, KioskPayloads payloads, EntityManager em) {
        this.sessions = sessions; this.payloads = payloads; this.em = em;
    }
    @Scheduled(fixedDelay = 600000)
    public void purge() {
        // Bounded batches and one row per transaction keep the purge out of request lock chains.
        var attempts = sessions.tx.execute(s -> em.createQuery(
                "select a.id from KioskAttempt a where a.state = 'AWAITING_SELECTION' and a.expiresAt <= :now order by a.expiresAt, a.id", UUID.class)
                .setParameter("now", KioskTime.now()).setMaxResults(500).getResultList());
        for (var id : attempts) sessions.tx.executeWithoutResult(s -> {
            var a = em.find(KioskAttempt.class, id, LockModeType.PESSIMISTIC_WRITE);
            if (a != null && a.open() && !KioskTime.now().isBefore(a.expiresAt)) payloads.finish(a, "EXPIRED");
        });
        var evidence = sessions.tx.execute(s -> em.createQuery(
                "select e.attemptId from KioskEvidence e where e.deleteAfter <= :now order by e.deleteAfter, e.attemptId", UUID.class)
                .setParameter("now", KioskTime.now()).setMaxResults(500).getResultList());
        for (var id : evidence) sessions.tx.executeWithoutResult(s -> {
            var e = em.find(KioskEvidence.class, id, LockModeType.PESSIMISTIC_WRITE);
            if (e != null && !KioskTime.now().isBefore(e.deleteAfter)) em.remove(e);
        });
        var kiosks = sessions.tx.execute(s -> em.createQuery(
                "select k.id from KioskSession k where k.endedAt is null and k.expiresAt <= :now order by k.expiresAt, k.id", UUID.class)
                .setParameter("now", KioskTime.now()).setMaxResults(500).getResultList());
        for (var id : kiosks) sessions.tx.executeWithoutResult(s -> {
            var k = em.find(KioskSession.class, id, LockModeType.PESSIMISTIC_WRITE);
            if (k != null && k.endedAt == null && !KioskTime.now().isBefore(k.expiresAt)) sessions.end(k, null, "EXPIRED");
        });
    }
}
