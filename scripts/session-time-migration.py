#!/usr/bin/env python3
"""Reviewed, all-or-nothing session time repair for the local Docker PostgreSQL.

Export is read-only. Fill every target and reason in the CSV after verifying provenance.
Apply requires the backend to be stopped and creates a private full database backup.
No course/date heuristics decide which records are shifted.
"""
import argparse
import csv
from contextlib import contextmanager, ExitStack
from datetime import date, datetime
import io
import os
from pathlib import Path
import re
import stat
import subprocess
import uuid
from zoneinfo import ZoneInfo

ZONE = ZoneInfo("Pacific/Auckland")
PROJECT_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_PARTS = ("data", "session-time-migration")
DOCKER_PROGRAMS = {
    "sql": 'exec psql -X -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1',
    "backup": 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
    "verify": "exec pg_restore --list",
}
FIELDS = ["id", "session_date", "course", "series_id", "old_start", "old_end", "new_start", "new_end", "reason"]
AUDIT_SCHEMA = """
CREATE TABLE IF NOT EXISTS classroom_session_time_repairs (
    batch_id UUID NOT NULL,
    session_id UUID NOT NULL,
    session_date DATE NOT NULL,
    old_start TIMESTAMPTZ NOT NULL,
    old_end TIMESTAMPTZ NOT NULL,
    new_start TIMESTAMPTZ NOT NULL,
    new_end TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rolled_back_at TIMESTAMPTZ,
    PRIMARY KEY (batch_id, session_id)
);
"""


def safe_name(value):
    """One ordinary filename/container name, never a path or command option."""
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", value) or value in {".", ".."}:
        raise ValueError("Use a single name with letters, digits, dots, underscores or hyphens; no paths or options.")
    return value


def docker_command(container, operation):
    # Environment is resolved inside the container; credentials never enter arguments or output.
    return ["docker", "exec", "-i", safe_name(container), "sh", "-c", DOCKER_PROGRAMS[operation]]


