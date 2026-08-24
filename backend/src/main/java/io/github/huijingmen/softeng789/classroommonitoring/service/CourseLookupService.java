package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Course;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseRepository;
import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * Shared by AuthService, StudentService and ClassroomSessionService, which all need to resolve a
 * course code to a Course row and transparently create one the first time it's seen.
 */
@Service
public class CourseLookupService {
    private final CourseRepository courseRepository;

    public CourseLookupService(CourseRepository courseRepository) {
        this.courseRepository = courseRepository;
    }

    public Course findOrCreateCourse(String courseCode) {
        return courseRepository.findByCodeIgnoreCase(courseCode)
                .orElseGet(() -> {
                    Course course = new Course();
                    course.setCode(courseCode);
                    course.setName(courseCode);
                    return courseRepository.save(course);
                });
    }

    public String normaliseCourseCode(String course) {
        return course.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }
}
