# Classroom Monitoring Backend

Spring Boot backend skeleton for Week 2.

## Run

If `mvn` is not found, run:

```bash
source ~/.zshrc
```

```bash
mvn spring-boot:run
```

Health endpoint:

```bash
curl http://localhost:8080/api/health
```

## PostgreSQL Profile

The default Week 2 profile starts without connecting to a database, so the health API can be
tested even before Docker/PostgreSQL is installed.

When PostgreSQL is available, run with:

```bash
SPRING_PROFILES_ACTIVE=postgres mvn spring-boot:run
```
