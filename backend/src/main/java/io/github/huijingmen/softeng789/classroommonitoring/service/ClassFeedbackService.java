package io.github.huijingmen.softeng789.classroommonitoring.service;

import io.github.huijingmen.softeng789.classroommonitoring.dto.ClassFeedbackResponse;
import io.github.huijingmen.softeng789.classroommonitoring.dto.CreateClassFeedbackRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassFeedback;
import io.github.huijingmen.softeng789.classroommonitoring.entity.CourseOffering;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.repository.ClassFeedbackRepository;
import io.github.huijingmen.softeng789.classroommonitoring.repository.CourseOfferingRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class ClassFeedbackService {
    private final ClassFeedbackRepository classFeedbackRepository;
    private final CourseOfferingRepository courseOfferingRepository;
    private final TeacherScopeSupport access;

    public ClassFeedbackService(
            ClassFeedbackRepository classFeedbackRepository,
            CourseOfferingRepository courseOfferingRepository,
            TeacherScopeSupport access
    ) {
        this.classFeedbackRepository = classFeedbackRepository;
        this.courseOfferingRepository = courseOfferingRepository;
        this.access = access;
    }

    @Transactional
    public ClassFeedbackResponse create(CreateClassFeedbackRequest request, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        CourseOffering offering = requireOffering(request.courseOfferingId());
        access.assertCanAccessOffering(offering, caller);

        ClassFeedback feedback = new ClassFeedback();
        feedback.setCourseOffering(offering);
        feedback.setTeacher(caller);
        feedback.setComment(request.comment().trim());
        return toResponse(classFeedbackRepository.save(feedback));
    }

    @Transactional(readOnly = true)
    public List<ClassFeedbackResponse> listForClass(UUID courseOfferingId, UUID callerId) {
        Teacher caller = access.requireCaller(callerId);
        CourseOffering offering = requireOffering(courseOfferingId);
        access.assertCanAccessOffering(offering, caller);
        return classFeedbackRepository.findByCourseOffering_IdOrderByCreatedAtDesc(courseOfferingId).stream()
                .map(this::toResponse)
                .toList();
    }

    private CourseOffering requireOffering(UUID id) {
        return courseOfferingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Class not found."));
    }

    private ClassFeedbackResponse toResponse(ClassFeedback feedback) {
        CourseOffering offering = feedback.getCourseOffering();
        return new ClassFeedbackResponse(
                feedback.getId(),
                offering.getId(),
                offering.getCourse().getCode() + " · " + offering.getAcademicTerm(),
                feedback.getTeacher().getId(),
                feedback.getTeacher().getName(),
                feedback.getComment(),
                feedback.getCreatedAt());
    }
}
