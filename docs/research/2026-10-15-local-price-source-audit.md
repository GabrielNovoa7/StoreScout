# Houston pilot source audit - 2026-10-15

Result: real location-bound Walmart online/pickup observations are obtainable through normal browsing. No in-store prices have been verified. H-E-B location-bound access is blocked by a human security challenge in this browser. This audit is not an automatic refresh pipeline or a permission finding.

## Scope
Walmart Houston Heights Supercenter #5959, 111 Yale St, Houston TX 77007.
H-E-B Buffalo Market #599, 5225 Buffalo Speedway, Houston TX 77005.
Five grocery requests, ten product candidates. No checkout, purchases, subscriptions, or sign-in performed. No application catalog changed; existing uncommitted retailer/Kroger work left intact.

## Walmart observations
Used the normal store page's Make this my store button. It displayed My store #5959 and the product pages displayed Houston Heights Supercenter as pickup location. All prices are explicitly online-purchase prices. Store selection is in this browser session, not encoded/proven merely by the product URL.

| Product | Package | Online price | Unit observation | Pickup observation |
|---|---|---|---|---|
| Great Value whole milk | 1 gallon | $2.53 | displayed 2.0 cents/fl oz, rounded | available, aisle A32 |
| Great Value cage-free large white eggs | 12 count | $1.67 | displayed 7.0 cents/oz; do not compare with per-egg figures | out of stock |
| Fresh banana | each, variable weight | estimated $0.20 | $0.50/lb, final weight determines cost | available, aisle AP5 |
| Wonder Classic white bread | 20 oz | $2.47 | displayed 12.4 cents/oz, rounded | available, aisle A35 |
| Freshness Guaranteed boneless skinless chicken breasts | variable tray | average $12.85 | $2.57/lb, final weight determines cost | available, aisle AC1 |

Product IDs/URLs and observation timestamp are in the adjacent JSON. Availability describes the online pickup option, not guaranteed shelf inventory. Chicken main heading says 2.75-7.0 lb; metadata and description contain other ranges. Do not silently choose a fixed weight. No promotion terms were validated.

## H-E-B observations
Identified official product candidates for all five requests. Fetched pages resolve to Victoria H-E-B plus!, not #599. Their numeric prices were intentionally excluded from the Houston dataset. Browser navigation to Buffalo Market encounters an hCaptcha. No attempt was made to solve or bypass it.

Official candidates: milk 314130, large cage-free white eggs 325137, bananas 377497, Wonder bread 2197279, raw boneless chicken breasts 1767797.

## Matching
Milk and eggs are different store brands: alternatives, never identical products. Chicken brands/weights differ; compare compatible per-pound offers as alternatives. Banana bunch versus each cannot be compared using package totals. Wonder Classic white 20 oz is a plausible exact-product candidate, but verified UPC/GTIN is still needed before grouping retailer offers as identical.

## What this establishes
Generic search/fetch prices are unsafe for local comparisons: the initial Walmart fetch defaulted to Des Moines and H-E-B to Victoria. Normal location selection produced Yale Street pickup observations. This does not establish permission, stability, or completeness for automated extraction.

## Next gate
A human can complete H-E-B's security challenge in the browser and select Buffalo Market, in-store mode. Then repeat the same five-item audit. Compare online observations with shelf labels/receipts before labeling any price in-store. Investigate approved Walmart affiliate/API access for automation; confirm store-specific fulfillment coverage and reuse terms before depending on it. No paid data provider, API plan, or billing change was enabled.

## Follow-up: H-E-B browser access restored
The user completed the security check. The restored session initially selected Montrose Market despite displaying Buffalo Market's store-details page. Used the normal shopping-store selector to explicitly select Buffalo Market #599, retaining In-store mode. All five product pages subsequently named Buffalo Market in aisle/location details.

| H-E-B product | Package | Displayed price | Displayed unit price | Store location |
|---|---|---|---|---|
| H-E-B whole milk | 1 gal | $3.43 | $0.03/oz, rounded | Dairy back wall |
| H-E-B Grade AA cage-free large white eggs | 12 ct | $2.86 | $0.24/ct, rounded | Dairy right wall |
| Fresh bunch of bananas | average 2.4 lb, 4-7 bananas | estimated $1.18 | $0.49/lb | Back edge of produce |
| Wonder Classic white bread | 20 oz | $2.47 | $0.12/oz, rounded | Aisle 4 |
| H-E-B Natural boneless chicken breasts | average 2.85 lb | estimated $14.22 | $4.99/lb | Meat Market back wall |

The earlier H-E-B blocker is resolved for this browser session. Prior generic-fetch observations remain rejected as wrong-store data. These new observations have verified store and in-store UI context, but have not been independently checked against shelf labels, receipts, or checkout; the adjacent JSON preserves that distinction. Aisle display does not establish current stock. Product URLs alone do not preserve session location. No automated refresh or reuse permission was established. No application catalog or saved shopping list changed.

Cross-store totals are intentionally not computed: Walmart was pickup mode and H-E-B in-store mode; store-brand products are alternatives, not exact matches. Rounded displayed unit prices must not replace exact calculations from known package quantities. Milk is a volume unit (fl oz); H-E-B's generic oz label needs normalization rather than a mass conversion.
