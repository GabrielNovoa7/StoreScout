# Store Scout GUI v1 design
Date: 2026-10-14

## Goal
Provide a complete mobile-first list -> product selection -> store checklist experience. Reduce repeated decisions. Use explicitly labeled sample data while retailer access is researched. Preserve the original repository and extend its HTML, CSS, and JavaScript; no framework migration.

## Visual design
Warm off-white canvas, deep teal actions, dark text, restrained green savings accents, rounded white cards, generous spacing, system fonts, and locally authored inline SVG icons. Adapt GroceryChop's spacious controls and clear price hierarchy while giving Store Scout a list-first identity. Persistent bottom navigation on phones and sidebar on desktop: My List, Compare, Shopping, Stores. Support 375px screens without horizontal overflow, keyboard focus, larger text, and reduced motion.

## My List
Editable sample groceries with add, remove with undo, quantities, selected/needs-choice states, and comparison entry points. Remember selections on this device. Prominent Sync Apple Reminders opens an honest setup dialog: Not connected; Shortcut integration is planned. Never simulate successful sync. Manual entry supports this prototype and fallback use.

## Compare
Product cards show name, brand, package size, sample package price, normalized unit price, specific illustrative store location, availability, promotion conditions, and Select/Selected actions. Search, retailer filters, and package-price/unit-price sorts work. Keep grocery request, exact product identity, and location-specific offer separate. Compare unit prices only across compatible units. Unknown availability stays unknown; unavailable offers cannot be selected.
Ambiguous basil requires Fresh/Dried clarification. Keep fresh basil and dried basil distinct, exclude pesto and basil-containing products from basil matches, and separate exact same-product matches from substitutes. Never silently substitute. Remembered choices remain editable.

## Shopping
Group selected items by specific store location. Show quantities, package details, sample subtotals, completion checkboxes, and progress. Persist completion and allow reversal. Unselected requests stay visibly unresolved. Flag existing selections at disabled stores rather than silently removing them. No routing or checkout.

## Stores
Show ZIP 77019, Houston; H-E-B and Walmart pilot; in-store shopping. Illustrative locations must be labeled as such; do not invent verified addresses or distances. Store toggles control comparisons. Coverage and sample-data status are explicit. Pickup/delivery remain separate future methods. No geolocation permission needed.

## Implementation boundaries
Keep index.html, style.css, and script.js entry points, extracting catalog/state helpers into focused files as needed. Use stable request/product/offer/location IDs. Requested package count is separate from package contents. Duplicate list entries remain independent. Render user text safely.
Use versioned localStorage for list, selections, completion, and store preferences. Handle corrupt or unavailable storage gracefully, using in-memory state with an honest persistence message. State is local to this device, not an account.
Static mockups cannot validate behavior; a framework migration adds unrelated work. Interactive vanilla JavaScript is the chosen approach.
Backend accounts, real sync, secure Shortcut pairing, live retailer feeds, installation/offline PWA support, and route optimization are outside this increment.

## Verification
Exercise navigation and add -> clarify -> select -> shopping -> complete in a browser. Verify refresh persistence, empty lists, no matches, unresolved items, unavailable offers, incompatible units, duplicates, removal undo, corrupt storage, and HTML-like user input. Inspect phone/desktop layouts, dialogs, keyboard/escape behavior, contrast, and console errors. Add focused tests for matching, sorting, and state transformations where practical. Report checks and limitations.

## Delivery
After written-design and implementation-plan review, modify the original project, provide a local preview and verification results. No deployment or remote publishing.
