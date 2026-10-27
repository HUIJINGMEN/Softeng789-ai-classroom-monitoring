# Main static-analysis cleanup

Scope: main at base 3dc80b5, checked 28 October 2026. PR #33 was neither merged nor modified.

[Issue ledger](main-findings.csv) preserves all 303 Open records from the supplied export in original order. These are local inventory IDs, not remote Sonar issue keys. Original lines refer to the export; the final record is truncated and has no supplied line number. The export is not evidence that all 303 are current defects.

## Local disposition

| Disposition | Records |
| --- | ---: |
| GUARDED_REVIEW | 2 |
| LOCALLY_VERIFIED | 231 |
| ALREADY_ADDRESSED | 2 |
| REVIEW_EXCEPTION | 63 |
| REPLACED | 5 |

- LOCALLY_VERIFIED includes fixes already present before this cleanup, not just newly changed lines.
- ALREADY_ADDRESSED retains existing dependency-install hardening.
- REPLACED means the original file is gone; its feature already moved to dedicated modules.
- REVIEW_EXCEPTION and GUARDED_REVIEW require individual contextual review on Sonar.

**No remote issue has been marked accepted/false-positive, and no remote clean scan is claimed.** No NOSONAR, blanket exclusion or reduced quality threshold was added. Push a cleanup branch and rerun the current server profile before claiming closure.

## Code ownership

- Achievement entry: a typed controller owns state, validation and commands; details/recipients/footer views render it. The former component is a compatibility export. Tests cover course/recipient changes, blank versus zero points, draft/share and failed-save preservation.
- Console shell: pure role-scoped badge and shell-class models, consumed via a public index. No fetches/mutations in navigation construction. Teacher/admin distinctions are regression-tested.
- Shared dialog lifecycle: initial focus, Escape, Tab wrapping, opener restoration and reference-counted scroll ownership replace duplicated implementations. Backdrops are native close buttons. Styled dialog elements use open with the shared lifecycle, not showModal(); no native top-layer/inert behaviour is claimed.
- Forms/colours: native label associations, bounded email screening, short-ID/Unicode safety and readable supporting text. Impeccable guided accessibility fixes without redesigning product workflows. Registration/face steps, payment approval and report operations remain unchanged.
- CI/AI: npm lifecycle scripts disabled for installation; redundant FastAPI response declarations removed. Existing pinned, hashed, wheel-only Python installation retained. No runtime dependencies changed.
- SQL: historical schema reference fails closed before DDL/data changes. Runtime Flyway V1/V2 are unchanged. No installed database was migrated.

## Contextual exceptions

1. **54 SQL repeated literals:** explicit demo/reference tuples are snapshot data, not repeated application policy. Review each reported statement; do not rewrite immutable migrations just to introduce constants.
2. **Five scroll sections:** tabindex=0 on named wide tables/charts deliberately enables keyboard scrolling. Removing it would reduce access.
3. **Three modal interaction findings:** dialog/alertdialog props and Escape/Tab listeners are deliberate; shared focus/scroll regressions cover behaviour.
4. **Student-selection label:** visible student name and nested named native checkbox exist at rendered-DOM level; static analysis does not follow SelectionControl.
5. **Two historical SQL bulk statements:** original text remains reference material. An unconditional exception inside a transaction prevents execution; the disposable PostgreSQL regression proves a sentinel table/row survive even when psql continues after errors. Do not add WHERE 1=1 to silence a warning.

## Verification

From repository root:

```sh
./scripts/quality-check.sh
sh scripts/check-frontend-boundaries.sh
python3 scripts/test-postgres-schema.py
git diff --check
```

The PostgreSQL harness uses its own disposable container/database, never the installed database. It checks fresh/upgraded schemas, HTTP sessions, concurrency and historical-reference safety. Frontend regressions cover controller behaviour, role badges, shell classes, dialog focus/scroll, contrast and module ownership.

Local results: 18 script tests, 347 frontend tests, 55 AI tests, module-boundary checks and production build passed. Default Maven execution recorded 539 passed and four PostgreSQL-only tests skipped because schemaCheck.url was absent; the separate disposable PostgreSQL harness then passed its database-backed validation. Patch whitespace checks passed. The AI test runner emits an upstream Starlette/httpx deprecation warning; this is not a failed test.

An isolated local lint pass used ESLint 9.39.1, sonarjs 3.0.5, typescript-eslint/parser 8.46.2 and React plugin 7.37.5. Reported source paths and extracted modules pass the checked subset: cognitive complexity (15), nested conditionals/templates, JSX spacing/fragments, index keys, state pairs, readonly props and RegExp.exec. The entire remote analyzer/profile was not reproduced. Intentional focus/custom-component/dialog findings are documented, not suppressed. Temporary tooling is outside this repository.

Headless Chrome component fixtures covered 1440px/390px in light/dark themes: overflow, initial focus, Tab wrapping, Escape, restoration and backdrop close. Two bounded visual rounds were inspected; fixtures were removed. This is not an authenticated end-to-end or physical-device test. No real payment/email/account changes were performed.

## Handoff

Rerun Sonar on the submitted cleanup commit, match remote issue keys to the ledger, verify resolved items and review contextual findings individually. Do not use this local ledger as evidence of remote closure. PR #33 requires its own review after the main cleanup is settled.