@contextmanager
def workspace_directory(subdirectory=None):
    """Traverse only fixed workspace ancestors, pinned by descriptors and without symlinks."""
    parts = WORKSPACE_PARTS + ((safe_name(subdirectory),) if subdirectory else ())
    with ExitStack() as stack:
        descriptor = os.open(PROJECT_ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        stack.callback(os.close, descriptor)
        for index, part in enumerate(parts):
            try:
                os.mkdir(part, mode=0o700, dir_fd=descriptor)
            except FileExistsError:
                pass
            descriptor = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
            stack.callback(os.close, descriptor)
            if index > 0 and os.fstat(descriptor).st_mode & 0o077:
                raise ValueError("Migration workspace and backup directories must be private (mode 700).")
        yield descriptor


@contextmanager
def workspace_file(name, mode, subdirectory=None):
    name = safe_name(name)
    flags = os.O_RDONLY if mode in {"r", "rb"} else os.O_WRONLY | os.O_CREAT | os.O_EXCL
    with workspace_directory(subdirectory) as directory:
        descriptor = os.open(name, flags | os.O_NOFOLLOW | os.O_NONBLOCK, mode=0o600, dir_fd=directory)
        with os.fdopen(descriptor, mode, **({"encoding": "utf-8", "newline": ""} if "b" not in mode else {})) as handle:
            metadata = os.fstat(handle.fileno())
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
                raise ValueError("Migration files must be regular files without hard links.")
            yield handle


def psql(container, sql):
    result = subprocess.run(docker_command(container, "sql"),
        input=sql, text=True, capture_output=True, check=True)
    return result.stdout


def private_file(path, contents):
    with workspace_file(path, "x") as handle:
        handle.write(contents)


def export_plan(container, output):
    output = safe_name(output)
    sql = """BEGIN READ ONLY;
COPY (SELECT id, session_date, course_name AS course, schedule_series_id AS series_id,
 start_time AS old_start, end_time AS old_end, '' AS new_start, '' AS new_end, '' AS reason
 FROM classroom_sessions ORDER BY session_date, start_time, id) TO STDOUT WITH CSV HEADER;
COMMIT;"""
    private_file(output, psql(container, sql))


def instant(value):
    normalized = re.sub(r"([+-]\d{2})$", r"\1:00", value.replace("Z", "+00:00"))
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("All timestamps require an explicit offset.")
    return parsed


def validate_plan_row(row):
    if set(row) != set(FIELDS) or any(not isinstance(value, str) for value in row.values()):
        raise ValueError("Malformed CSV row.")
    key = str(uuid.UUID(row["id"]))
    day = date.fromisoformat(row["session_date"])
    if row["series_id"]:
        uuid.UUID(row["series_id"])
    if not row["reason"].strip() or len(row["reason"]) > 500:
        raise ValueError("Every row needs a reviewed reason of at most 500 characters.")
    for prefix in ("old", "new"):
        validate_plan_range(row, prefix, day)
    # COPY data must not be able to inject a psql end-of-input command.
    if any("\n" in value or "\r" in value or "\x00" in value for value in row.values()):
        raise ValueError("Multiline plan values are not accepted.")
    return key


def validate_plan_range(row, prefix, day):
    start, end = instant(row[prefix + "_start"]), instant(row[prefix + "_end"])
    if end <= start:
        raise ValueError("Session end must be after start.")
    if prefix == "new" and any(value.astimezone(ZONE).date() != day for value in (start, end)):
        raise ValueError("Target timestamps must match the session's Auckland date.")


def read_plan(path):
    with workspace_file(path, "r") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != FIELDS:
            raise ValueError("Unexpected CSV columns; start with export.")
        rows = list(reader)
    seen = set()
    for row in rows:
        key = validate_plan_row(row)
        if key in seen:
            raise ValueError("Duplicate session ID.")
        seen.add(key)
    if not rows:
        raise ValueError("Empty plan.")
    return rows


def apply_sql(rows, batch):
    batch = str(uuid.UUID(str(batch)))
    # Only parsed UUID/date/timestamps and CSV-escaped reasons reach SQL; no string interpolation of SQL values.
    data = io.StringIO()
    writer = csv.writer(data, lineterminator="\n")
    for row in rows:
        writer.writerow([row[key] for key in FIELDS])
    return """BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE classroom_sessions IN EXCLUSIVE MODE;
""" + AUDIT_SCHEMA + """
CREATE TEMP TABLE time_plan (id UUID PRIMARY KEY, session_date DATE, course TEXT, series_id UUID, old_start TIMESTAMPTZ,
 old_end TIMESTAMPTZ, new_start TIMESTAMPTZ, new_end TIMESTAMPTZ, reason TEXT) ON COMMIT DROP;
COPY time_plan FROM STDIN WITH CSV;
""" + data.getvalue() + "\\.\n" + f"""
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM classroom_session_time_repairs WHERE batch_id = '{batch}') THEN
  RAISE EXCEPTION 'This batch has already been applied; do not shift it again';
 END IF;
 IF (SELECT count(*) FROM time_plan) <> (SELECT count(*) FROM classroom_sessions)
 OR EXISTS (SELECT 1 FROM time_plan p LEFT JOIN classroom_sessions s ON s.id=p.id
  WHERE s.id IS NULL OR s.session_date IS DISTINCT FROM p.session_date
  OR s.course_name IS DISTINCT FROM p.course OR s.schedule_series_id IS DISTINCT FROM p.series_id
  OR s.start_time IS DISTINCT FROM p.old_start OR s.end_time IS DISTINCT FROM p.old_end) THEN
  RAISE EXCEPTION 'Database changed or plan is incomplete; export and review again';
 END IF;
 IF EXISTS (SELECT 1 FROM time_plan WHERE new_end <= new_start
  OR (new_start AT TIME ZONE 'Pacific/Auckland')::date <> session_date
  OR (new_end AT TIME ZONE 'Pacific/Auckland')::date <> session_date) THEN
  RAISE EXCEPTION 'Invalid Auckland target date or range';
 END IF;
END $$;
INSERT INTO classroom_session_time_repairs
 (batch_id, session_id, session_date, old_start, old_end, new_start, new_end, reason)
 SELECT '{batch}', id, session_date, old_start, old_end, new_start, new_end, reason FROM time_plan;
CREATE TEMP TABLE unchanged_session_fields ON COMMIT DROP AS
 SELECT id, to_jsonb(s) - 'start_time' - 'end_time' AS fields FROM classroom_sessions s;
UPDATE classroom_sessions s SET start_time=p.new_start, end_time=p.new_end
 FROM time_plan p WHERE s.id=p.id AND (s.start_time <> p.new_start OR s.end_time <> p.new_end);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM classroom_sessions s JOIN unchanged_session_fields b USING(id)
  WHERE to_jsonb(s) - 'start_time' - 'end_time' IS DISTINCT FROM b.fields) THEN
  RAISE EXCEPTION 'Non-time session fields changed; refusing migration';
 END IF;
END $$;
COMMIT;
"""


def rollback_sql(batch):
    batch = str(uuid.UUID(str(batch)))
    return f"""BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE classroom_sessions IN EXCLUSIVE MODE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM classroom_session_time_repairs
  WHERE batch_id='{batch}' AND rolled_back_at IS NULL) THEN
  RAISE EXCEPTION 'No active repair batch';
 END IF;
 IF EXISTS (SELECT 1 FROM classroom_session_time_repairs a
  LEFT JOIN classroom_sessions s ON s.id=a.session_id WHERE a.batch_id='{batch}'
  AND (s.id IS NULL OR s.session_date IS DISTINCT FROM a.session_date
   OR s.start_time IS DISTINCT FROM a.new_start OR s.end_time IS DISTINCT FROM a.new_end)) THEN
  RAISE EXCEPTION 'Sessions changed after migration; refusing to overwrite subsequent edits';
 END IF;
END $$;
UPDATE classroom_sessions s SET start_time=a.old_start, end_time=a.old_end
 FROM classroom_session_time_repairs a WHERE a.batch_id='{batch}' AND s.id=a.session_id
 AND (s.start_time <> a.old_start OR s.end_time <> a.old_end);
UPDATE classroom_session_time_repairs SET rolled_back_at=CURRENT_TIMESTAMP WHERE batch_id='{batch}';
COMMIT;
"""


def backup(container, directory, batch):
    batch = str(uuid.UUID(str(batch)))
    filename = f"{batch}.dump"
    with workspace_file(filename, "xb", directory) as handle:
        subprocess.run(docker_command(container, "backup"), stdout=handle, check=True)
        if os.fstat(handle.fileno()).st_size == 0:
            raise ValueError("Empty database backup; refusing migration.")
    # Verify that the archive can be read before any database mutation.
    with workspace_file(filename, "rb", directory) as handle:
        subprocess.run(docker_command(container, "verify"), stdin=handle,
            stdout=subprocess.DEVNULL, check=True)
    return PROJECT_ROOT.joinpath(*WORKSPACE_PARTS, safe_name(directory), filename)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", default="classroom-monitoring-postgres", type=safe_name)
    commands = parser.add_subparsers(dest="command", required=True)
    export = commands.add_parser("export")
    export.add_argument("--output", required=True, type=safe_name, help="CSV name inside data/session-time-migration/")
    for name in ("apply", "rollback"):
        action = commands.add_parser(name)
        action.add_argument("--batch", required=True, type=uuid.UUID)
        action.add_argument("--backup-dir", required=True, type=safe_name, help="Private subdirectory name inside data/session-time-migration/")
        action.add_argument("--backend-stopped", required=True, action="store_true")
        if name == "apply":
            action.add_argument("--plan", required=True, type=safe_name, help="Reviewed CSV name inside data/session-time-migration/")
    args = parser.parse_args()
    if args.command == "export":
        export_plan(args.container, args.output)
        print("Read-only plan exported; all targets require explicit review.")
        return
    batch = str(args.batch)
    rows = read_plan(args.plan) if args.command == "apply" else None
    sql = apply_sql(rows, batch) if rows is not None else rollback_sql(batch)
    saved = backup(args.container, args.backup_dir, batch)
    psql(args.container, sql)
    print(f"{args.command} committed; batch={batch}; backup={saved}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Migration stopped without continuing: {error}") from error
