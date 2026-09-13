package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.FeedbackSummary;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedbackSummaryRepository extends JpaRepository<FeedbackSummary, UUID> {
    List<FeedbackSummary> findByStatusNotOrderByCreatedAtDesc(String status);

    List<FeedbackSummary> findByStudent_IdAndStatusNotOrderByCreatedAtDesc(UUID studentId, String status);

    List<FeedbackSummary> findByStudent_IdAndPublishedAtIsNotNullAndStatusOrderByCreatedAtDesc(
            UUID studentId, String status);

    List<FeedbackSummary> findByStudent_IdAndCourseOffering_IdAndDateFromAndDateToAndStatusNot(
            UUID studentId, UUID courseOfferingId, LocalDate dateFrom, LocalDate dateTo, String status);

    Optional<FeedbackSummary> findFirstByStudent_IdAndCourseOffering_IdAndDateFromAndDateToAndSourceFingerprintAndStatusNotOrderByCreatedAtDesc(
            UUID studentId,
            UUID courseOfferingId,
            LocalDate dateFrom,
            LocalDate dateTo,
            String sourceFingerprint,
            String status
    );
}
