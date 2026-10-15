package io.github.huijingmen.softeng789.classroommonitoring.reports;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Accomplishment;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassFeedback;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ProgressReport;
import java.util.Comparator;
import java.util.List;

final class ReportSourceEvidence {
    private static final int MAX_FEEDBACK_EXCERPTS = 3;
    private static final int MAX_EXCERPT_CODE_POINTS = 360;

    private ReportSourceEvidence() { }
    static String label(CourseOffering course) {
        return course.getCourse().getCode() + " · " + course.getAcademicTerm();
    }
    static String excerpt(String text) {
        String clean = text == null ? "" : text.strip();
        return clean.codePointCount(0, clean.length()) > MAX_EXCERPT_CODE_POINTS
                ? clean.substring(0, clean.offsetByCodePoints(0, MAX_EXCERPT_CODE_POINTS)) + "…" : clean;
    }
    static List<ReportSourceModels.Feedback> personalFeedback(List<ProgressReport> notes) {
        return notes.stream().sorted(Comparator.comparing(ProgressReport::getCreatedAt).reversed()
                .thenComparing(ProgressReport::getId)).limit(MAX_FEEDBACK_EXCERPTS)
                .map(row -> new ReportSourceModels.Feedback(row.getId(), label(row.getCourseOffering()),
                        row.getTeacher().getName(), row.getCreatedAt(), excerpt(row.getComment()))).toList();
    }
    static List<ReportSourceModels.Feedback> classFeedback(List<ClassFeedback> notes) {
        return notes.stream().sorted(Comparator.comparing(ClassFeedback::getCreatedAt).reversed()
                .thenComparing(ClassFeedback::getId)).limit(MAX_FEEDBACK_EXCERPTS)
                .map(row -> new ReportSourceModels.Feedback(row.getId(), label(row.getCourseOffering()),
                        row.getTeacher().getName(), row.getCreatedAt(), excerpt(row.getComment()))).toList();
    }
    static List<ReportSourceModels.Achievement> achievements(List<Accomplishment> awards) {
        return awards.stream().sorted(Comparator.comparing(Accomplishment::getAchievementDate).reversed()
                .thenComparing(Accomplishment::getId))
                .map(row -> new ReportSourceModels.Achievement(row.getId(), label(row.getCourseOffering()),
                        row.getAchievementDate(), row.getTitle(), row.getCategory().name(), row.getPoints())).toList();
    }
    static ReportSourceModels.ClassSources classSources(List<ClassFeedback> notes) {
        return new ReportSourceModels.ClassSources(classFeedback(notes));
    }
}
