package io.github.huijingmen.softeng789.classroommonitoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ClassroomMonitoringApplication {
    public static void main(String[] args) {
        SpringApplication.run(ClassroomMonitoringApplication.class, args);
    }
}
