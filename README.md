# Store Scout

**Version 2.1 — live store prices, Firebase accounts and cloud lists**

Store Scout is a mobile-first grocery-shopping web app in development. Its goal is to make grocery shopping cheaper and require less work by connecting the shopping list people already use with product selection, price comparison, and shopping checklists organized by store.

Live site: https://gabrielnovoa7.github.io/StoreScout/

## AI-assisted development

I am building Store Scout with substantial assistance from AI, including ChatGPT and Codex. I guide the product vision, requirements, priorities, and design decisions, while AI helps with research, architecture planning, generating and modifying code, debugging, documentation, and testing.

This is an ongoing learning and portfolio project. My aim is to understand the decisions and code as the application develops, rather than simply generate a finished product. AI involvement is disclosed openly; the application is still a work in progress and its behavior and integrations need continued verification.

## Stores

| Store | Status | Source |
| --- | --- | --- |
| Kroger (plus Ralphs, King Soopers, Fred Meyer, Fry's, Harris Teeter, Smith's, QFC, Dillons, Mariano's, Food 4 Less) | Live | Official Kroger API, through the Cloudflare Worker |
| Whole Foods | Live (Houston stores) | wholefoodsmarket.com's own search feed, through the Worker |
| Sellers Bros. | Weekly ad only | `scrapers/sellers_bros.py` turns the weekly-ad PDFs into `data/sellers-weekly.json`; a GitHub Actions job refreshes it every Wednesday |
| Walmart | Coming soon | Walmart I/O affiliate API; adapter built, waiting on API credentials |
| H-E-B | Coming soon | No public API |

Prices are fetched live (or from the current weekly ad) for the chosen store location. Shelf stock is not verified, and in-store, pickup and delivery prices can differ.

## What works

- **My List:** add and remove groceries, undo removal, adjust package counts, filter items, and revisit saved product choices.
- **Compare:** live product search across the stores you shop at, with photos, package size, price, unit price and sale prices; sort by price, unit price or name; filter by brand or on-sale items. Best matches come first, and products that only mention the search word are grouped under "Related items".
- **Stores:** turn retailers on or off and pick a store location by ZIP code for each one (saved to your account).
- **Shopping:** check off selected products grouped by store.
- **Accounts and cloud lists:** Firebase email/password signup, verification, sign-in, reset, and sign-out; private lists available on every device signed in to the account.
- **Guest mode:** lists and product choices are saved in this browser.
- **Apple Reminders inbox:** a Shortcuts recipe uploads a Reminders shopping list to the Worker; the site previews it before saving. See [REMINDERS_SETUP.md](REMINDERS_SETUP.md).
- **Responsive layout:** desktop navigation and phone-friendly bottom navigation.

## Current limitations

- Only the stores above have real prices; Walmart and H-E-B are listed as coming soon.
- Sellers Bros. has no online catalog, so only items in this week's ad are searchable, and the PDF parsing is heuristic.
- Whole Foods covers the Houston-area stores only.
- Stock levels are not verified, and the app is not an installable/offline PWA.

## Technology

The current frontend uses HTML, CSS, and vanilla JavaScript. It extends the original project without requiring a framework, package installation, or build step. Browser localStorage provides guest-only persistence. Firebase Authentication manages tab-scoped sign-in state using session persistence: refreshing the same tab keeps you signed in, and Sign out clears the session. Closing the tab normally ends it, though browser session-restore features may restore tabs and their sessions. Store Scout never stores your password. Firebase-managed authentication state is stored in sessionStorage; authenticated grocery data has no persistent offline cache and is loaded from Firestore.

## Run locally — repository owner or authorized users only

Open `index.html` with VS Code Live Server, typically at http://127.0.0.1:5500. A static web server is recommended for consistent browser storage behavior.

These instructions do not grant permission to use or reproduce the code. See [LICENSE](LICENSE).

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html`, `style.css`, `theme.css` | Application shell, layout and themes |
| `model.js` | Store list, live-offer validation, size and unit-price parsing, search relevance, state validation |
| `script.js` | Screen rendering and browser interactions |
| `retailer-client.js`, `retailer-config.js` | Browser client for the Worker's store adapters and weekly-ad feeds |
| `product-photos.js` | Open Food Facts photo fallback for products without a retailer photo |
| `cloudflare/` | Worker: store adapters (`kroger.mjs`, `wholefoods.mjs`, `walmart.mjs`), Reminders inbox, tests |
| `scrapers/sellers_bros.py` | Sellers Bros. weekly-ad scraper |
| `data/sellers-weekly.json` | Generated weekly-ad data, served with the site |
| `firestore.rules` | Firestore security rules |
| `tests/` | Frontend and rules tests |
| `docs/adding-a-store.md` | How to add a store |

## Verification

With Node.js installed:

```sh
npm test
node --test cloudflare/tests/*.test.mjs
npm run test:rules
```

`npm run test:rules` needs Java 21 and the Firebase emulator. Browser checks cover searching each store, choosing a location, adding products, Shopping, and persistence after a reload and sign-in.

## Development direction

Next: turn on Walmart once its API credentials are set up, and keep adding stores that offer permitted price access (see [docs/adding-a-store.md](docs/adding-a-store.md)). Pickup and delivery prices and trip optimization are future possibilities.

GroceryChop provides visual inspiration for comparison controls and navigation. Store Scout has its own identity and focuses on Reminders synchronization, remembered product choices, and store-organized shopping.

## Rights and permissions

Copyright (c) 2026 GabrielNovoa7. All rights reserved, to the extent of the rights held by the copyright holder.

This project is **not offered under an open-source or free-software license**. No permission is granted to use, copy, modify, redistribute, sublicense, sell, deploy, or create derivative works from the code without prior written permission from the copyright holder, except where applicable law or GitHub's applicable terms provide otherwise.

Public visibility is not permission to reuse the code. GitHub's terms allow viewing and forking public repositories on GitHub; those platform rights do not constitute a general license to reuse this project. Third-party materials, if any, remain subject to their respective rights and terms.

See [LICENSE](LICENSE) for the full notice. Request permission from the repository owner before reusing any part of the project.

## Firebase setup and security tests

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for configuration, session behavior, cloud conflict handling, free-plan limits, and manual acceptance checks. Optional `npm ci`, `npm test`, and `npm run test:rules` commands run the logic and local emulator security tests. No runtime build step is needed.

## Profile and appearance

After verifying your email, open **Account > Profile & appearance** to set an optional display name, a five-digit shopping ZIP, Light/Dark/System mode, and a Green/Blue/Purple/Orange/Pink accent. Light with Green is the default. Click **Save profile & appearance** and wait for **Saved to your account**. These settings use the same private, revision-checked cloud document as your list and load when you sign into the same account on another device. Refresh older open tabs before changing profile settings.

Signing out clears the account appearance and restores the default guest appearance. System mode follows each device's operating-system preference. Display names and ZIP codes are profile information, not authentication credentials. The app icon and favicon use an original shopping-bag/check design.

## Product-selection accuracy

Compare keeps every choice tied to the grocery being selected, even if its search text changes. Products from different stores are shown as alternatives, not verified identical matches. A saved pick keeps a snapshot of the product (name, size, price, photo, store location) so it can be shown in Shopping without searching again.

Loading local or account data removes invalid product selections while keeping grocery names and quantities. Invalid picks return to **Needs a pick** and are excluded from totals and Shopping.

Basil and basil leaves require an explicit fresh/dried choice, and prepared products that contain basil do not match the herb.
