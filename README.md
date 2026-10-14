# Store Scout

**Version 2 — interactive GUI preview**

Store Scout is a mobile-first grocery-shopping web app in development. Its goal is to make grocery shopping cheaper and require less work by connecting the shopping list people already use with product selection, price comparison, and shopping checklists organized by store.

The initial pilot focuses on **in-store shopping at H-E-B and Walmart near ZIP code 77019 in Houston, Texas**.

## AI-assisted development

I am building Store Scout with substantial assistance from AI, including ChatGPT and Codex. I guide the product vision, requirements, priorities, and design decisions, while AI helps with research, architecture planning, generating and modifying code, debugging, documentation, and testing.

This is an ongoing learning and portfolio project. My aim is to understand the decisions and code as the application develops, rather than simply generate a finished product. AI involvement is disclosed openly; the application is still a work in progress and its behavior and integrations need continued verification.

## What works in Version 2

- **My List:** add and remove groceries, undo removal, adjust package counts, filter items, and revisit saved product choices.
- **Compare:** browse individual products with package size, price, unit price, sample availability, and promotion details; filter stores and sort by package or unit price.
- **Product matching:** clarify fresh versus dried basil and exclude products merely containing basil from basil matches. Different products are treated as alternatives, not identical matches.
- **Shopping:** check off selected products grouped by illustrative H-E-B and Walmart pilot locations.
- **Stores:** manage the retailers included in comparisons.
- **Responsive layout:** desktop navigation and phone-friendly bottom navigation.
- **Local persistence:** shopping lists, product choices, store preferences, and shopping progress are saved in this browser.

## Current limitations

**Prices, availability, promotions, and store locations are sample data, not verified local in-store offers.**

The Apple Reminders button currently explains the planned integration. It does not read or change Reminders. There are no backend accounts or cross-device synchronization yet. The app is a browser-based GUI preview; installable/offline PWA support is not implemented.

The intended future workflow is:

1. Add groceries to the usual Apple Reminders shopping list through Siri.
2. Run a prebuilt Apple Shortcut to securely sync that list to a Store Scout account.
3. Find relevant products at supported nearby store locations.
4. Choose exact products while comparing package sizes, prices, unit prices, availability, and promotions.
5. Shop using checklists grouped by the selected store locations.

Reliable, permitted retailer price access is still being researched. The Safari/Home Screen-to-Shortcuts handoff needs testing on an iPhone. In-store, pickup, and delivery prices must remain separate; the pilot prioritizes in-store shopping.

## Technology

The current frontend uses HTML, CSS, and vanilla JavaScript. It extends the original project without requiring a framework, package installation, or build step. Browser localStorage provides device-local persistence. Future backend choices will be made as account, sync, and retailer integration requirements are validated.

## Run locally — repository owner or authorized users only

Open `index.html` with VS Code Live Server, typically at http://127.0.0.1:5500. A static web server is recommended for consistent browser storage behavior.

These instructions do not grant permission to use or reproduce the code. See [LICENSE](LICENSE).

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Application shell and navigation |
| `style.css` | Responsive visual design and screen layouts |
| `model.js` | Sample catalog, grocery matching, sorting, state validation, and totals |
| `script.js` | Screen rendering and browser interactions |
| `tests/model.test.cjs` | Focused logic tests using Node's built-in test runner |
| `docs/superpowers/specs/` | Design documentation |

## Verification

With Node.js installed:

```sh
node --test tests/model.test.cjs
node --check script.js
node --check model.js
```

Browser verification covers adding groceries, choosing products, shopping checklists, persistence after refresh, basil clarification, store filters, empty results, removal/undo, and safe handling of typed text. These checks support the GUI preview; they do not establish production readiness or validate future integrations.

## Development direction

Build incrementally: refine the GUI, add accounts and backend persistence, validate secure Reminders synchronization, and integrate permitted retailer data sources. More retailers, pickup and delivery, and trip optimization are future possibilities.

GroceryChop provides visual inspiration for comparison controls and navigation. Store Scout has its own identity and focuses on Reminders synchronization, remembered product choices, and store-organized shopping.

## Rights and permissions

Copyright (c) 2026 GabrielNovoa7. All rights reserved, to the extent of the rights held by the copyright holder.

This project is **not offered under an open-source or free-software license**. No permission is granted to use, copy, modify, redistribute, sublicense, sell, deploy, or create derivative works from the code without prior written permission from the copyright holder, except where applicable law or GitHub's applicable terms provide otherwise.

Public visibility is not permission to reuse the code. GitHub's terms allow viewing and forking public repositories on GitHub; those platform rights do not constitute a general license to reuse this project. Third-party materials, if any, remain subject to their respective rights and terms.

See [LICENSE](LICENSE) for the full notice. Request permission from the repository owner before reusing any part of the project.
