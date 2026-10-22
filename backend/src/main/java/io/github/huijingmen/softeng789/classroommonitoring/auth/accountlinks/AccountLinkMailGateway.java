package io.github.huijingmen.softeng789.classroommonitoring.auth.accountlinks;

/** A delivery boundary, not a public/local-debug inbox. Tests substitute a private capturing bean. */
public interface AccountLinkMailGateway {
    boolean available();
    void send(String email, AccountLinkPurpose purpose, String link);
}
