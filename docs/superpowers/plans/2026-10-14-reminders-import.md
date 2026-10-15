# Reminders Import Implementation Plan

User approved inline execution; leave commits to the user. See ../specs/2026-10-14-reminders-import-design.md.

Goal: preview and safely add Reminders titles through a paste fallback and a Cloudflare upload inbox. Existing vanilla JS frontend, Firebase account coordinator, Worker ES modules and D1 SQLite. No admin credentials, billing upgrades, or automatic changes to Apple Reminders.

## Constraints
- Verified owner-only Firebase access and revision-checked saves.
- 200 incoming titles, 100 characters/title, 100 character list name, 64 KiB body, 200 destination items.
- One active pairing/account, ten-minute one-use codes, hashed upload-only credentials, no secrets in URLs/logs.
- Keep existing choices, quantities, profile and completion states under existing selection-validation rules.
- Receipts: optional importReceipts, last 20 unique IDs. Ack only after confirmed Firebase write.
- Pending snapshot expires in 24 hours, ack tombstones in 30 days, hourly cleanup.
- Pairing 5/hour, uploads 30/hour, reads and ack 120/hour.

## Review focus
- Repeated titles and quantities must not overwrite existing choices.
- Account changes or remote edits invalidate previews.
- Failed acknowledgement after successful save must not duplicate imports.
- Invalid/expired/wrong-project identity and concurrent claims fail closed.
- Safari/Home Screen may have separate login contexts; test on physical iPhone.

## Task 1: import core and receipts
- [x] Parser, preview, merge, compatibility and stale/limit checks.
- [x] Account serialization and owner-only receipt validation in Firestore rules.
- [x] Logic and emulator tests. Updated rules published to store-scout-9d930.

## Task 2: preview UI and paste fallback
- [x] #import route, explicit preview/confirm, duplicate labels, escaped text, capacity and error states.
- [x] Private preview cleared on account transition; failed saves retain review.
- [x] Browser fixture checked duplicate preview and explicit save; fixture removed.
- [ ] Physical mobile acceptance.

## Task 3: Cloudflare inbox
- [x] Real RSA JWT, parameterized SQL, atomic claim/upload/revocation/ack, limits and cleanup tests.
- [x] Free D1 storescout-reminders b21bec73-2a4d-45d8-967b-91ae781737ad created, schema applied.
- [x] Worker storescout-reminders-inbox deployed with hourly cleanup. Endpoint https://storescout-reminders-inbox.xxnovoaxgx.workers.dev.
- [x] Health 200, missing/forged identity 401, bad origin 403.
- [ ] Authenticated edge CPU measurement.

## Task 4: browser adapter
- [x] SDK-only ID token boundary, UID guards, connection/status/latest/revoke/ack, one-time code display.
- [x] Confirm before replacing connection/discarding pending upload.
- [x] Receipt recorded atomically before ack. Async account change and save race regression tests.
- [ ] Full paired upload/preview/save/replay acceptance.

## Task 5: deployment and iPhone
- [x] User authorized scoped Cloudflare OAuth; Workers Free and no payment method verified.
- [x] Current Firestore rules tested and published, endpoint enabled locally.
- [x] REMINDERS_SETUP.md one-run pilot recipe; no untested install link claimed.
- [ ] User creates/tests actual Shortcut on iPhone; persist credential for repeat runs and verify permissions/handoff.
- [ ] Create/share an unpaired installation template after testing.
- [ ] User commits/pushes frontend for GitHub Pages.

## Execution ledger
- Ruling: work in the user's existing checkout and leave commits to them, matching explicit preference.
- Ruling: user waived more spec/plan reading and authorized execution; no repeated document approval gates.
- Initial review found edit-during-save race. Failing regression reproduced it; captured snapshot ID and disabled draft edits while saving; fixed.
- Explicit replacement/disconnect warning regression passed.
- Copilot edits inspected before resuming. App tests 44/44, Firestore emulator tests 6/6.
- Authenticated browser check exposed Workers incompatibility: redirect:error is unsupported. Reproduced with credential-free local diagnostic and real local Workers runtime. Fix uses manual redirects and rejects non-OK key responses. New test failed before fix, then Worker 8/8 and app 44/44 passed. Local runtime verified the actual signature. Production correction deployed without diagnostics or payload logging.
- Temporary local diagnostic files removed. No commits made.

- Live signed-in browser acceptance: connection status succeeded (No Shortcut paired), latest inbox succeeded (No pending upload), existing/repeated preview titles unchecked, cancellation confirmed no changes. Test draft cleared; no groceries added. Next user step: commit/push frontend, then physical iPhone pairing/upload/save/replay test.
