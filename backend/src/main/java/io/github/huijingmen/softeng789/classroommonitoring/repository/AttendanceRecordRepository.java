package io.github.huijingmen.softeng789.classroommonitoring.repository;

import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord.AttendanceStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDate;
import java.time.Instant;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, UUID> {
    interface StudentAttendanceRate {
        UUID getStudentId();

        Long getParticipatingCount();

        Long getRecordedCount();
    }

    List<AttendanceRecord> findBySession_Id(UUID sessionId);

    @EntityGraph(attributePaths = {"student"})
    List<AttendanceRecord> findBySession_IdIn(Collection<UUID> sessionIds);

    @EntityGraph(attributePaths = {"student", "session", "session.courseOffering"})
    List<AttendanceRecord> findByStudent_IdInAndSession_IdIn(
            Collection<UUID> studentIds,
            Collection<UUID> sessionIds
    );

    Optional<AttendanceRecord> findBySession_IdAndStudent_Id(UUID sessionId, UUID studentId);

    List<AttendanceRecord> findByStudent_IdOrderBySession_DateDescSession_StartTimeDesc(UUID studentId);

    List<AttendanceRecord> findBySession_CourseOffering_Id(UUID courseOfferingId);

    @EntityGraph(attributePaths = {"student", "session", "session.courseOffering", "session.courseOffering.course"})
    List<AttendanceRecord> findBySession_CourseOffering_IdIn(Collection<UUID> courseOfferingIds);

    @EntityGraph(attributePaths = {"session", "session.courseOffering"})
    @Query("""
            select record from AttendanceRecord record
            where record.student.id = :studentId
              and record.session.courseOffering.id = :offeringId
              and record.session.date between :dateFrom and :dateTo
              and record.session.status =
                  io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession$SessionStatus.COMPLETED
            order by record.session.date asc, record.session.startTime asc
            """)
    List<AttendanceRecord> findPackageAttendance(
            @Param("studentId") UUID studentId,
            @Param("offeringId") UUID offeringId,
            @Param("dateFrom") LocalDate dateFrom,
            @Param("dateTo") LocalDate dateTo
    );

    @Query("""
            select record.student.id as studentId,
                   sum(case when record.status in :participating then 1 else 0 end)
                       as participatingCount,
                   sum(case when record.status <> :unknown then 1 else 0 end)
                       as recordedCount
            from AttendanceRecord record
            where record.student.id in :studentIds
              and record.session.status =
                  io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession$SessionStatus.COMPLETED
              and record.session.startTime <= :asOf and record.session.date <= :schoolDate
            group by record.student.id
            """)
    List<StudentAttendanceRate> summarizeRates(
            @Param("studentIds") Collection<UUID> studentIds,
            @Param("participating") Collection<AttendanceStatus> participating,
            @Param("unknown") AttendanceStatus unknown,
            @Param("asOf") Instant asOf,
            @Param("schoolDate") LocalDate schoolDate
    );

    @Query("""
            select record.student.id as studentId,
                   sum(case when record.status in :participating then 1 else 0 end)
                       as participatingCount,
                   sum(case when record.status <> :unknown then 1 else 0 end)
                       as recordedCount
            from AttendanceRecord record
            join record.session.courseOffering.teachers teacher
            where record.student.id in :studentIds
              and teacher.id = :teacherId
              and record.session.status =
                  io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession$SessionStatus.COMPLETED
              and record.session.startTime <= :asOf and record.session.date <= :schoolDate
            group by record.student.id
            """)
    List<StudentAttendanceRate> summarizeRatesForTeacher(
            @Param("studentIds") Collection<UUID> studentIds,
            @Param("teacherId") UUID teacherId,
            @Param("participating") Collection<AttendanceStatus> participating,
            @Param("unknown") AttendanceStatus unknown,
            @Param("asOf") Instant asOf,
            @Param("schoolDate") LocalDate schoolDate
    );
}
