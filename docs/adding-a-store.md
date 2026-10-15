# Adding a store

Every store goes through the same pieces. Kroger is the working example.

## 1. List it as coming soon

In `model.js`, add an entry to `stores`:

```js
{ id: "walmart", name: "Walmart", label: "Walmart", short: "W",
  color: "#3274bb", domain: "walmart.com", live: false, status: "coming-soon" }
```

- `id`: lowercase letters only; it is used in saved lists, Firestore rules,
  Worker routes and product IDs (`<id>:<productId>:<locationId>`).
- `domain`: the retailer's website; the logo is that site's icon.
- `status: "coming-soon"` shows the store under **Coming soon** on the Stores
  tab and keeps it out of comparisons, totals and Shopping.
- `family` (optional): other banners the same API covers, shown on the card.

## 2. Allow it in Firestore rules

In `firestore.rules`:
- add the id to `d.state.stores.hasOnly([...])` and raise `size() <= N`;
- add it to `validLocations` (both `hasOnly` and a
  `(!('<id>' in m) || validLocation(m.<id>))` line).

Add a rules test, run `npm run test:rules`, then publish:
`npx firebase deploy --only firestore:rules --project store-scout-9d930`.
Publish rules before the frontend that uses them goes live.

## 3. Build the Worker adapter

Create `cloudflare/<id>.mjs` exporting `locations({ zipCode, limit }, env, fetcher)`
and `products({ query, locationId, limit }, env, fetcher)`, modelled on
`cloudflare/kroger.mjs`. Return the same shapes:

- location: `{ id, name, address, distanceMiles }`
- product: `{ id: "<id>:<productId>:<locationId>", retailer, productId, upc,
  name, brand, size, price, regularPrice, available, locationId, source,
  fetchedAt }`

Rules for adapters:
- Official, permitted APIs only. No scraping.
- Credentials are Worker secrets (`npx wrangler secret put ...`), never in the
  browser or repository.
- Bound and validate every input (ZIP, query length, location ID, limit).
- Map retailer errors to 400/503 without leaking details.

Add routes in `cloudflare/worker.mjs` for `GET /retailers/<id>/locations` and
`GET /retailers/<id>/products` (same rate limiting as Kroger), plus tests in
`cloudflare/tests/`. Run `node --test cloudflare/tests/*.test.mjs`, then
deploy the Worker.

## 4. Turn it on in the browser

- `retailer-config.js`: add the id to `adapters`.
- `model.js`: set `live: true` and `status: "active"`.

The Compare page, sorting and filters, the Stores location picker, logos,
Shopping and saved picks all pick it up from there.

## 5. Check

`npm test`, `npm run test:rules`, the Worker tests, then in a browser: find
stores by ZIP, choose one, search a product, add it, and confirm it appears
in Shopping and survives a reload (and sign-in).
