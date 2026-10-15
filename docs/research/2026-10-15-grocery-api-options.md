# Grocery data sources beyond Kroger - 2026-10-15

Goal: find more stores we can connect the same way as Kroger: an official,
permitted API with real store-level prices and store locations, called from
the Cloudflare Worker so credentials never reach the browser. Scraping and
paid scraped-data resellers are out of scope.

## Result

Kroger remains the only grocery retailer with an open, self-serve price API.
But it covers far more than Kroger-branded stores, so the existing adapter
already reaches most of the country.

## 1. Kroger family - already works, no new code

Verified 2026-10-15 through our deployed Worker
(`/retailers/kroger/locations?zip=...`). The Kroger Locations API returns
every banner The Kroger Co. operates:

| ZIP | Banners returned |
|---|---|
| 90012 Los Angeles | Ralphs, Food 4 Less |
| 80202 Denver | King Soopers |
| 97201 Portland | Fred Meyer |
| 85004 Phoenix | Fry's Food And Drug |
| 98101 Seattle | QFC (Quality Food Center) |
| 28202 Charlotte | Harris Teeter |
| 67202 Wichita | Dillons |
| 60601 Chicago | Mariano's |
| 84101 Salt Lake City | Smith's |
| 45202 Cincinnati | Kroger, Harris Teeter |

Notes:
- Some results are non-retail facilities (e.g. "Harris Teeter - Forecast Shed
  - HT Trans", "Unused Spoke"). `retailer-client.js` filters those names out.
- The API also supports `filter.chain` and a `/chains` endpoint. Showing
  each banner as its own store (own logo, own toggle) would need the Worker
  to pass `chain` through; worth doing if users find "Kroger" confusing when
  their store is a Ralphs or King Soopers.
- Same credentials, same rate limits; no extra cost.

## 2. Walmart - official, but gated

Walmart I/O (walmart.io) lists an Affiliate Marketing API (catalog and
pricing) and a pricing/availability service that takes a store ID or ZIP.
Access requires approval as a Walmart affiliate/partner, and terms limit how
data is shown (affiliate links, attribution). This is the most promising next
store.

Next step: apply for the Walmart affiliate program and API keys; confirm the
terms allow price comparison next to other retailers and whether in-store
prices (vs. online/pickup) are available per store.

## 3. No public price API found

- **H-E-B**: none. Our earlier audit hit an hCaptcha on location-bound pages.
- **Target, Costco, Albertsons/Safeway, Aldi, Publix, Meijer, Sprouts,
  Trader Joe's**: no public price API found. Any data for these comes from
  scraping or resellers that scrape, which we are not using.
- **Wegmans**: no developer program. Wegmans' site publishes an `llms.txt`
  that describes internal `/api/stores` and `/api/products/{store}/{sku}`
  endpoints with per-store prices, but there is no product search JSON, no
  key process and no stated terms. Ask Wegmans before relying on it.

## 4. public-apis/public-apis review

Checked the Food & Drink and Shopping sections of
https://github.com/public-apis/public-apis.

Retailer price sources: only **Kroger** (already integrated).

Useful as supporting data, not as a new store:
- **Open Food Facts** (free, no key): product names, brands, images, sizes
  and nutrition by UPC/barcode. Kroger returns UPCs, so this could fill in
  product photos and let us recognize the same product across stores once a
  second live store exists.
- **Daily Food Recalls** (free, no key): merged FDA/USDA recalls. Could flag
  a recalled product on the list.
- **Spoonacular / Edamam / Chomp / Noms**: nutrition, recipes, product data;
  no store prices.
- **Racion**: grocery "prices" are estimates from national statistics with a
  per-chain multiplier, explicitly not shelf prices. Not suitable.
- **CartScout** and similar: scrape retailer pages; not used.

## 5. Other options

- **Open Prices** (Open Food Facts project, free, ODbL licence): crowdsourced
  prices backed by receipts or price-tag photos. Coverage is mostly Europe;
  only a handful of US stores have meaningful data. A possible future
  "community price" source, not a store integration today.
- **Instacart Developer Platform**: public API, but it sends a shopping list
  or recipe to Instacart, where the shopper sees prices. It does not return
  prices. It could add a "Shop this list on Instacart" button for stores we
  cannot price (H-E-B, Costco, Publix, Aldi, Safeway are on Instacart), but
  it requires applying for access.

## Recommended order

1. Kroger family: done. Consider showing banners separately.
2. Walmart: apply for affiliate API access, then build an adapter.
3. Instacart "send list" for stores without price APIs (needs approval).
4. Open Food Facts for product images and cross-store product matching.

## Sources

- https://developer.kroger.com/reference
- https://walmart.io/apirefservices
- https://www.wegmans.com/llms.txt
- https://github.com/public-apis/public-apis
- https://racion.app/developers
- https://blog.openfoodfacts.org/en/news/introducing-open-prices
- https://www.foodspark.io/grocery-api-guide/
- https://chainstoreage.com/instacart-opens-grocery-platform-third-party-developers

## Sellers Bros. (Houston) - checked 2026-10-15

- sellersbros.com is a Squarespace site with no online catalog or ordering.
  Prices appear only in the weekly ad (JPG pages plus two PDFs: mailer and
  in-store ad). PDF text extracts but the layout is scrambled
  ("1$ 77 ... Lb." = $1.77/lb), and it covers only advertised specials.
- Terms of Use forbid using "spiders, robots ... or intelligent agents" on
  the site, and limit content to personal use; commercial use needs
  "express written permission of Sellers Bros., Inc."
- Decision (owner, 2026-10-15): treat Store Scout as an example project and
  build it anyway. `scrapers/sellers_bros.py` uses Scrapling's plain fetcher
  (no stealth mode, honest user agent) to read the weekly-ad page and PDFs,
  pdfplumber to rebuild products from word positions and font sizes, and
  writes `data/sellers-weekly.json`, which the site searches like a live
  store. Parsing is heuristic: most items are right, some names or prices
  pair wrongly, so results are labelled as weekly-ad prices.
- Limits: weekly specials only (no full catalog); the ad applies to all
  stores; the JSON must be regenerated each week (run the script, commit).
  Stores with bot protection (H-E-B, Walmart) are still not scraped.
