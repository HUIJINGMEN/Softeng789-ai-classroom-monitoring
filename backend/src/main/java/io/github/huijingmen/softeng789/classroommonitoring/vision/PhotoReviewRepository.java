package io.github.huijingmen.softeng789.classroommonitoring.vision;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.*;
public interface PhotoReviewRepository extends JpaRepository<PhotoReview, UUID> {
    Optional<PhotoReview> findByRequestedByAndRequestKey(UUID requestedBy, UUID requestKey);
    List<PhotoReview> findByExpiresAtBefore(Instant now);
    @org.springframework.data.jpa.repository.Query("select r from PhotoReview r join r.subjectIds s where s = :studentId order by r.id")
    List<PhotoReview> findContainingStudent(@org.springframework.data.repository.query.Param("studentId") UUID studentId);
}
