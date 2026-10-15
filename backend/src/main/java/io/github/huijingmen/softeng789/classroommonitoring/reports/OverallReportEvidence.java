package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import io.github.huijingmen.softeng789.classroommonitoring.service.TeacherScopeSupport;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.reports.OverallReportModels.*;

/** Coordinates authorised scope -> per-course evidence -> immutable snapshot -> draft sections. */
@Component
public class OverallReportEvidence {
    private final CourseOfferingRepository courses;
    private final TeacherScopeSupport access;
    private final OverallReportCourseEvidence courseEvidence;

    public OverallReportEvidence(CourseOfferingRepository courses, TeacherScopeSupport access,
            OverallReportCourseEvidence courseEvidence) {
        this.courses = courses;
        this.access = access;
        this.courseEvidence = courseEvidence;
    }

    void authorize(UUID caller) {
        if (!access.isAdmin(access.requireCaller(caller))) throw new ResponseStatusException(FORBIDDEN,
                "Institution reports are prepared and exported by administrators.");
    }

    Scope normalize(Scope scope) {
        if (scope.dateTo().isBefore(scope.dateFrom()) || ChronoUnit.DAYS.between(scope.dateFrom(), scope.dateTo()) > 366)
            throw new ResponseStatusException(BAD_REQUEST, "Choose a valid reporting period of up to one year.");
        return new Scope(scope.dateFrom(), scope.dateTo(), scope.audience(),
                scope.courseOfferingIds().stream().distinct().sorted().toList());
    }

    Document build(Scope scope, UUID caller) {
        authorize(caller);
        var selected = selectedCourses(scope);
        Instant asOf = Instant.now();
        var facts = selected.stream().map(course -> courseEvidence.load(course, scope, asOf)).toList();
        var snapshot = OverallReportSnapshotBuilder.build(facts, scope, asOf, access.requireCaller(caller).getName());
        var notes = facts.stream().flatMap(row -> row.notes().stream()).toList();
        return new Document(scope.dateFrom(), scope.dateTo(), scope.audience(), scope.courseOfferingIds(),
                OverallReportDrafts.sections(snapshot, scope.audience(), notes), snapshot);
    }

    private List<CourseOffering> selectedCourses(Scope scope) {
        var selected = scope.courseOfferingIds().isEmpty()
                ? courses.findAllByOrderByOfferingCodeAsc() : courses.findAllById(scope.courseOfferingIds());
        if (!scope.courseOfferingIds().isEmpty() && selected.size() != scope.courseOfferingIds().size())
            throw new ResponseStatusException(NOT_FOUND, "A selected course no longer exists.");
        if (selected.size() > 100)
            throw new ResponseStatusException(BAD_REQUEST, "Select up to 100 courses for one report.");
        return selected.stream().sorted(Comparator.comparing(CourseOffering::getOfferingCode)).toList();
    }
}
