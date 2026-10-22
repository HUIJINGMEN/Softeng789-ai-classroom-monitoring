package io.github.huijingmen.softeng789.classroommonitoring.feedback;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedbackEmailRepository extends JpaRepository<FeedbackEmailDelivery, String> { }
