# Reminders inbox (opt-in pilot)

This ES-module Worker holds temporary Reminders titles for review in Store Scout. It cannot write Firebase. It requires no service-account key. Firebase bearer tokens are verified against the fixed Google public JWK endpoint; UID ownership governs all browser operations. Device credentials only upload. Only SHA-256 credential/code hashes are persisted. Do not share a paired Shortcut.

The phone-side action sequence is documented in the repository root
[`REMINDERS_SETUP.md`](../REMINDERS_SETUP.md). No iCloud Shortcut share link is
claimed here because one must be created and tested on Apple hardware.

Run from repository root using Node 24 (node:sqlite):

    node --test cloudflare/tests/*.test.mjs

Tests use generated RSA signatures and actual SQLite SQL through a small D1-compatible adapter. Parallel claim requests exercise one conditional UPDATE, but these local tests do not emulate distributed D1 concurrency, the Workers edge runtime, or an iPhone. Benchmark output measures local warmed JWT verification CPU/wall time; deployment must measure actual edge CPU against the Free plan before enabling this pilot. D1 batch is used for transactional pairing, upload, revocation and acknowledgement. No real user data is needed for tests.

## Free-only deployment preparation

Current deployment: `https://storescout-reminders-inbox.xxnovoaxgx.workers.dev`, database `storescout-reminders` (`b21bec73-2a4d-45d8-967b-91ae781737ad`). Workers Free and no payment method were verified in the account. The hourly cleanup schedule is deployed. Health returns 200, missing/forged identity returns 401, and an unapproved origin returns 403. Authenticated edge CPU and physical iPhone acceptance remain pending. Source uploads use the official Cloudflare API; configuration is mirrored in wrangler.jsonc.

For authorized redeployment:

1. Use Wrangler locally (`npx wrangler dev --config cloudflare/wrangler.jsonc` from the root, or run commands below from cloudflare). Do not enable billing or upgrade plans. Review current Cloudflare free quotas in its dashboard; quotas can change and this pilot must stop if Free is insufficient.
2. Create a free D1 database named storescout-reminders using the dashboard or `npx wrangler d1 create storescout-reminders`. Replace database_id in wrangler.jsonc with that ID. Keep FIREBASE_PROJECT_ID fixed to the existing Store Scout project.
3. Apply schema locally: `npx wrangler d1 execute storescout-reminders --local --file schema.sql`. Start local Worker with `npx wrangler dev`.
4. After review/authorization, apply remote schema using `npx wrangler d1 execute storescout-reminders --remote --file schema.sql`, then `npx wrangler deploy`. The config uses only Workers, a single D1 binding and an hourly cron; it enables no purchased services or logging.
5. Check GET /health gives {ok:true}, missing/forged Firebase auth gives 401 on /connection, then measure edge CPU on synthetic authorized traffic. Configure the public browser adapter only after passing deployment and iPhone acceptance checks.

Origins are exactly https://gabrielnovoa7.github.io, http://localhost:5500 and http://127.0.0.1:5500. CORS is not authentication: native Shortcuts may omit Origin. All responses are no-store; do not add request/header/payload logging or analytics. TLS is required for public use.

## API

### Kroger product pilot

The Worker can proxy Kroger's official Product and Locations APIs without
exposing credentials to the browser. Create an application at
[developer.kroger.com](https://developer.kroger.com/), then configure the
credentials as Worker secrets:

```text
npx wrangler secret put KROGER_CLIENT_ID
npx wrangler secret put KROGER_CLIENT_SECRET
```

The read-only endpoints are `GET /retailers/kroger/locations?zip=77019` and
`GET /retailers/kroger/products?q=milk&locationId=<location-id>`. Product
responses retain the retailer product ID, UPC when supplied, regular and
promotional prices, location, availability, and the fetch timestamp. The
adapter does not scrape retailer pages or accept credentials from requests.
Search terms and location IDs are bounded server-side. These endpoints are
rate-limited by the Worker before public rollout.

`GET /retailers/compare/stream?q=milk&zip=77019` provides the same data as
server-sent events. It emits status, product, and completion events so the
browser can render results incrementally. It currently uses the configured
Kroger adapter and is intentionally separate from the sample catalog; adding
another retailer means adding another approved adapter rather than scraping
the comparison site.

Browser operations require Authorization: Bearer <Firebase ID token>, with verified email. POST /pairings returns {code,expiresAt}; GET /connection returns {connected,lastUploadAt?}; DELETE /connection returns {ok:true}; GET /snapshots/latest returns {snapshot:{snapshotId,listName,items,uploadedAt}|null}; POST /snapshots/{id}/ack returns {ok:true}. Timestamps are ISO strings. Acknowledging a missing or another owner's ID returns the same success response without changing their data.

POST /pairings/claim with JSON {code} returns {credential} once. POST /snapshots with device bearer and JSON {listName,items:[string]} returns {snapshotId}. Codes and credentials have 256 random bits, represented as 43 base64url characters. A new pairing immediately revokes the prior device and pending data. Lost claim responses require a fresh pairing. Codes expire in 10 minutes. Device upload checks its credential again in the atomic INSERT so concurrent revocation cannot permit a late write.

Bodies are JSON only, at most 64 KiB; allow at most 200 nonempty trimmed titles, 100 JS string characters each and 100 for list name. Empty arrays are valid. Payloads expire logically after 24 hours even when cron fails. Acknowledgement tombstones expire after 30 days; hourly cron also removes stale rates and codes. Accounts retain only UID/credential hash/last upload until revoked; account row and last-upload metadata persist after disconnect for consistent status. Browser reads are capped at 120/account/hour, pairing creation at 5/account/hour, uploads at 30/account/hour; acknowledgement has an additional 120/account/hour cap. Failed authenticated uploads count towards upload limits. Random invalid codes/credentials do not allocate rows. Status codes: 400 invalid data, 401 credentials, 403 origin, 404 route, 413 body size, 415 content type, 429 limits, 503 unavailable/verification-infrastructure errors (verification fails closed as 401). Errors contain no secret or payload details.
