package io.github.huijingmen.softeng789.classroommonitoring.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "teachers")
public class Teacher {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 80)
    private String staffNumber;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(nullable = false, length = 160)
    private String name;

    public UUID getId() {
        return id;
    }

    public String getStaffNumber() {
        return staffNumber;
    }

    public void setStaffNumber(String staffNumber) {
        this.staffNumber = staffNumber;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
