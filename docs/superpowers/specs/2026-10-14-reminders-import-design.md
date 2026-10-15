# Store Scout — Reminders import pilot

## Intent and constraints

Let users keep adding groceries through Siri to their usual Apple Reminders list, then bring that list into their existing Store Scout account with less repeated entry. The user approved trying Cloudflare first, with copy/paste as fallback, and reviewing imports before adding them. An iPhone Home Screen installation is available for manual testing. Keep Firebase accounts, profiles, and permanent lists; keep GitHub Pages hosting. Stay on Firebase Spark and Cloudflare Workers Free, without enabling billing. Leave changes uncommitted for the user.

This is an architectural addition. This document defines the proposed implementation; no Cloudflare resources or production integration have been created yet.

## MVP user experience

1. Signed-in, email-verified user opens Sync Apple Reminders.
2. Install a reusable, unpaired Shortcut through an Apple-hosted sharing link, once an actual tested Shortcut is available. Never present a placeholder as a working install link.
3. Choose Connect Shortcut. Store Scout issues a one-time pairing code, valid for ten minutes. The user pastes it into the Shortcut during setup. Automated launch/input is an enhancement only after an iPhone test succeeds.
4. The Shortcut exchanges that code for an upload-only device credential, then lets the user choose their usual Reminders list. Credentials are never requested in a chat or embedded in the public Shortcut template.
5. On each run, the Shortcut reads incomplete reminder titles from that selected list and POSTs a snapshot to the Cloudflare endpoint over HTTPS. Apple handles permission prompts. The Shortcut does not edit, complete, or delete reminders.
6. After an acknowledged upload, the Shortcut opens Store Scout at #import, with no credential or grocery data in the URL. It reports Uploaded for review, never Added to your shopping list.
7. Store Scout restores sign-in, or asks the user to sign in, then retrieves the pending snapshot belonging to that account.
8. Review shows list name, upload time, incoming title, and New / Already on your list / Repeated in this import status. The user can select rows. Show an explicit Add N groceries button and a Cancel option.
9. Only confirmation merges groceries into the current account list through the existing Firebase SDK and revision-checked save. Show success only after the Firebase write succeeds. Failed saves preserve the preview; conflicts require refreshing and recomputing it.
10. Account displays the paired Shortcut, last upload time, and Disconnect. A new pairing replaces the previous pairing in this first version.

## Import semantics

- Names are trimmed and compared using case-insensitive, collapsed-whitespace normalization only. Do not infer that pesto is basil or that fresh and dried herbs are equivalent.
- New unique names are checked by default. Names already present, including completed groceries, are unchecked by default and retain their existing quantity, completion, and exact selected product. The user may explicitly add another copy.
- Repeated titles within the snapshot are shown and unchecked after the first occurrence. Do not silently combine quantities. New items start with quantity 1; text such as 2 bananas remains text for now.
- Existing groceries, order, profile, enabled stores, and product preferences are preserved. Imports never remove items absent from Reminders, reopen completed groceries, or write completion back to Apple.
- For new items, reuse an existing remembered product only if the current compatibility validator accepts it. Otherwise leave Needs a pick. Basil still requires an explicit form.
- Reject invalid input without truncating it silently: at most 200 titles, each at most 100 characters after trimming, a list name at most 100 characters, and a request body at most 64 KiB. Empty snapshots show Nothing to import.
- Enforce the existing 200-item destination limit before confirming. If the live account list changes while previewing, rebuild the preview and require a fresh confirmation rather than overwriting it.
- Use a server-generated snapshot ID. Persist a bounded list of the last 20 applied IDs with the list in the same revision-checked Firestore write. Extend client cleaning and owner-only rules for this optional field. This makes a retry after a successful write safe even if the inbox acknowledgement failed. The Worker tracks acknowledged IDs for 30 days and never redelivers acknowledged snapshots.

## Architecture and security

Cloudflare is an inbox, not a Firebase administrator. Worker + D1 store pairing records and the latest pending snapshot. Store Scout's signed-in browser remains responsible for merging and saving to Firestore. No service-account private key, user password, Firebase refresh token, or broad Firebase write credential is stored at Cloudflare.

Browser requests carry a short-lived Firebase ID token in the Authorization header. Validate RS256 signatures using Google's trusted public keys and verify the configured project's issuer/audience, nonempty subject, expiry/issued-at, and email_verified. Never fetch a key URL supplied by a caller. Fail closed on verification failures. This is ordinary ID-token validation; immediate account-session revocation checks are outside this pilot and tokens can remain valid until expiry.

