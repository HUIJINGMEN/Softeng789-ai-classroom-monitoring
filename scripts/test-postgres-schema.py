#!/usr/bin/env python3
"""Disposable PostgreSQL: fresh schema and a real pre-billing schema upgraded through the migrations.

Owns a new container with a random ID and loopback-only random port. Never targets the project's DB.
"""
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
BASELINE = "a97150b"


def run(*args, data=None):
    result = subprocess.run(args, input=data, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-8000:] or result.stdout[-8000:])
    return result.stdout.strip()


def main():
    baseline = run("git", "-C", str(ROOT), "show", BASELINE + ":database/schema.sql")
    name = "classlens-schema-check-" + uuid.uuid4().hex[:12]
    container = run("docker", "run", "--detach", "--rm", "--name", name,
        "-e", "POSTGRES_PASSWORD=schema-test-only", "-p", "127.0.0.1::5432", "postgres:16")
    if not container or any(char not in "0123456789abcdef" for char in container):
        raise RuntimeError("Unexpected disposable container ID.")
    try:
        for attempt in range(60):
            # The image's temporary initialization server accepts Unix sockets only.
            # Wait for the final TCP server so readiness cannot race that restart.
            check = subprocess.run(["docker", "exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], capture_output=True)
            if check.returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Disposable PostgreSQL did not become ready.")
        port = run("docker", "port", container, "5432/tcp").rsplit(":", 1)[1]

        def sql(database, contents):
            return run("docker", "exec", "-i", container, "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1",
                "-h", "127.0.0.1", "-U", "postgres", "-d", database, data=contents)

        for database in ("classlens_schema_fresh", "classlens_schema_upgrade"):
            sql("postgres", "CREATE DATABASE " + database)
        sql("classlens_schema_fresh", (ROOT / "database/schema.sql").read_text())
        sql("classlens_schema_upgrade", baseline)
        migrations = sorted((ROOT / "database/migrations").glob("*.sql"))
        for migration in migrations:
            if migration.name >= "20260926":
                sql("classlens_schema_upgrade", migration.read_text())
        for database in ("classlens_schema_fresh", "classlens_schema_upgrade"):
            print("Validating PostgreSQL ORM contract:", database, flush=True)
            run("mvn", "-q", "-f", str(ROOT / "backend/pom.xml"), "-Dtest=PostgresSchemaContractTest",
                "-DschemaCheck.url=jdbc:postgresql://127.0.0.1:" + port + "/" + database, "test")
        print("PASS: fresh schema and historical upgrade validated on disposable PostgreSQL.")
    finally:
        # --rm deletes only this newly-created test container and its anonymous data, never named project volumes.
        subprocess.run(["docker", "stop", "--time", "1", container], check=False, capture_output=True)


if __name__ == "__main__":
    main()
