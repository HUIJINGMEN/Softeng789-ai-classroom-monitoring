# Production readiness: audit and execution plan

Status: repository audit completed; B1 implementation is in progress. Production acceptance is not complete.
Baseline: `6ad98953cae6f1b06020d53e98f9b7a728bd1c62` (merged PR #30).
Working branch: `hardening/production-readiness`. Audit date: 18 October 2026, Pacific/Auckland.

## Release scope

- One institution, adult users, deployment in New Zealand; hosting is not selected.
- Administrator, teacher and student workflows already present in the application.
- Bank transfer and cash only. A student claim is not a receipt of funds. Cash approval may have no attachment.
- Real account/report/invoice email; no real sends until a provider, sender and test recipient are authorized.
- Face/classroom recognition implementation belongs to another contributor. Preserve its interface and
  authorization boundaries; never replace unavailable recognition with a production success mock.
- No credit-card checkout, new business features, tenancy platform or wholesale UI redesign.
- Preserve the existing local database and frozen reports. Test migrations on disposable databases.

## Evidence and priorities

The register records the baseline audit. Current implementation/acceptance status is in Execution progress.

`C` = confirmed implementation/design boundary, established by source or existing regression tests;
not necessarily reproduced against the live database. `G` = verification/operational gap, not a proven
business bug. `D` = operator/product decision. P0 blocks deployment; P1 must be closed or explicitly
resolved before launch. P2 is maintainability work, not evidence of a security incident.

| ID | Priority/type | Root finding and affected owners |
| --- | --- | --- |
| R01 | P0/C | `DemoPaymentProvider` is unconditional. `PaymentService.checkout` records its result as a successful receipt and activates access; `PaymentMethodModal` always offers card checkout. There is no production-only denial. |
| R02 | P0/C | Passwordless staff activation accepts email + staff number as proof; pre-provisioned student claiming accepts known identifiers plus capture verification. No one-time invitation/email-ownership proof is present in these contracts. `AuthService`, registration DTOs/forms and administrator provisioning share this boundary. Additional administrator activation/recovery also needs an explicit supported path. |
| R03 | P1/C+G | `SessionAuthService` and `LoginAttemptService` hold state only in memory; the browser persists the bearer credential in `localStorage`. Gate methods trust the issued principal. Durable expiry/revocation, current account eligibility, browser credential protection and centralized default-deny coverage need a coordinated design, not a token-storage-only patch. |
| R04 | P0/C+G | SMTP implementations exist, but email defaults to demo and there is no production startup contract requiring real delivery configuration. `StudentReportEmailService` and `InvoiceDeliveryService` have durable no-resend barriers; legacy `FeedbackSummaryService.email` directly sends without the same durable claim. Real-provider and uncertain-delivery recovery acceptance is missing. |
| R05 | P1/C | `ManualPaymentService.submit` calls rounding helper `InvoiceAmounts.money` on input, whereas invoice/adjustment writes use strict `InvoiceInputMoney.require`. Manual payment amounts with excess precision can silently change. Multipart numeric/text validation and error responses must match the actual business contract. |
| R06 | P1/C+D | Manual approval passes `submission.submittedAt` to the ledger's `occurredAt`. Actual receipt time, student submission and administrator review are different events. Period receipts cannot be presented as independently verified bank/cash timing without capturing the distinction. Do not guess or rewrite legacy dates. |
| R07 | P1/C+G | Mounting shared `useReportReview` calls a writing `prepare` endpoint, including ordinary Overall navigation. Explicit Start/Prepare is a valid command, but browsing is not. Prepare is find-then-create without a unique open-draft constraint; concurrent first preparation requires PostgreSQL verification. Preserve edit-version checks, staleness and frozen exports. |
| R08 | P1/C | Existing SQL upgrades are manually selected/executed; no migration ledger/checksum owner is configured. Fresh/historical schema tests pass but do not track what an installed database has applied. Adopt one versioned migration mechanism with an explicitly reviewed existing-database baseline. |
| R09 | P1/G | Compose currently describes PostgreSQL and Qwen, not a verified application release. A production profile, immutable application artifacts, HTTPS/proxy contract, private storage mounts, startup configuration validation and release/rollback procedure are not yet demonstrated. |
| R10 | P1/G | No end-to-end backup/restore drill covers both PostgreSQL and protected attachments. Migration-time database backups are not ongoing recovery. Ownership, retention/deletion, cache policy, logs and short-lived media links need explicit production acceptance. Adult users do not remove these requirements. |
| R11 | P1/G | Unit, model, HTTP and ORM tests exist; there is no committed browser E2E suite for three roles, multi-tab editing, restart, PDF isolation and real SMTP integration. Load targets and recovery objectives are not yet agreed or measured. A passing build/dependency audit cannot close these gaps. |
| R12 | P2/C+G | Frontend runtime-cycle and selected public-entry tests exist; backend architecture tests cover selected beans/injection relationships and a fixed list of calculation classes. They do not enforce all cross-module write boundaries. Some view components still mix loading/forms/rendering; global CSS remains large. Local lint/format checks do not yet match remote feedback. |

These are grouped root issues, not a count of every affected line or every possible defect.
New findings enter this register with evidence; scope changes require an explicit reason.

## Execution progress

- R01 implementation: one server-owned payment-method policy, MANUAL by default, guarded direct
  checkout/provider calls and capability-driven shared desktop/mobile payment selection. DEMO needs
  an explicit local profile and cannot start under either production profile name.
- R04 configuration boundary implemented: production requires SMTP for both gateways, real sender
  addresses, credentials, verified encryption and bounded timeouts. Profile-loading tests cover
  `production` and `prod`; database settings no longer override production mail defaults. Legacy
  send idempotency is addressed in B2 below; this does not authorize a real-provider test.
- R03 browser/session transition approved by the user and implemented: digest-only PostgreSQL
  sessions, same-origin HttpOnly cookies, production Secure/__Host- policy, masked CSRF proof,
  default-deny HTTP security, current account checks and durable revocation. Old public Bearer
  credentials are rejected; old browser storage is removed. Logout failures retain a visible retry.
  Protected media grants and machine-key ingress keep their existing separate verification gates.
  R03 account-level abuse protection is now PostgreSQL-backed: admission commits before password
  verification, optimistic revisions bound concurrent requests, and a late success cannot clear
  newer failures. Expired pseudonymous windows are cleaned every ten minutes. This does not cover
  ingress-wide request limits.
- R02 activation/recovery code implemented: mailbox proof is required for every new student or
  pre-provisioned account activation; staff retain their administrator-assigned role. One-use,
  30-minute links bind identity/email/purpose/current password state. Consumption joins registration
  or password-reset transactions; reset revokes all sessions and never automatically signs in.
  Face verification and approval gates remain. A durable request queue hides lookup/send timing;
  separate per-email limits and no-resend dispatch claims bound abuse/replay. No plaintext proof is
  stored or returned publicly. Production requires account SMTP/sender configuration; local default
  is explicitly disabled. User decision on 19 October: provider not selected, complete code/local
  tests only, no real messages. Provider/inbox/recovery operations acceptance remains open.
- R05/R06 implemented in B2: strict manual-payment precision and an explicit administrator-confirmed
  Auckland receipt date. Historical dates are not inferred or rewritten.
- Installed database cutover: a private custom-format backup was made and its archive directory
  parsed before the additive `20261018_add_login_sessions.sql` migration. Only the new table/indexes
  were added; student/teacher/invoice/transaction counts remained 9/5/16/7. No passwords, historical
  transactions or frozen reports were rewritten. A parsed archive is not a full restore drill.
- Updated local frontend/backend were started; health and the same-origin proxy returned 200,
  anonymous management access returned 401. After the user signed in, desktop Chrome restored the
  administrator session on a Students-page reload. The student directory loaded 9 students and
  payment accounts loaded 9 accounts, with $4,694 outstanding and $500 reported but awaiting
  verification shown separately. Student/payment checks were read-only: no approval, report export,
  email or account edits were performed. The initially open Overall workspace was not reloaded or
  revisited because its mount-time preparation write remains R07. Teacher/student/mobile browser acceptance
  remains open; automated restart/revocation tests are not a substitute for those checks.
  No real emails/payments or Git staging/commit/push have been performed.
- Follow-up login-guard cutover: a fresh private backup at
  `data/backups/login-guard.qRZzRA/database.dump` was validated using the container's archive reader
  (not a restore drill). Only `20261018_add_login_attempt_windows.sql` was applied. Counts remained
  9 students, 5 staff, 16 invoices, 7 transactions and 1 existing session. The rebuilt backend was
  started, health/proxy returned 200 and anonymous admin access returned 401. Reloading the payment
  page in Chrome retained the existing System Admin login and the same account totals; no payment,
  email or account mutation was performed. Teacher/student/mobile acceptance remains open.
- Account-link cutover on 19 October: archive backup
  `data/backups/account-links.wysbka/database.dump` was parsed (not restored). Only the additive
  `20261019_add_account_links.sql` table/indexes were installed; counts remained 9/5/16/7 and one
  existing session. New backend runs with account email explicitly disabled and report/invoice
  gateways in demo mode. Health/proxy returned 200, anonymous management access 401, and a fake-address
  request with genuine CSRF proof returned 503 with an explicit no-email-sent message. Chrome retained
  the existing administrator session after restart. The real invalid-link route removed its fragment
  and displayed recovery copy on desktop and 375×667 device emulation without horizontal overflow.
  Valid-link activation/reset used only disposable test accounts and the test-source inbox, not
  installed accounts. Real mailbox delivery, physical-device input and complete browser activation/
  reset acceptance remain open; this is not a production release approval.

B1 capability/session/login-guard/account-link regression: `./scripts/quality-check.sh` passed on Java 21:
488 backend tests passed; two PostgreSQL-only tests were intentionally skipped by the ordinary
runner. 292 frontend tests, the TypeScript/Vite build, 55 AI adapter tests and 18 script tests passed.
The separate disposable PostgreSQL harness passed fresh and historical upgrades plus real HTTP
login/logout across three application-context reconstructions per database: an active cookie remained
valid after reconstruction, and a signed-out cookie remained rejected after another reconstruction.
On both fresh and upgraded PostgreSQL, 12 concurrent requests through two independent store owners
admitted exactly 3 reservations; the blocked budget survived reconstruction. H2 and HTTP tests also
cover normalized identities, maximum=1, exact expiry, cleanup, late success, outer-transaction rollback,
rejected cookies and refusing password verification when admission is blocked/unavailable.
Account proofs survived application reconstruction on both PostgreSQL paths; concurrent consumption
had one winner. Focused tests also cover CSRF, generic asynchronous request responses, independent
mail limits, stale status/role/email/password binding, expiry, replay, transactional rollback, session
revocation, disabled delivery and uncertain-send no-replay. SMTP composition uses a mocked sender.
An existing register hook test depended on the wall-clock week; its clock is now fixed to its fixture
week without weakening cancellation/stale-response assertions. No production date logic was changed.
Automated tests used disposable databases, not the installed database. npm reported zero findings; OSV reported none across
133 Java/Python runtime packages after adding Spring Security. These checks and the limited admin
browser acceptance do not close three-role/mobile acceptance, real-provider delivery, ingress-wide
abuse protection, invitations or the remaining gates.

## Existing safeguards to preserve

- Recorded-mark attendance and recording completeness are separate; no recorded marks is unavailable,
  not 0%. Shared Auckland clocks reject ambiguous DST inputs. Current Level is not historical Level.
- Billing distinguishes all debt, overdue debt, period cash and current balances; mixed/unassigned
  allocations remain visible and must reconcile. Surplus receipts do not settle a different invoice.
- PostgreSQL has a unique pending manual submission per invoice; review and ledger writes use locks.
  Pending claims are not cash. Cash-without-receipt approval already has regression coverage.
- Leave decisions coordinate attendance and billing separately; a booking does not prove a completed make-up.
- Reports version edits, invalidate stale approval and freeze saved/public exports. Partner Overall
  snapshots omit personal rosters; private teacher notes must not enter class/overall AI context.
- New report and invoice mail flows persist a no-resend boundary before external sending.
- Staff class scoping, student ownership, protected media grants and machine AI keys already exist.
- The assistant plans bounded read queries; it neither executes model-produced SQL nor mutates billing.

## Module audit coverage

This phase checked source boundaries and the existing regression baseline, not every live UI action.

| Area | Reviewed boundary | Acceptance still required |
| --- | --- | --- |
| Identity, staff, registrations | `AuthController`, auth/session/login guards, `AuthService`, `AdminService`, `useAuth` | Activation proof, recovery, current eligibility, restart/revocation and default-deny HTTP matrix |
| Students, enrolments, campus/rooms | Directory/controller ownership, class scope and active/withdrawn distinctions | Role E2E, historic enrolment preservation, create/edit/archive and stable count reconciliation |
| Sessions, schedules, attendance | `SessionClock`, `AttendanceMetricPolicy`, roster/session access, overview state | DST boundaries, overlapping lessons, missing marks, scope changes and independent data-to-screen checks |
| Leave, make-ups, fee/support requests | Request coordinators, credit decisions, transaction boundaries and existing integration tests | Concurrent approvals, stale requests, one-time financial/attendance effects and permission failures |
| Billing, evidence, accounts | Checkout/provider, manual submission/review/storage, monetary policy and ledgers | Manual-only capabilities, strict inputs, actual-receipt timing, concurrent HTTP approvals and statement parity |
| Student/class/overall reports | Scope/evidence/review services, shared review hook, repositories and frozen documents | Browse-versus-command behaviour, concurrent first drafts, three-role export/privacy and browser PDF tests |
| Achievements, events, health | Publication/correction and staff class checks; machine ingest/auth boundary | Cross-class negative tests, duplicate ingestion/review, student visibility and bounded list/load behaviour |
| Admin assistant and AI adapter | Read-only orchestrator, authorized tools, machine middleware/provider selection | Ambiguous identity, revoked access during inference, unsupported questions and unavailable AI without false success |
| Delivery/storage/deployment | SMTP gateways, durable claims, protected files, configuration/Compose and CI | Legacy mail parity, real SMTP test, private cache/log policy, production startup and restore/release drills |

## Implementation order and gates

### B1 — Production capability boundary and identity

R01–R04. Make bank/cash capabilities authoritative at the server; block direct card/demo collection in
the production configuration and hide unsupported UI methods. Require real SMTP configuration rather
than silent demo fallback. Use an expiring, single-use invitation/verification proof for activation;
identifiers alone must not activate a pre-provisioned identity.

Resolve identity/session persistence and browser transport together. Approved direction: same-origin
secure HttpOnly session cookie, persistent PostgreSQL-backed sessions, CSRF protection, current
eligibility checks and explicit public/machine endpoint exceptions. Do not add a second production
credential system or expose old bearer sessions indefinitely. Preserve local development and the
separate external recognition integration contract. The user approved the one-time login cutover.

Gate: authorization tests for every route category, invitation replay/expiry/mismatch, deactivated or
pending accounts, logout/revocation/restart, CSRF and direct blocked checkout. No real mail/payment.

### B2 — Source contracts, commands and migration ownership

R05–R08. Reuse strict monetary validation across every write entrance. R06 is agreed: administrators
confirm the actual receipt date, which drives period receipts; submission and review retain separate
timestamps. Never infer or rewrite historical receipt dates. Split report queries from explicit preparation, then verify creation
idempotency/uniqueness and versioned editing against PostgreSQL. Bring legacy mail onto a durable
delivery boundary, with its exact reviewed revision and an audited uncertain-outcome procedure.

Adopt one migration owner. Do not replay historical normalization SQL on the installed database,
silently enable automatic baselining, delete existing drafts to create uniqueness, or mutate frozen
reports. Any conflict reconciliation needs an explicit reviewed plan and backup.

Gate: fixture-level independent expected totals, repository/API/UI contract parity, concurrent requests,
fresh schema and installed-schema adoption on disposable copies, rollback/restore compatibility.

### B3 — Structural and automated enforcement

R12 and the relevant part of R11. Enforce module public entrances and write ownership; keep pure
calculation policies independent of transport and UI. Refactor only confirmed mixed responsibilities,
with behaviour tests first. Keep CSS changes scoped to owning surfaces and compare real routes.
Add local lint/format/complexity commands to the standard gate; cloud-only security analysis remains
a separate required check, not something local lint can claim to replace.

Gate: no runtime cycles or prohibited cross-module writes, deterministic tests, typed build,
desktop/mobile functional acceptance and remote static checks on the submitted revision.

### B4 — Deployment and final acceptance

R09–R11. Build reproducible application artifacts; use environment-specific secrets, HTTPS and
restricted private service access. Establish liveness/readiness, redacted correlation logs, delivery/
backup failure visibility and bounded resource use. Restore database plus attachments into a separate
environment, verify business invariants, then rehearse application rollback without assuming destructive
schema rollback is safe. Do not choose cloud accounts or publish services without authorization.

Gate: all release blockers closed; three-role browser E2E (including failures/retry/stale tabs),
authorized SMTP integration with a designated test recipient, PDF/privacy checks, measured load and
restore objectives, remote CI/Sonar, release runbook and remaining-risk sign-off. SMTP acceptance is
not proof of delivery to the recipient's inbox. Tests with mocks do not certify another team's vision service.

## B2 boundary fixes and installed cutover — 19 October

- R05: manual payment input shares strict `InvoiceInputMoney` validation, before evidence storage.
  The browser rejects excess decimals before numeric conversion; the API refuses non-finite,
  non-positive, over-limit or excess-precision amounts instead of silently rounding them.
- R06: approval requires an explicitly selected, non-future actual Auckland receipt date. The ledger
  uses that day's boundary (date precision, not an invented exact transfer time). Submission/review
  timestamps stay separate; existing approvals keep `received_date = NULL` and their old ledger dates.
  The review UI puts the actual date beside submission information, with accessible validation/focus.
- R07: Student/Class/Overall draft lookup uses authorized read-only GETs. Mount/retry does not prepare
  or merge a draft. Explicit Prepare/Refresh rechecks sources before editing/delivery. Parent locks
  and partial unique indexes prevent duplicate open scopes; optimistic editing/frozen exports remain.
- R04 legacy delivery: `feedback/` owns a committed per-reviewed-revision claim and exact payload
  snapshot before SMTP. A repeated request, address change, crash or uncertain completion cannot
  automatically resend that revision. Historical successful sends are preserved. The legacy sharing
  UI no longer reports UNKNOWN/unrecognized delivery as completed. No exactly-once SMTP claim is made.
- R08: Flyway owns future schema versions/checksums. V1 is DDL-only, not the old mixed seed/repair
  script. Adoption is explicit, backed up and checked against columns/types/nullability, constraints,
  index semantics and open-scope duplicates. Equivalent legacy unique indexes and dump/restore enum
  casts are normalized narrowly; missing protections still fail. Automatic baseline/repair/clean are
  disabled. The inspected local pre-Flyway alignment adds missing classroom FKs/room index and the
  two supported make-up event values; validation and the full baseline must pass before commit.
- CSRF follow-up: each unsafe browser operation reacquires a masked proof, coalescing only concurrent
  acquisitions. Missing-cookie/stale-proof 403s do not cause automatic mutation replay. Protection
  failures have a separate `CSRF_INVALID` code from ordinary denied access. `/api/attendance/batch`
  remains a protected read-only batch query, not an attendance-save endpoint.

Validation: Java 21 full quality run passed 499 backend tests (3 PostgreSQL-only tests skipped by
the ordinary runner), frontend model/boundary tests and build, 55 AI tests and 18 script tests.
The final frontend-only run passed 297 tests after the delivery-status/read-only-readiness checks.
The separate Java 21 PostgreSQL harness passed fresh installs, historical upgrades and an actual
private backup restored into a disposable database: explicit adoption/refusal, row counts/digests,
repeat migration, checksum-drift refusal, disabled clean, ORM validation, restart/session budgets,
single-use account links and simultaneous first preparation for all three report types.
The dependency gate passed with zero npm/OSV findings across 139 runtime packages; Flyway's Jackson 2
graph is separately pinned to 2.22.3, while application JSON stays on Jackson 3.

Installed cutover: backend writers were stopped and a private verified archive was saved at
`data/backups/five-cutover.x7OAQI/database.dump` (earlier restored rehearsal archive:
`data/backups/five-boundaries.88ITcF/database.dump`). Known DDL alignment, explicit V1 adoption and
V2 completed. Counts and one-way row digests for students, staff, invoices, transactions, manual
submissions, all three report tables and feedback summaries matched exactly before/after. No historic
actual receipt date or email claim was fabricated. The rebuilt immutable Java 21 backend restarted
on loopback with account mail disabled and report/invoice mail demo-only. Health/proxy returned 200;
anonymous administration returned 401. Chrome retained the administrator login and $4,694 outstanding /
$500 pending verification. Browsing Overall, Class and an existing reviewed Student draft left report
counts/revision totals unchanged (Class 12/69, Overall 15/109, Student 7/55). No Prepare/Save/Approve,
publication or email action was invoked. One demo receipt's original file is absent; the existing
missing-file state remains truthful. No real mail, business payment or Git write was performed.
The disposable test containers/restored copies were removed; both private backup archives remain.

This is not production release approval. Real SMTP, first production-owner provisioning, HTTPS,
deployment/rollback, protected attachment recovery, role/device acceptance and the remaining R09–R11
operational decisions are still gates. Database restore rehearsal does not establish attachment
restoration or ongoing backup operations.

## B2 maintainability follow-up — 19 October

Legacy feedback email orchestration now depends on a dedicated `FeedbackEmailDeliveryStore`, not
repositories or a transaction template. The store commits claims/completion independently; SMTP
runs outside transactions. Architecture tests enforce that split, and behavior tests cover claim
failure, previous receipts, uncertain gateway results, completion failure and concurrent requests.
The shared report-review hook has one report-reset path and one successful-section acceptance path;
individual saves, generation and batch operations preserve unsaved text in other/failed sections.

The Java 21 quality gate passed, including frontend 303 tests, typed production build, backend,
AI adapter and script tests. The final report-hook suite was rerun after test readability cleanup.
This follow-up changes no schema, business rules or installed data, sends no real mail and does not
restart the installed backend. The production release gates above remain open.

## Required operator/product decisions

- R06 confirmed by the user: use the administrator-confirmed actual receipt date for period receipts.
  Preserve original submission/review timestamps and do not infer historical actual dates.
- Hosting, domain, SMTP sender/provider and designated test recipient: unknown; block live acceptance,
  not source inspection. Configure bank details through the existing authorized administrator workflow.
- Expected dataset/concurrency, acceptable data loss and restore time, retention/deletion policy,
  backup ownership and privileged-account recovery/MFA policy: must be agreed before release.
- Recognition service owner supplies its API and failure contract. No biometric bypass is included here.

## Baseline evidence

On the baseline commit, `./scripts/quality-check.sh` passed: backend tests, 277 frontend tests,
production frontend build, 55 AI tests and 18 script safety tests. The separate PostgreSQL check passed
both fresh and historical-upgrade paths on its own temporary container. The dependency gate reported
zero npm findings and zero OSV findings across 128 Java/Python packages at audit time.

No business code, installed schema, payment, report publication or mail delivery was changed in this
audit phase. No staging, commit or push was performed. These baseline checks are not production sign-off.

## Design references

- [OWASP email verification](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html)
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Spring Boot session support](https://docs.spring.io/spring-boot/reference/web/spring-session.html)
- [Spring Boot 4.0 mail configuration](https://docs.spring.io/spring-boot/4.0/appendix/application-properties/)
- [PostgreSQL 16 backup and recovery](https://www.postgresql.org/docs/16/backup.html)