Pairing codes and device credentials contain 256 bits of cryptographic randomness. Store only SHA-256 hashes. Claim a code atomically once, binding the device to the verified account that created the code. Return the device credential once; a lost response requires pairing again. The private paired Shortcut stores that credential locally in its configuration; warn against sharing a paired Shortcut. Its credential permits only uploads to its bound inbox, with no permission to read account data or write Firestore. Every upload checks current pairing status so Disconnect revokes it immediately at the service.

Proposed API:
- POST /pairings: verified Firebase user creates an expiring one-time code.
- POST /pairings/claim: exchanges a valid unused code for one upload-only credential.
- GET /connection and DELETE /connection: verified Firebase user inspects/revokes their own connection.
- POST /snapshots: device bearer credential uploads a validated snapshot.
- GET /snapshots/latest and POST /snapshots/{id}/ack: verified Firebase owner retrieves/acknowledges their own snapshot.

Use indexed, parameterized D1 statements, atomic conditional writes for claims/acknowledgements, and explicit per-account/device request limits (5 pairing creations/hour, 30 uploads/hour, 120 reads/hour). Limit each account to one active pairing and each device to one pending snapshot. Invalid credentials receive generic errors; don't allocate D1 records for unauthenticated input. CORS permits only configured Store Scout origins and localhost preview; CORS is not authentication. Keep credentials and payloads out of URLs, logs, analytics, and error messages. Render imported text as text, never executable HTML.

Pending snapshots expire logically after 24 hours. Hourly cleanup attempts to delete expired payloads and old acknowledgements; cleanup failure must not make expired data accessible. D1 contains account IDs and reminder titles temporarily, and this must be disclosed before pairing. No addresses, reminder notes, due dates, or completed reminders are requested.

## Incremental delivery and verification

1. Pure import preview/merge logic with synthetic payloads, preserving choices and handling duplicates, limits, replay, and concurrent changes. Provide a paste-JSON/text entry point using the same preview pipeline as a working fallback.
2. Local Worker/D1 tests with synthetic identities: forged/expired/wrong-project tokens rejected, no cross-account reads, code expiry and double claim, revoke-before-upload, body limits, rate limits, and acknowledgement/replay behavior. Measure JWT verification and database work against Workers Free runtime limits before relying on deployment.
3. Connect the existing UI to a configured Worker, disabled by default until ready. Integrate Firebase ID-token access only inside the SDK boundary; never expose tokens in DOM/config/logs.
4. Deploy only to the user's Free Cloudflare account after local checks and explicit resource details are reviewable. Confirm actual plan/limits in the dashboard. No paid upgrade or Firebase rule broadening beyond the validated import receipt field.
5. Build the actual Shortcut on Apple hardware with the user, or produce a signed/shareable artifact through an available Apple-supported path. This Windows workspace alone cannot establish a tested iCloud installation link. Document the exact action recipe as the initial test path. Verify available Reminders fields on the phone; stable reminder identifiers are not required by this names-only pilot.
6. iPhone acceptance: install/add Shortcut; Reminders/network consent; pair; choose a list; upload a few synthetic groceries; reopen from Shortcuts; verify Safari versus Home Screen behavior; sign in if necessary; review; import once; rerun without unwanted duplicates; verify name/theme/product choices; disconnect and confirm old uploads fail. Also test denied permissions, no network, and failed cloud save.

Treat successful upload, successful preview retrieval, and successful Firebase save as separate outcomes. Do not claim end-to-end sync until the physical iPhone test passes. Do not change the existing tab-scoped sign-in policy just to mask a Safari/Home Screen isolation issue.

## Future scope

Automatic routine imports after review is reliable; stable reminder-ID reconciliation; completion sync back to Apple; multiple lists/devices; background Firebase merges; a polished prebuilt installation link; retailer feeds and full PWA/offline support. None is required for this pilot.

## Sources checked

- https://support.apple.com/en-ca/guide/shortcuts-mac/apd58d46713f/mac — API requests.
- https://support.apple.com/en-au/guide/shortcuts/apd624386f42/ios — launching Shortcuts with URLs.
- https://support.apple.com/en-gb/guide/shortcuts-mac/apd455c82f02/mac — command-line running/signing.
- https://firebase.google.com/docs/auth/admin/verify-id-tokens — validating Firebase user identity.
- https://firebase.google.com/docs/firestore/use-rest-api — authentication models; administrator credentials are avoided here.
- https://developers.cloudflare.com/workers/platform/pricing/ — Worker plan constraints.
- https://developers.cloudflare.com/d1/platform/pricing/ — free D1 limits and failure on exceeding quotas.
