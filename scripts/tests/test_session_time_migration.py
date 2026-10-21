import csv
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
import uuid
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("migration", Path(__file__).parents[1] / "session-time-migration.py")
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class SessionTimeMigrationTest(unittest.TestCase):
    def plan(self, **changes):
        return {"id": str(uuid.uuid4()), "session_date": "2026-10-14", "course": "TEST 101", "series_id": "",
                "old_start": "2026-10-14T10:00:00Z", "old_end": "2026-10-14T11:00:00Z",
                "new_start": "2026-10-13T21:00:00Z", "new_end": "2026-10-13T22:00:00Z",
                "reason": "Explicitly reviewed school-local 10–11", **changes}

    def read(self, rows):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(migration, "PROJECT_ROOT", Path(directory)):
                with migration.workspace_file("plan.csv", "x") as handle:
                    writer = csv.DictWriter(handle, migration.FIELDS)
                    writer.writeheader()
                    writer.writerows(rows)
                return migration.read_plan("plan.csv")

    def file_contents(self, name):
        with migration.workspace_file(name, "r") as handle:
            return handle.read()

    def directory_descriptor(self, name=None):
        with migration.workspace_directory(name) as descriptor:
            return descriptor

    def test_explicit_targets_are_required_and_precision_is_retained(self):
        self.assertEqual(migration.instant("2026-10-14 10:00:00+00"), migration.instant("2026-10-14T10:00:00Z"))
        row = self.plan(new_start="2026-10-13T21:00:00.892Z")
        self.assertEqual(self.read([row])[0]["new_start"], row["new_start"])
        for changes in ({"new_start": ""}, {"reason": ""}, {"new_start": "2026-10-13T21:00:00"},
                        {"new_start": "2026-10-12T21:00:00Z"}, {"new_end": "2026-10-13T20:00:00Z"},
                        {"reason": "hello\n\\.\nSQL"}):
            row = self.plan(**changes)
            with self.assertRaises(ValueError):
                self.read([row])

    def test_duplicate_and_empty_plans_are_rejected(self):
        row = self.plan()
        for rows in ([], [row, row]):
            with self.assertRaises(ValueError):
                self.read(rows)

    def test_apply_guards_full_coverage_concurrency_and_reapplication(self):
        sql = migration.apply_sql(self.read([self.plan(reason="Teacher's reviewed time, unchanged IDs")]), str(uuid.uuid4()))
        self.assertIn("LOCK TABLE classroom_sessions", sql)
        self.assertIn("Database changed or plan is incomplete", sql)
        self.assertIn("already been applied", sql)
        self.assertIn("IS DISTINCT FROM p.old_start", sql)
        self.assertIn("UPDATE classroom_sessions s SET start_time=p.new_start, end_time=p.new_end", sql)
        self.assertNotIn("UPDATE attendance", sql)

    def test_rollback_refuses_to_overwrite_subsequent_edits(self):
        sql = migration.rollback_sql(str(uuid.uuid4()))
        self.assertIn("IS DISTINCT FROM a.new_start", sql)
        self.assertIn("refusing to overwrite subsequent edits", sql)
        self.assertIn("rolled_back_at=CURRENT_TIMESTAMP", sql)

    def test_container_options_and_shell_fragments_never_reach_subprocess(self):
        for container in ("--privileged", "-u", "db;touch marker", "db name", "db\nname", "../db"):
            with self.subTest(container=container), patch.object(migration.subprocess, "run") as run:
                with self.assertRaises(ValueError):
                    migration.psql(container, "SELECT 1")
                run.assert_not_called()
        command = migration.docker_command("classroom-monitoring-postgres", "sql")
        self.assertEqual(command[:5], ["docker", "exec", "-i", "classroom-monitoring-postgres", "sh"])
        with self.assertRaises(KeyError):
            migration.docker_command("safe-db", "unreviewed program")

    def test_paths_cannot_escape_the_fixed_workspace(self):
        for name in ("../outside", "/tmp/plan.csv", "nested/plan.csv", r"nested\plan.csv", ".", "..", "-option", ""):
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    migration.safe_name(name)

    def test_private_files_are_exclusive_and_symlinks_and_hardlinks_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(migration, "PROJECT_ROOT", Path(directory)):
            migration.private_file("plan.csv", "reviewed")
            workspace = Path(directory).joinpath(*migration.WORKSPACE_PARTS)
            self.assertEqual((workspace / "plan.csv").stat().st_mode & 0o777, 0o600)
            self.assertEqual(workspace.stat().st_mode & 0o777, 0o700)
            with self.assertRaises(FileExistsError):
                migration.private_file("plan.csv", "overwrite")
            (workspace / "link.csv").symlink_to(workspace / "plan.csv")
            with self.assertRaises(OSError):
                self.file_contents("link.csv")
            os.link(workspace / "plan.csv", workspace / "hardlink.csv")
            with self.assertRaises(ValueError):
                self.file_contents("hardlink.csv")

    def test_symlink_workspace_and_nonprivate_backup_directory_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(migration, "PROJECT_ROOT", Path(directory)):
            root = Path(directory)
            (root / "outside").mkdir()
            (root / "data").symlink_to(root / "outside", target_is_directory=True)
            with self.assertRaises(OSError):
                self.directory_descriptor()
        with tempfile.TemporaryDirectory() as directory, patch.object(migration, "PROJECT_ROOT", Path(directory)):
            migration.private_file("plan.csv", "reviewed")
            backup = Path(directory).joinpath(*migration.WORKSPACE_PARTS, "backups")
            backup.mkdir(mode=0o755)
            backup.chmod(0o755)
            with self.assertRaises(ValueError):
                self.directory_descriptor("backups")

    def test_backups_are_exclusive_private_and_verified_before_returning(self):
        def dump_then_verify(command, **options):
            if command[-1] == migration.DOCKER_PROGRAMS["backup"]:
                options["stdout"].write(b"test archive")
                options["stdout"].flush()
            else:
                self.assertEqual(command[-1], migration.DOCKER_PROGRAMS["verify"])
                self.assertEqual(options["stdin"].read(), b"test archive")
        with tempfile.TemporaryDirectory() as directory, patch.object(migration, "PROJECT_ROOT", Path(directory)), \
                patch.object(migration.subprocess, "run", side_effect=dump_then_verify) as run:
            batch = str(uuid.uuid4())
            target = migration.backup("safe-db", "backups", batch)
            self.assertEqual(target, Path(directory).joinpath(*migration.WORKSPACE_PARTS, "backups", batch + ".dump"))
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            self.assertEqual(run.call_count, 2)
            with self.assertRaises(FileExistsError):
                migration.backup("safe-db", "backups", batch)
            self.assertEqual(run.call_count, 2)

    def test_empty_backup_aborts_before_archive_verification(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(migration, "PROJECT_ROOT", Path(directory)), \
                patch.object(migration.subprocess, "run") as run:
            batch = str(uuid.uuid4())
            with self.assertRaisesRegex(ValueError, "Empty database backup"):
                migration.backup("safe-db", "backups", batch)
            self.assertEqual(run.call_count, 1)

    def test_sql_batch_ids_are_validated_at_the_sql_boundary(self):
        for create in (migration.rollback_sql, lambda batch: migration.apply_sql([], batch)):
            with self.assertRaises(ValueError):
                create("bad'; SELECT 1; --")


if __name__ == "__main__":
    unittest.main()
