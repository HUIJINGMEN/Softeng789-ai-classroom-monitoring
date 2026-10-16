package io.github.huijingmen.softeng789.classroommonitoring.assistant;

import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.repository.StudentRepository;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
import static io.github.huijingmen.softeng789.classroommonitoring.assistant.AssistantModels.*;

@Component
class AssistantStudentLookup {
    private static final int CHOICE_LIMIT = 10;
    private final StudentRepository students;
    private final EntityManager entityManager;
    AssistantStudentLookup(StudentRepository students, EntityManager entityManager) {
        this.students = students;
        this.entityManager = entityManager;
    }
    record Resolution(Student student, List<Choice> choices, boolean clarify, boolean truncated) { }

    Resolution resolve(Question question, Plan plan) {
        if (!plan.studentQuery().isBlank()) return fromQuery(question, plan.studentQuery());
        var context = question.context();
        if (plan.usePreviousStudent() && context != null && context.studentId() != null) {
            var student = students.findById(context.studentId()).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "The previous student is no longer available."));
            return new Resolution(student, List.of(), false, false);
        }
        return new Resolution(null, List.of(), false, false);
    }

    private Resolution fromQuery(Question question, String query) {
        var matches = find(query);
        if (question.selectedStudentId() != null) {
            var selected = matches.stream().filter(row -> row.getId().equals(question.selectedStudentId())).findFirst()
                    .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "The selected student does not match this question."));
            return new Resolution(selected, List.of(), false, false);
        }
        if (matches.size() == 1) return new Resolution(matches.getFirst(), List.of(), false, false);
        return new Resolution(null, matches.stream().limit(CHOICE_LIMIT).map(row -> new Choice(row.getId(), row.getFullName(), row.getStudentNumber())).toList(), true, matches.size() > CHOICE_LIMIT);
    }
    List<Student> find(String query) {
        var exact = students.findByStudentNumberIgnoreCase(query.trim());
        if (exact.isPresent()) return List.of(exact.get());
        var fullName = entityManager.createQuery("select s from Student s where lower(concat(s.firstName, ' ', s.lastName)) = :name order by s.studentNumber", Student.class)
                .setParameter("name", query.trim().toLowerCase(java.util.Locale.ROOT)).setMaxResults(CHOICE_LIMIT + 1).getResultList();
        if (!fullName.isEmpty()) return fullName;
        return entityManager.createQuery("select s from Student s where lower(concat(s.firstName, ' ', s.lastName, ' ', s.studentNumber)) like :query escape '!' order by s.lastName, s.firstName, s.studentNumber", Student.class)
                .setParameter("query", "%" + literal(query) + "%").setMaxResults(CHOICE_LIMIT + 1).getResultList();
    }
    static String literal(String query) {
        return query.trim().toLowerCase(java.util.Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }
}
