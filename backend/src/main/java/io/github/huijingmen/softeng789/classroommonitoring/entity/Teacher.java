package io.github.huijingmen.softeng789.classroommonitoring.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
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

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    // Lets two concurrent registration requests racing to claim the same passwordless record be
    // told apart safely — see AuthService's registerStudent/registerTeacher claim logic.
    @Version
    private Long version;

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

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }
}
