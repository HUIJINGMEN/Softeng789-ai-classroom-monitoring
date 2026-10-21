#!/usr/bin/env sh
set -eu
PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
case "${1:-}" in migrate|adopt-v1|align-local-v1) ;; *) echo 'Usage: sh scripts/migrate-database.sh migrate|adopt-v1|align-local-v1' >&2; exit 2;; esac
# Credentials are read from environment by Java; never placed in process arguments or echoed.
mvn -q -f "$PROJECT_ROOT/backend/pom.xml" -DskipTests compile dependency:build-classpath \
  -DincludeScope=runtime -Dmdep.outputFile=target/migration-classpath.txt
exec java -cp "$PROJECT_ROOT/backend/target/classes:$(cat "$PROJECT_ROOT/backend/target/migration-classpath.txt")" \
  io.github.huijingmen.softeng789.classroommonitoring.config.SchemaMigrationTool "$1"
