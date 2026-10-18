import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest
import uuid

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
            file = Path(directory) / "plan.csv"
            with file.open("w", newline="") as handle:
                writer = csv.DictWriter(handle, migration.FIELDS)
                writer.writeheader()
                writer.writerows(rows)
            return migration.read_plan(file)

    def test_explicit_targets_are_required_and_precision_is_retained(self):
        self.assertEqual(migration.instant("2026-10-14 10:00:00+00"), migration.instant("2026-10-14T10:00:00Z"))
        row = self.plan(new_start="2026-10-13T21:00:00.892Z")
        self.assertEqual(self.read([row])[0]["new_start"], row["new_start"])
        for changes in ({"new_start": ""}, {"reason": ""}, {"new_start": "2026-10-13T21:00:00"},
                        {"new_start": "2026-10-12T21:00:00Z"}, {"new_end": "2026-10-13T20:00:00Z"},
                        {"reason": "hello\n\\.\nSQL"}):
            with self.assertRaises(ValueError):
                self.read([self.plan(**changes)])

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


if __name__ == "__main__":
    unittest.main()
