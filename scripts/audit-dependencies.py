#!/usr/bin/env python3
"""Fail closed on every OSV match. Sends public coordinates only, never application data."""
import importlib.metadata
import json
import re
import sys
import urllib.request

def coordinates(maven_list):
    packages = []
    for line in maven_list.splitlines():
        fields = re.sub(r"\x1b\[[0-9;]*m", "", line).strip().split(" -- ")[0].split(":")
        if len(fields) in {5, 6} and fields[2] in {"jar", "bundle", "test-jar"}:
            packages.append({"package": {"ecosystem": "Maven", "name": fields[0] + ":" + fields[1]}, "version": fields[-2]})
        elif ":jar:" in line:
            raise ValueError("Unrecognised Maven dependency coordinate: " + line.strip())
    if not packages:
        raise ValueError("Maven dependency list is empty; audit cannot be treated as passed.")
    for distribution in importlib.metadata.distributions():
        packages.append({"package": {"ecosystem": "PyPI", "name": distribution.metadata["Name"]}, "version": distribution.version})
    return packages


def dependency_findings(packages, results):
    if not isinstance(results, list) or len(results) != len(packages):
        raise ValueError("Incomplete advisory response; audit cannot be treated as passed.")
    findings = []
    for package, result in zip(packages, results):
        if not isinstance(result, dict) or not isinstance(result.get("vulns", []), list):
            raise ValueError("Malformed advisory response; audit cannot be treated as passed.")
        for item in result.get("vulns", []):
            findings.append({**package, "id": item["id"], "status": "vulnerable",
                "reason": "Upgrade this dependency before merging."})
    return findings


def main():
    # The caller owns files/redirection; the auditor never opens a CLI-supplied path.
    packages = coordinates(sys.stdin.read())
    request = urllib.request.Request("https://api.osv.dev/v1/querybatch",
        data=json.dumps({"queries": packages}).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=45) as response:
        results = json.load(response)["results"]
    findings = dependency_findings(packages, results)
    report = {"scanned": len(packages), "findings": findings}
    print(json.dumps(report, indent=2))
    return int(bool(findings))


if __name__ == "__main__":
    raise SystemExit(main())
