import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("schema_check", ROOT / "scripts/test-postgres-schema.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Phase2MigrationSourcesTest(unittest.TestCase):
    def test_compatibility_entries_execute_canonical_ddl_in_a_transaction(self):
        for old, version in (("20261024_add_photo_attendance.sql", "V3__photo_attendance.sql"),
                             ("20261025_add_student_checkins.sql", "V4__student_checkins.sql"),
                             ("20261026_add_registration_faces.sql", "V5__registration_faces.sql")):
            with self.subTest(migration=old):
                entry = ROOT / "database/migrations" / old
                ddl = (ROOT / "backend/src/main/resources/db/migration" / version).read_text()
                expanded = module.migration_sql(entry)
                self.assertIn(ddl, expanded)
                self.assertIn("BEGIN;", expanded)
                self.assertTrue(expanded.endswith("COMMIT;"))
                self.assertNotIn("CREATE TABLE", entry.read_text())

    def test_historical_schema_does_not_own_phase2_tables(self):
        schema = (ROOT / "database/schema.sql").read_text(encoding="utf-8")
        self.assertNotIn("CREATE TABLE IF NOT EXISTS cv_", schema)
        self.assertIn("historical reference only", schema)
