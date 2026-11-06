package io.github.huijingmen.softeng789.classroommonitoring.kiosk;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Campus;
import jakarta.persistence.*;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.CONFLICT;

/** Retain campus identity for kiosk history; serialize deletion against launch. */
@Component
public class KioskCampusHistory {
    private final EntityManager em;
    public KioskCampusHistory(EntityManager em) { this.em = em; }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireDeletable(Campus campus) {
        em.refresh(campus, LockModeType.PESSIMISTIC_WRITE);
        UUID id = campus.getId();
        boolean sessions = !em.createQuery("select k.id from KioskSession k where k.campusId = :id", UUID.class)
                .setParameter("id", id).setMaxResults(1).getResultList().isEmpty();
        boolean attempts = !em.createQuery("select a.id from KioskAttempt a where a.campusId = :id", UUID.class)
                .setParameter("id", id).setMaxResults(1).getResultList().isEmpty();
        if (sessions || attempts) throw new ResponseStatusException(CONFLICT,
                "This campus has kiosk history and cannot be deleted.");
    }
}
