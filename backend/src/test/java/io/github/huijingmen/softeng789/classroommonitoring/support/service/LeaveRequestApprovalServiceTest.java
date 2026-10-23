package io.github.huijingmen.softeng789.classroommonitoring.support.service;

import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonDecision;
import io.github.huijingmen.softeng789.classroommonitoring.billing.dto.LessonReconciliationDtos.LessonDecisionRequest;
import io.github.huijingmen.softeng789.classroommonitoring.billing.service.LessonCreditManagementService;
import io.github.huijingmen.softeng789.classroommonitoring.dto.UpdateAttendanceRequest;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AbsenceReason;
import io.github.huijingmen.softeng789.classroommonitoring.entity.AttendanceRecord;
import io.github.huijingmen.softeng789.classroommonitoring.entity.ClassroomSession;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Student;
import io.github.huijingmen.softeng789.classroommonitoring.entity.Teacher;
import io.github.huijingmen.softeng789.classroommonitoring.service.AttendanceService;
import io.github.huijingmen.softeng789.classroommonitoring.repository.AttendanceRecordRepository;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.LeaveLessonTreatment;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.LeaveReason;
import io.github.huijingmen.softeng789.classroommonitoring.support.domain.StudentSupportRequest;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeaveRequestApprovalServiceTest {
    @Mock private AttendanceService attendanceService;
    @Mock private AttendanceRecordRepository attendanceRepository;
    @Mock private LessonCreditManagementService creditManagementService;
    @Mock private StudentSupportRequest request;
    @Mock private Student student;
    @Mock private ClassroomSession session;
    @Mock private Teacher admin;

    private LeaveRequestApprovalService service;
    private UUID studentId;
    private UUID sessionId;
    private UUID adminId;

    @BeforeEach
    void setUp() {
        service = new LeaveRequestApprovalService(attendanceService, attendanceRepository, creditManagementService);
        studentId = UUID.randomUUID();
        sessionId = UUID.randomUUID();
        adminId = UUID.randomUUID();
        org.mockito.Mockito.lenient().when(request.getId()).thenReturn(UUID.randomUUID());
        when(request.getStudent()).thenReturn(student);
        when(request.getSession()).thenReturn(session);
        org.mockito.Mockito.lenient().when(request.getLeaveReason()).thenReturn(LeaveReason.ILLNESS);
        when(student.getId()).thenReturn(studentId);
        when(session.getId()).thenReturn(sessionId);
    }

    @Test
    void prepaidLeaveRequiresAndAppliesAnExplicitMakeupDecision() {
        UUID creditId = UUID.randomUUID();
        when(admin.getId()).thenReturn(adminId);
        when(creditManagementService.decisionCreditIdForLesson(studentId, sessionId))
                .thenReturn(Optional.of(creditId));

        service.approve(request, admin, LeaveLessonTreatment.ALLOW_MAKEUP, "Medical leave approved.");

        ArgumentCaptor<UpdateAttendanceRequest> attendance = ArgumentCaptor.forClass(UpdateAttendanceRequest.class);
        verify(attendanceService).updateAttendance(
                org.mockito.ArgumentMatchers.eq(sessionId),
                org.mockito.ArgumentMatchers.eq(studentId),
                attendance.capture(),
                org.mockito.ArgumentMatchers.eq(adminId)
        );
        assertThat(attendance.getValue().absenceReason()).isEqualTo(AbsenceReason.ILLNESS);
        assertThat(attendance.getValue().absenceNote()).contains("Medical leave approved.");

        ArgumentCaptor<LessonDecisionRequest> decision = ArgumentCaptor.forClass(LessonDecisionRequest.class);
        verify(creditManagementService).decide(
                org.mockito.ArgumentMatchers.eq(adminId),
                org.mockito.ArgumentMatchers.eq(creditId),
                decision.capture()
        );
        assertThat(decision.getValue().decision()).isEqualTo(LessonDecision.GRANT_MAKEUP);
        verify(request).setLeaveLessonTreatment(LeaveLessonTreatment.ALLOW_MAKEUP);
    }

    @Test
    void prepaidLeaveDoesNotChangeAttendanceWithoutATreatmentDecision() {
        when(creditManagementService.decisionCreditIdForLesson(studentId, sessionId))
                .thenReturn(Optional.of(UUID.randomUUID()));

        assertThatThrownBy(() -> service.approve(request, admin, null, "Approved."))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("prepaid lesson");

        verify(attendanceService, never()).updateAttendance(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void approvalCannotOverwriteAnExistingPresentMark() {
        AttendanceRecord attendance = org.mockito.Mockito.mock(AttendanceRecord.class);
        when(attendance.getStatus()).thenReturn(AttendanceRecord.AttendanceStatus.PRESENT);
        when(attendanceRepository.findBySession_IdAndStudent_Id(sessionId, studentId))
                .thenReturn(Optional.of(attendance));

        assertThatThrownBy(() -> service.approve(request, admin, null, "Approved."))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already marked present");

        verify(attendanceService, never()).updateAttendance(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()
        );
    }
}
