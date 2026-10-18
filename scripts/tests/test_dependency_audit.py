"""The dependency gate must block every advisory, never filter or silently skip its input."""
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("dependency_audit", Path(__file__).resolve().parents[1] / "audit-dependencies.py")
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


class DependencyAuditTest(unittest.TestCase):
    def test_empty_or_malformed_dependency_lists_do_not_pass(self):
        with self.assertRaisesRegex(ValueError, "empty"):
            AUDIT.coordinates("The following files have been resolved:\n")

    def test_runtime_coordinates_and_python_versions_are_scanned(self):
        listing = "    org.springframework:spring-webmvc:jar:7.0.9:compile -- module\n"
        with patch.object(AUDIT.importlib.metadata, "distributions", return_value=[]):
            self.assertEqual(AUDIT.coordinates(listing), [{"package": {"ecosystem": "Maven", "name": "org.springframework:spring-webmvc"}, "version": "7.0.9"}])

    def test_classifier_coordinates_are_included_and_unrecognised_jar_lines_fail(self):
        listing = "    example:native-library:jar:linux-x86_64:1.2.3:runtime\n"
        with patch.object(AUDIT.importlib.metadata, "distributions", return_value=[]):
            self.assertEqual(AUDIT.coordinates(listing)[0]["version"], "1.2.3")
        with self.assertRaisesRegex(ValueError, "Unrecognised"):
            AUDIT.coordinates("example:library:jar:bad:unknown:format:compile\n")

    def test_previously_reviewed_spring_advisories_are_no_longer_exempt(self):
        package = {"package": {"ecosystem": "Maven", "name": "org.springframework:spring-webmvc"}, "version": "6.2.19"}
        results = [{"vulns": [{"id": "GHSA-j9f9-w8pj-32f8"}, {"id": "GHSA-pc63-qcmh-9cmg"}]}]
        findings = AUDIT.dependency_findings([package], results)
        self.assertEqual(len(findings), 2)
        self.assertTrue(all(item["status"] == "vulnerable" for item in findings))

    def test_only_a_complete_clean_response_has_no_findings(self):
        package = {"package": {"ecosystem": "Maven", "name": "org.springframework:spring-webmvc"}, "version": "7.0.9"}
        self.assertEqual(AUDIT.dependency_findings([package], [{}]), [])
        for response in ([], None, [None], [{"vulns": None}]):
            with self.assertRaisesRegex(ValueError, "advisory response"):
                AUDIT.dependency_findings([package], response)

    def test_network_failure_does_not_become_a_successful_audit(self):
        with patch.object(AUDIT.sys, "stdin", io.StringIO("unused")), \
                patch.object(AUDIT, "coordinates", return_value=[]), \
                patch.object(AUDIT.urllib.request, "urlopen", side_effect=OSError("network unavailable")):
            with self.assertRaises(OSError):
                AUDIT.main()

    def test_main_reads_standard_input_and_writes_only_standard_output(self):
        response = io.StringIO('{"results":[{}]}')
        output = io.StringIO()
        with patch.object(AUDIT.sys, "stdin", io.StringIO("org.example:library:jar:1.0:runtime\n")), \
                patch.object(AUDIT.sys, "stdout", output), \
                patch.object(AUDIT.importlib.metadata, "distributions", return_value=[]), \
                patch.object(AUDIT.urllib.request, "urlopen", return_value=response):
            result = AUDIT.main()
        self.assertEqual(result, 0)
        self.assertEqual(AUDIT.json.loads(output.getvalue()), {"scanned": 1, "findings": []})


if __name__ == "__main__":
    unittest.main()
