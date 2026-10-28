-- Compatibility entry point for psql; Flyway owns the canonical DDL.
\set ON_ERROR_STOP on
BEGIN;
\ir ../../backend/src/main/resources/db/migration/V3__photo_attendance.sql
COMMIT;
