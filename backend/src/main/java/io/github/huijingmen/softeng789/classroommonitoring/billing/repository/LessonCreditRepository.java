package io.github.huijingmen.softeng789.classroommonitoring.billing.repository;

import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCredit;
import io.github.huijingmen.softeng789.classroommonitoring.billing.domain.LessonCreditStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface LessonCreditRepository extends JpaRepository<LessonCredit, UUID> {
    interface ReservedSeatCount {
        UUID getSessionId();
        long getReservedSeats();
    }

    @EntityGraph(attributePaths = {
            "sessionPackage", "sessionPackage.student", "sessionPackage.invoice",
            "sessionPackage.courseOffering", "sessionPackage.courseOffering.course",
            "originalSession", "currentSession", "currentSession.roomEntity", "sourceAttendanceRecord"
    })
    List<LessonCredit> findBySessionPackage_IdInOrderBySessionPackage_IdAscSequenceNumberAsc(
            Collection<UUID> packageIds
    );

    @EntityGraph(attributePaths = {"currentSession"})
    List<LessonCredit> findBySessionPackage_Student_IdAndSessionPackage_CourseOffering_Id(
            UUID studentId,
            UUID courseOfferingId
    );

    List<LessonCredit> findBySessionPackage_Student_IdAndCurrentSession_IdOrderBySessionPackage_CreatedAtAscSequenceNumberAsc(
            UUID studentId,
            UUID sessionId
    );

    @EntityGraph(attributePaths = {
            "sessionPackage", "sessionPackage.student", "sessionPackage.invoice",
            "sessionPackage.courseOffering", "sessionPackage.courseOffering.course",
            "originalSession", "currentSession", "currentSession.roomEntity", "sourceAttendanceRecord"
    })
    @Query("select credit from LessonCredit credit where credit.id = :id")
    Optional<LessonCredit> findDetailedById(@Param("id") UUID id);

    @EntityGraph(attributePaths = {
            "sessionPackage", "sessionPackage.student", "sessionPackage.invoice",
            "sessionPackage.courseOffering", "sessionPackage.courseOffering.course",
            "originalSession", "currentSession", "currentSession.roomEntity", "sourceAttendanceRecord"
    })
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select credit from LessonCredit credit where credit.id = :id")
    Optional<LessonCredit> findDetailedByIdForUpdate(@Param("id") UUID id);

    @EntityGraph(attributePaths = {
            "sessionPackage", "sessionPackage.student", "sessionPackage.invoice",
            "sessionPackage.courseOffering", "sessionPackage.courseOffering.course",
            "originalSession", "currentSession", "currentSession.roomEntity", "sourceAttendanceRecord"
    })
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select credit from LessonCredit credit
            where credit.sessionPackage.student.id = :studentId
              and credit.sessionPackage.courseOffering.id = :courseOfferingId
            order by credit.sessionPackage.createdAt asc, credit.sequenceNumber asc
            """)
    List<LessonCredit> findAccountCreditsForUpdate(
            @Param("studentId") UUID studentId,
            @Param("courseOfferingId") UUID courseOfferingId
    );

    @Query("""
            select count(credit) from LessonCredit credit
            where credit.currentSession.id = :sessionId
              and credit.status in :statuses
            """)
    long countReservedSeats(
            @Param("sessionId") UUID sessionId,
            @Param("statuses") Collection<LessonCreditStatus> statuses
    );

    @Query("""
            select credit.currentSession.id as sessionId, count(credit) as reservedSeats
            from LessonCredit credit
            where credit.currentSession.id in :sessionIds
              and credit.status in :statuses
            group by credit.currentSession.id
            """)
    List<ReservedSeatCount> findReservedSeatCounts(
            @Param("sessionIds") Collection<UUID> sessionIds,
            @Param("statuses") Collection<LessonCreditStatus> statuses
    );

    @EntityGraph(attributePaths = {
            "sessionPackage", "sessionPackage.student", "sessionPackage.invoice",
            "sessionPackage.courseOffering", "sessionPackage.courseOffering.course"
    })
    List<LessonCredit> findByStatusInAndExpiresOnBetween(
            Collection<LessonCreditStatus> statuses,
            LocalDate from,
            LocalDate to
    );
}
