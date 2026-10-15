package io.github.huijingmen.softeng789.classroommonitoring.reports;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

public interface StudentReportRepository extends JpaRepository<StudentReport, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select report from StudentReport report where report.id = :id")
    Optional<StudentReport> findForDelivery(UUID id);
    Optional<StudentReport> findFirstByStudentIdAndCreatedByIdAndScopeKeyAndPublishedAtIsNullOrderByCreatedAtDesc(
            UUID studentId, UUID createdById, String scopeKey);
    List<StudentReport> findByStudentIdAndPublishedAtIsNotNullOrderByPublishedAtDesc(UUID studentId);

    @Query("""
            select r from StudentReport r
            where r.studentId in :students and r.scopeKey in :keys
              and (r.createdById = :caller or r.publishedAt is not null)
              and not exists (select newer.id from StudentReport newer
                where newer.studentId = r.studentId and newer.scopeKey = r.scopeKey
                  and ((r.publishedAt is not null and newer.publishedAt > r.publishedAt)
                    or (r.publishedAt is null and newer.publishedAt is null
                      and newer.createdById = r.createdById and newer.createdAt > r.createdAt)))
            order by r.createdAt desc
            """)
    List<StudentReport> findWorkspaceReports(Collection<UUID> students, Collection<String> keys, UUID caller);

    @Query("""
            select r from StudentReport r
            where r.studentId in :students and r.createdById = :caller and r.publishedAt is null
              and not exists (select newer.id from StudentReport newer
                where newer.studentId = r.studentId and newer.createdById = :caller
                  and newer.publishedAt is null and newer.createdAt > r.createdAt)
            order by r.createdAt desc
            """)
    List<StudentReport> findLatestWorkspaceDrafts(Collection<UUID> students, UUID caller);
}
