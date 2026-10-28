-- Compatibility entry point for psql; Flyway owns the canonical DDL.
\set ON_ERROR_STOP on
BEGIN;
\ir ../../backend/src/main/resources/db/migration/V4__student_checkins.sql
COMMIT;
