# Pocket Ledger QA audit log

Audit started from the verified restore point `outputs.restore-point-2026-11-17`; no source changes were made before the baseline run. Baseline: `npm test` — 74 passing, 0 failing.

## Findings and fixes

| ID | Severity | Area | Reproduction / root cause | Change and verification | Status |
|---|---|---|---|---|---|
| PL-A01 | Medium | Money calculations | Repeated rupee additions used binary floating-point in summaries, account balances, outstanding balances and running statements. | Added integer-paise helpers; wired them into common ledger summary, account, outstanding and statement paths. Added repeated-decimal regressions. | Fixed |
| PL-A02 | High | CSV privacy / safety | A user-controlled note beginning with `=`, `+`, `-` or `@` was quoted but not neutralized, so spreadsheet programs could interpret it as a formula. | Added CSV cell escaping that prefixes formula-leading cells, including whitespace-prefixed values. Regression covers formula and ordinary quoted/comma text. | Fixed |
| PL-A03 | High | Backup restore integrity | Replace restore cleared stores and then wrote records one by one. A failed write could leave a partial ledger. Validation also allowed malformed numeric/date rows and file size was unbounded. | Validate supported structure and monetary fields before restore; cap import at 50 MiB; replace IndexedDB stores in one read/write transaction. The localStorage fallback rolls back on a failed write. Added validation and rollback regressions. | Fixed |
| PL-A04 | Medium | Referential integrity | A person could be deleted while reminders still referenced them; a bank account could be deleted while recurring templates/drafts still referenced it. | Added shared reference checks for transactions, reminders, recurring records and drafts; delete actions are guarded. Tested each reference type. | Fixed |
| PL-A05 | Medium | Offline navigation | Offline fetch failure could return `null` when the shell was not found, causing a rejected service-worker navigation. | Service worker now serves the cached shell for offline navigations when available, and a clear 503 response otherwise. Added a simulated offline worker test. | Fixed |
| PL-A06 | High | Storage failure / data integrity | App startup logged IndexedDB errors then continued rendering an apparently empty ledger; malformed localStorage JSON was silently treated as empty data. | Corrupt fallback data now raises an error; startup blocks behind a translated storage recovery dialog and does not continue to empty-state screens. Regressions cover the IndexedDB error and corrupt fallback behavior. | Fixed |
| PL-A07 | Low | Security headers | The app had no Content Security Policy. | Added a restrictive local-only CSP; inline styles remain enabled because generated chart/card styling uses style attributes. The app passed browser smoke tests after the policy was added. | Fixed |
| PL-A08 | Low | Repeatable QA | There were no lint/build aggregate commands. | Added `npm run lint`, `npm run build`, and `npm run test:all`. | Fixed |

## Test evidence

- Original baseline: 74 tests passed.
- Final unit/contract suite: 85 tests passed, 0 failed.
- `npm run lint`: syntax checked all 39 first-party JavaScript files.
- `npm run build`: all 25 local app and precache paths exist; no external font/CDN references.
- Playwright smoke: 5/5 passed — Chromium, Firefox, WebKit, Pixel 7 emulation, iPhone 13 emulation. Each run checks the 360px layout, backup replace round-trip, onboarding, demo, Quick Add, reminder link, backup screens, and service-worker control. The offline reload is exercised on Chromium (desktop and Pixel 7 emulation).
- Existing synthetic performance test processes 20,000 transactions; indexing and aggregates completed well below its 5-second limit.

## Remaining test limits

- The PIN is a convenience gate, not device encryption; that limitation is stated in the README. A user with browser developer tools or access to the device profile can inspect local data.
- Full screen-reader testing, Lighthouse accessibility scoring, and testing on physical iOS/Android devices were not performed in this local browser audit.
- Offline reload verification is automated on Chromium. Firefox/WebKit received online functional and layout smoke coverage; their offline behavior was not included in the final smoke gate because the Playwright service-worker cache was not populated reliably in those engines in this Windows test environment.
- No financial data was used; tests use isolated synthetic browser profiles and fixtures.
