# Store Scout - Handoff

Updated 2026-10-16. Branch `main`, in sync with `origin/main` at `9a55c94`.

## 1. Goal

Store Scout is a mobile-first grocery app (vanilla HTML/CSS/JS on GitHub Pages,
Firebase accounts, a Cloudflare Worker backend). Shoppers search products,
compare real prices across nearby stores, pick exact products, and shop from
checklists grouped by store.

Current focus: **more stores with real, searchable prices**, working like the
Kroger integration (live search, store picker, photos), and general features
that work for any store.

Live site: https://gabrielnovoa7.github.io/StoreScout/
Worker: https://storescout-reminders-inbox.xxnovoaxgx.workers.dev

## 2. Current state

| Store | Status | How it works |
|---|---|---|
| Kroger (+ Ralphs, King Soopers, Fred Meyer, Fry's, Harris Teeter, Smith's, QFC, Dillons, Mariano's, Food 4 Less) | **Live** | Official Kroger API through the Worker (`cloudflare/kroger.mjs`). Credentials are Worker secrets. |
| Whole Foods | **Live** | Worker reads wholefoodsmarket.com's own search feed (`cloudflare/wholefoods.mjs`). 11 Houston stores, sale and Prime prices, photos. |
| Sellers Bros. | **Live (weekly ad only)** | `scrapers/sellers_bros.py` (Scrapling + pdfplumber) turns the weekly-ad PDFs into `data/sellers-weekly.json`, served by GitHub Pages. About 224 sale items; **must be re-run weekly**. Current data covers Oct 14 to Oct 20, 2026. |
| Walmart | Coming soon | Walmart I/O developer account created; **public-key upload not finished** (see section 5). |
| H-E-B | Coming soon | Imperva/Incapsula bot protection; no public API. |

Features shipped this session: real store logos; sorting by price, unit price
and name; brand and on-sale filters; store location picker per retailer (saved
to the account); product photos (Open Food Facts by barcode for Kroger, Amazon
CDN for Whole Foods); "coming soon" store status; best-match search ranking
(a product's main noun decides relevance, so "eggs" shows eggs first and folds
Egg Noodles and Egg Rolls under "Related items"); pilot and Houston wording
removed.

Deployed and in sync: GitHub Pages (commit `9a55c94`), Worker (version
`ef62ac7b`, includes Whole Foods routes), Firestore rules (allow 5 stores and
saved locations for kroger/heb/walmart/sellers/wholefoods).

Tests (all passing at last run): `npm test` (62), `node --test cloudflare/tests/*.test.mjs` (16),
`npm run test:rules` (9, needs Java 21 + the emulator).

## 3. Active files

| File | Role |
|---|---|
| `model.js` | Store list (`stores`: id, name, domain for logo, `live`, `status`, `pricing`), live-offer validation (`cleanLive`), size and unit-price parsing, saved locations, **search relevance** (`relevance`, `mainNoun`) |
| `script.js` | All screens. Live results panel (`liveSection`, `liveCard`, `loadLiveProducts`), Stores page (`storeCard`, `findLocations`), click and change handlers |
| `retailer-client.js` | Browser client for all stores: Worker adapters (`/retailers/<id>/products`, `/locations`), weekly-ad JSON feeds, Kroger streaming |
| `retailer-config.js` | `adapters: ['kroger','wholefoods']`, `feeds: {sellers: 'data/sellers-weekly.json'}` |
| `product-photos.js` | Open Food Facts photo lookup (UPC conversion, cache, white-border trimming) |
| `cloudflare/worker.mjs` | Routes and rate limits; imports the retailer adapters |
| `cloudflare/kroger.mjs`, `cloudflare/wholefoods.mjs` | Retailer adapters (Whole Foods has the Houston `STORES` list) |
| `scrapers/sellers_bros.py` | Sellers Bros. weekly-ad scraper; venv in `scrapers/.venv` (git-ignored) |
| `data/sellers-weekly.json` | Generated weekly-ad data |
| `firestore.rules` | Allowed store ids and `validLocations`; **update when adding a store** |
| `docs/adding-a-store.md` | Step-by-step for adding a store |
| `docs/research/2026-10-15-grocery-api-options.md` | Research: which stores are reachable and why |
| `C:\Users\Gabei\.walmart-io\` (outside the repo) | Walmart I/O RSA key pair. **`WM_IO_private_key.pem` is secret: never commit or share it.** |

## 4. Changes made (this session, oldest first)

1. `f0de3b5` Kroger live search on the site; selectable Kroger picks saved with a product snapshot; Firestore allows 3 stores.
2. `98c6f2a` Store logos, sort and filter, ZIP-based store location picker, pilot wording removed, Firestore `locations` field.
3. `d1080b5` H-E-B and Walmart moved to "coming soon"; Kroger sister chains listed; warehouse locations filtered out; Open Food Facts photos; research notes and `docs/adding-a-store.md`.
4. `0268ff0` Larger, cropped photos; price and button moved to the right; list thumbnail overlap fixed.
5. `104ad4a`, `f822592` Sellers Bros. scraper and JSON feed; whole-word weekly-ad search; "not in this week's ad" notes; stopped tracking `__pycache__`.
6. Worker deploy `ef62ac7b`: Whole Foods routes. Firestore rules published three times as stores were added.
7. `9a55c94` (committed by Gabriel) Whole Foods on the site; best-match search ranking.

Walmart I/O: RSA key pair generated in `C:\Users\Gabei\.walmart-io\`. The public key
was pasted into the Store-Scout application; the upload did not complete yet.

## 5. Failed attempts and dead ends

- **Walmart public-key upload (unfinished).**
  - The full PEM with BEGIN/END lines failed with `addPublicKey ... status code 503`, which is a Walmart server error.
  - The key on one line, without BEGIN/END, failed with "Validation Errors occurred".
  - The 7 middle lines, without BEGIN/END, failed with "Validation Errors occurred".
  - Walmart's tutorial (https://walmart.io/key-tutorial) says to omit the BEGIN/END lines. Possible causes: the 503 attempt actually saved the key (so re-uploads are duplicates), or the Environment Type drop-down reset after the error.
- **Stores blocked by bot protection (not scraped, by choice):** Sam's Club (PerimeterX/Akamai; robots.txt disallows /search), Costco (Akamai/Kasada), H-E-B (Imperva), Target (PerimeterX CAPTCHA), Randalls (Akamai/Imperva), Sprouts (Instacart storefront CAPTCHA), Trader Joe's (Akamai "Access Denied"). Stealth or CAPTCHA bypass is out of scope.
- **Wegmans:** open price API and robots.txt allows it, but Gabriel doesn't shop there, so it was not added.
- **Sellers Bros. limits:** there is no online catalog, only weekly-ad PDFs. Parsing is heuristic: about 95% of ad prices pair with a name, and some pair wrong. Searching "eggs" finds nothing unless eggs are on sale that week.
- **Claude Code auto-mode blocked** re-running the scraper against sellersbros.com and committing the Whole Foods change (flagged "Third-Party Attack"). Gabriel committed and pushed manually. The scraper has `--pdf-dir` for offline parsing of saved PDFs.
- **Whole Foods "closest store" endpoint** (`/api/wwos/location/store/closest`) returns 403 without a signed-in session, so the Houston store list is hard-coded instead.
- **awesome-mcp-servers:** reviewed, not useful for the site. **public-apis:** only Kroger has grocery prices; Open Food Facts was adopted for photos; Racion prices are estimates (rejected).
- **Stale untracked files:** `docs/research/add-kroger-store.py` is an old one-off patch script that is already applied. **Do not run it again**: it would add a duplicate Kroger store. `docs/research/retailer-access-priority.md` is outdated (says Kroger is uncommitted). Delete both or rewrite them.

## 6. Specific next steps

1. **Finish the Walmart key upload** (Walmart I/O, then Applications, then Store-Scout):
   1. Refresh the page and check whether **Prod Consumer ID** and **Key version** already show values; the 503 attempt may have saved the key.
   2. If they don't, click **Upload Public Key**, re-select **PRODUCTION**, and paste the 7 lines from `C:\Users\Gabei\.walmart-io\WM_IO_public_key_body.txt`. In a terminal, `clip.exe < ~/.walmart-io/WM_IO_public_key_body.txt` copies them.
   3. If it fails again, try **STAGE**, or contact Walmart I/O Support with the error text.
2. **Then** check Walmart I/O **Subscriptions** for the affiliate product search and lookup APIs, and request access if needed.
3. **Store the private key as a Worker secret** (Gabriel runs this; the key never goes in chat):
   `cd cloudflare && npx wrangler secret put WALMART_PRIVATE_KEY < ~/.walmart-io/WM_IO_private_key.pem`
4. **Build `cloudflare/walmart.mjs`** following `docs/adding-a-store.md`:
   - Sign each request with RSA-SHA256 over `consumerId\ntimestamp\nkeyVersion\n` and send the headers `WM_CONSUMER.ID`, `WM_CONSUMER.INTIMESTAMP`, `WM_SEC.KEY_VERSION` and `WM_SEC.AUTH_SIGNATURE`.
   - Add the Worker routes, change Walmart in `model.js` to `live: true, status: "active"`, add it to `adapters` in `retailer-config.js`, and update `firestore.rules`.
   - Check that Walmart's terms allow price comparison.
5. **Automate the Sellers Bros. refresh:** a weekly GitHub Actions job (Wednesday) that runs `scrapers/sellers_bros.py` and commits `data/sellers-weekly.json`. Until then, run it manually each week and push.
6. **Kroger product photos from Kroger's own API** (`product.images`): a small change to `cloudflare/kroger.mjs` plus a Worker redeploy. That gives full photo coverage instead of about 40% from Open Food Facts.
7. **Clean up** the two stale files in `docs/research/` (section 5) and refresh `README.md`, which still describes the Houston pilot and sample data.

### Shipping checklist (any store change)
Run `npm test`, `node --test cloudflare/tests/*.test.mjs` and `npm run test:rules`. Then, in this order: deploy the Worker (`cd cloudflare && npx wrangler deploy`), publish the rules (`npx firebase deploy --only firestore:rules --project store-scout-9d930`), and commit and push. Refresh the browser cache after GitHub Pages updates.
