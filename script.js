/* Store Scout frontend. Retailer data is illustrative; accounts use Firebase when configured. */
(() => {
  "use strict";
  const M = window.Scout;
  const Account = window.ScoutAccount;
  const Retailers = window.ScoutRetailers;
  const KEY = "store-scout-gui-v1";
  let storageOK = true,
    state;
  try {
    state = M.restore(localStorage.getItem(KEY));
  } catch {
    state = M.initial();
    storageOK = false;
  }
  let view = "list",
    filter = "all",
    listQuery = "",
    compareQuery = "",
    compareSort = "price",
    liveProducts = [],
    liveStatus = "",
    liveBrand = "",
    liveSaleOnly = false,
    liveNotes = [],
    liveTerm = "",
    liveShowRelated = false,
    locationResults = {},
    locationStatus = "",
    areaZip = "",
    activeId = null,
    removed = null;
  let renderedUid = null,
    renderedLocked = false,
    renderedView = null;
  const main = document.querySelector("#main");
  const dialog = document.querySelector("#dialog");
  const money = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  const tagMoney = (value) => {
    const [dollars, cents] = money(value).split(".");
    return `<span class="dollars">${dollars}</span><span class="cents">.${cents}</span>`;
  };
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const paths = {
    list: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9zM9 11h6M9 15h6"/>',
    compare: '<path d="M5 20V10m7 10V4m7 16v-7M3 20h18"/>',
    shopping: '<path d="M5 8h14l1 13H4L5 8zM8 8V6a4 4 0 0 1 8 0v2"/>',
    stores:
      '<path d="M3 9l2-6h14l2 6M4 10v11h16V10M9 21v-7h6v7M3 9c0 4 4 4 4 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 4 4 4 0"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    sync: '<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    leaf: '<path d="M5 19C0 6 13 4 21 3c-1 9-3 21-16 16zm0 0L16 8"/>',
    spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z"/>',
  };
  const icon = (name, cls = "") =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.list}</svg>`;
  const names = {
    list: "My List",
    compare: "Compare",
    shopping: "Shopping",
    stores: "Stores",
    account: "Account",
    import: "Reminders import",
  };
  const storeFor = (id) => M.stores.find((s) => s.id === id);
  // Only active stores take part in comparisons; coming-soon stores keep any
  // saved picks in the data but hide them until the store is connected.
  const isActive = (id) => (storeFor(id)?.status || "active") === "active";
  const activeStores = () => M.stores.filter((s) => isActive(s.id));
  const comingSoon = () => M.stores.filter((s) => !isActive(s.id));
  const isOn = (id) => isActive(id) && state.stores.includes(id);
  const enabledStores = () => state.stores.filter(isActive);
  const offerFor = (item) => {
    const o = M.selectedOffer(item);
    // Sample-catalog picks only stand in for stores without live prices.
    return o && isActive(o.storeId) && (o.live || !storeFor(o.storeId)?.live) ? o : null;
  };
  const summarize = (items) => {
    const valid = items.filter((i) => offerFor(i));
    return {
      total: valid.reduce((sum, i) => sum + offerFor(i).price * i.quantity, 0),
      selected: valid.length,
      done: valid.filter((i) => i.done).length,
    };
  };
  // Store logos come from each retailer's site icon; the letter shows if it fails to load.
  const logoUrl = (store) =>
    store?.domain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(store.domain)}&sz=128`
      : "";
  // Green pulsing dot for stores that are live and switched on; grey otherwise.
  const storeStatus = (s) => {
    const active = !!s && isOn(s.id) && s.live && (Retailers?.available?.(s.id) ?? true);
    return `<span class="store-status ${active ? "is-active" : ""}"><span class="status-dot" aria-hidden="true"></span>${active ? "Active" : "Not active"}</span>`;
  };
  const storeBadge = (id) => {
    const store = storeFor(id);
    const logo = logoUrl(store);
    return `<span class="store-mark ${esc(id)}${logo ? " has-logo" : ""}" title="${esc(store?.name || "")}">${esc(store?.short || "?")}${logo ? `<img src="${logo}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('has-logo');this.remove()">` : ""}</span>`;
  };
  // Shows a product photo; once a white-border-trimmed copy is ready it swaps in
  // place without re-rendering the page.
  const swapPhoto = (url) => () => {
    const src = window.ScoutPhotos?.display?.(url);
    for (const img of document.querySelectorAll("img[data-photo]"))
      if (img.dataset.photo === url && src) img.src = src;
  };
  const photo = (url, cls = "product-photo") => {
    const src = url && (window.ScoutPhotos?.display?.(url, swapPhoto(url)) || url);
    return src
      ? `<img class="${cls}" src="${esc(src)}" data-photo="${esc(url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`
      : "";
  };
  const thumb = (o, fallback) =>
    o?.live ? (o.live.image ? photo(o.live.image) : storeBadge(o.storeId)) : o?.emoji || fallback;
  const locationFor = (id) => state.locations?.[id] || null;
  const shopZip = () =>
    areaZip || state.profile?.zip || window.STORE_SCOUT_RETAILERS?.zipCode || "77019";
  const liveStores = () => activeStores().filter((s) => s.live && Retailers?.available?.(s.id));
  const storeWhere = (id) => {
    const store = storeFor(id), loc = locationFor(id);
    if (loc) return `${loc.name}${loc.address ? ` · ${loc.address}` : ""}`;
    if (store?.pricing === "weekly-ad") return "Weekly ad prices · all stores";
    return store?.live ? `Nearest store to ${shopZip()}` : "Sample prices · live prices coming soon";
  };
  function readGuest() {
    try {
      return M.restore(localStorage.getItem(KEY));
    } catch {
      return M.initial();
    }
  }
  function save() {
    if (Account.user()) {
      try {
        Account.save(state);
      } catch {
        notify(
          "Could not save these changes. Visit Account to check your connection.",
        );
      }
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      storageOK = false;
    }
  }
  function notify(message, undo = false) {
    const el = document.querySelector("#toast");
    el.innerHTML = `${esc(message)}${undo ? '<button data-action="undo">Undo</button>' : ""}`;
    el.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => el.classList.remove("show"), 4500);
  }
  function navigate(next) {
    if (!names[next]) next = "list";
    view = next;
    window.location.hash = next;
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function nav() {
    const html = Object.entries(names)
      .filter(([key]) => !["account","import"].includes(key))
      .map(
        ([key, name]) =>
          `<a href="#${key}" class="nav-item ${view === key ? "active" : ""}" ${view === key ? 'aria-current="page"' : ""}>${icon(key)}<span>${name}</span>${key === "list" ? `<span class="nav-count">${state.items.length}</span>` : ""}</a>`,
      )
      .join("");
    document.querySelector("#desktop-nav").innerHTML = html;
    document.querySelector("#mobile-nav").innerHTML = html;
    document.querySelector("#breadcrumb").textContent = names[view];
  }
  const storageLabel = () =>
    Account.user()
      ? Account.label()
      : storageOK
        ? "Guest list saved on this device."
        : "Browser storage unavailable; changes last for this session.";
  function priceNote() {
    const live = activeStores().filter((s) => s.live && s.pricing !== "weekly-ad").map((s) => s.name);
    const ads = activeStores().filter((s) => s.pricing === "weekly-ad").map((s) => s.name);
    const sample = activeStores().filter((s) => !s.live).map((s) => s.name);
    const soon = comingSoon().map((s) => s.name);
    const names = (list) =>
      list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0];
    return [
      live.length ? `${names(live)} prices are live.` : "",
      ads.length ? `${names(ads)} ${ads.length > 1 ? "show" : "shows"} weekly ad prices.` : "",
      sample.length ? `${names(sample)} ${sample.length > 1 ? "show" : "shows"} sample prices.` : "",
      soon.length ? `${names(soon)} ${soon.length > 1 ? "are" : "is"} coming soon.` : "",
    ].filter(Boolean).join(" ");
  }
  const demo = () =>
    `<div class="demo-note">${esc(priceNote())} <span class="cloud-save-status" role="status">${esc(storageLabel())}</span></div>`;
  function heading(title, description, action = "") {
    return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
  }
  // The list page leads with the trip as a shelf tag: what it costs so far and what's left to pick.
  function tripTag(summary, pending) {
    const count = state.items.length;
    const next = state.items.find((i) => !offerFor(i));
    const action = !count
      ? `<button class="button primary" data-action="add-dialog">${icon("plus")} Add your first item</button>`
      : next
        ? `<button class="button primary" data-action="compare-item" data-id="${esc(next.id)}">Pick a product for ${esc(next.name)} ${icon("arrow")}</button>`
        : `<button class="button primary" data-action="navigate" data-view="shopping">Start shopping ${icon("arrow")}</button>`;
    const sub = !count
      ? "Your list is empty."
      : summary.selected
        ? `For ${summary.selected} of ${count} item${count === 1 ? "" : "s"}. ${pending ? `${pending} still need${pending === 1 ? "s" : ""} a product.` : "Everything has a product."}`
        : `Pick a product for each item to see what this trip costs.`;
    return `<section class="trip-tag" aria-label="Trip summary"><span class="tag-hole" aria-hidden="true"></span><div class="tag-main"><p class="tag-label">Estimated total</p><strong class="tag-price">${tagMoney(summary.total)}</strong><p class="tag-sub">${sub}</p></div><div class="tag-side"><div class="tag-progress" role="progressbar" aria-label="Items with a product" aria-valuemin="0" aria-valuemax="${count}" aria-valuenow="${summary.selected}"><span style="width:${count ? (summary.selected / count) * 100 : 0}%"></span></div><ul class="tag-facts"><li><b>${count}</b> on your list</li><li><b>${summary.selected}</b> picked</li><li><b>${enabledStores().length}</b> store${enabledStores().length === 1 ? "" : "s"} compared</li></ul>${action}</div></section>`;
  }
  function listPage() {
    const summary = summarize(state.items),
      pending = state.items.length - summary.selected;
    const visible = state.items.filter(
      (i) =>
        (filter === "all" ||
          (filter === "pending" ? !i.offerId : !!i.offerId)) &&
        i.name.toLowerCase().includes(listQuery.toLowerCase()),
    );
    return (
      heading(
        "Your next shop",
        "Write it like a normal list. Then pick the product and store for each item.",
        `<button class="button primary" data-action="add-dialog">${icon("plus")} Add an item</button>`,
      ) +
      `${tripTag(summary, pending)}
    <div class="list-layout"><section class="list-panel"><div class="section-heading"><div><h2>On the list <span class="count-bubble">${state.items.length}</span></h2></div><div class="section-actions">${state.items.length ? '<button class="text-button clear-list" data-action="clear-list">Clear list</button>' : ""}<button class="icon-button" data-action="add-dialog" aria-label="Add grocery">${icon("plus")}</button></div></div>
    <div class="list-toolbar"><div class="tabs" aria-label="Filter list">${[
      ["all", "All"],
      ["pending", "To pick"],
      ["picked", "Picked"],
    ]
      .map(
        ([id, label]) =>
          `<button data-action="filter" data-filter="${id}" class="${filter === id ? "selected" : ""}" aria-pressed="${filter === id}">${label}</button>`,
      )
      .join(
        "",
      )}</div><label class="list-search">${icon("search")}<input id="list-search" aria-label="Search your list" placeholder="Find on your list" value="${esc(listQuery)}"></label></div>
    <div class="grocery-rows">${visible.map(row).join("") || `<div class="empty">${icon("list")}<h3>${state.items.length ? "Nothing matches" : "Nothing on the list yet"}</h3><p>${state.items.length ? "Try another filter or search." : "Add an item below, or bring your list over from Reminders."}</p><button class="button secondary" data-action="add-dialog">Add an item</button></div>`}</div>
    <form class="quick-add" id="quick-add">${icon("plus")}<input name="grocery" aria-label="Add a grocery item" placeholder="Add an item, like oat milk" maxlength="100" required><button type="submit" aria-label="Add item">${icon("arrow")}</button></form>
    <div class="list-bottom">${icon("clock")} Your product picks are remembered for next time.<button data-action="navigate" data-view="shopping">Go shopping ${icon("arrow")}</button></div></section>
    <aside class="right-rail"><section class="sync-card"><div class="reminders-icon"><span></span><span></span><span></span></div><h2>Keep using Reminders</h2><p>Add groceries with Siri as usual. Store Scout shows you what came in, and nothing joins your list until you approve it.</p><button class="button primary full" data-action="sync">${icon("sync")} Sync Apple Reminders</button></section>
    <section class="next-card"><h3>Stores you compare</h3><p>${enabledStores().length} store${enabledStores().length === 1 ? "" : "s"} near ${esc(shopZip())}.</p><div class="store-pair">${enabledStores().map(storeBadge).join("")}<span>${esc(enabledStores().map((id) => locationFor(id)?.name || storeFor(id)?.name).join(" & ") || "No stores enabled")}</span></div><button data-action="navigate" data-view="stores">Change stores ${icon("arrow")}</button></section></aside></div>${demo()}`
    );
  }
  function row(item) {
    const o = offerFor(item);
    const glyph = thumb(
      o,
      { basil: "🌿", "sourdough bread": "🍞", "chicken breast": "🍗" }[
        item.name.toLowerCase()
      ] || "🛒",
    );
    return `<article class="grocery-row ${item.done ? "is-done" : ""}"><span class="food-thumb ${o?.department || "produce"}">${glyph}</span><div class="grocery-detail"><h3>${esc(item.name)}</h3><p>${o ? `${esc(o.brand)} <span>·</span> ${esc(o.size)}` : M.intent(item.name).needsForm ? "Fresh or dried? Pick one to compare." : "No product picked yet."}</p>${o ? `<span class="inline-store">${storeBadge(o.storeId)} ${esc(storeFor(o.storeId).name)}${!state.stores.includes(o.storeId) ? " · disabled for comparison" : ""}</span>` : '<span class="needs-label">To pick</span>'}</div><div class="quantity" aria-label="Quantity"><button data-action="quantity" data-id="${esc(item.id)}" data-delta="-1" aria-label="Decrease ${esc(item.name)} quantity" ${item.quantity <= 1 ? "disabled" : ""}>−</button><span>${item.quantity}</span><button data-action="quantity" data-id="${esc(item.id)}" data-delta="1" aria-label="Increase ${esc(item.name)} quantity" ${item.quantity >= 99 ? "disabled" : ""}>+</button></div><div class="row-action">${o ? `<strong>${money(o.price * item.quantity)}</strong><button class="text-button" data-action="compare-item" data-id="${esc(item.id)}">Change ${icon("arrow")}</button>` : `<button class="button pick-button" data-action="compare-item" data-id="${esc(item.id)}">Pick product ${icon("arrow")}</button>`}</div><button class="remove-button" data-action="remove" data-id="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">${icon("close")}</button></article>`;
  }
  function comparePage() {
    const active = state.items.find((i) => i.id === activeId);
    const query = compareQuery || active?.name || "";
    const needsForm = M.intent(active?.name || query).needsForm;
    const offers = M.sortOffers(
      (query
        ? M.matchOffers(query, enabledStores())
        : M.catalog.filter((o) => isOn(o.storeId))
      ).filter((o) => !active || M.canSelect(active.name, o.id)),
      compareSort,
    );
    const selected = active && offerFor(active),
      current = offers.filter((o) => o.id === selected?.id),
      alternatives = offers.filter((o) => o.id !== selected?.id);
    return (
      heading(
        "Compare prices",
        "Search once and see what each of your stores charges.",
      ) +
      `<div class="compare-search-card"><form id="compare-form" class="compare-form"><label>${icon("search")}<input name="query" aria-label="Search products" placeholder="Search eggs, fresh basil, milk…" value="${esc(query)}" maxlength="100"></label><button class="button primary" type="submit">Find products ${icon("arrow")}</button></form><div class="compare-controls"><div class="store-filters">${activeStores().map((s) => `<button class="store-chip ${isOn(s.id) ? "on" : ""}" data-action="toggle-store" data-store="${s.id}" aria-pressed="${isOn(s.id)}">${storeBadge(s.id)} ${s.name}${isOn(s.id) ? icon("check") : ""}</button>`).join("")}</div><label class="sort-label">Sort by <select id="sort" aria-label="Sort products">${[["price", "Price: low to high"], ["price-desc", "Price: high to low"], ["unit", "Unit price: low to high"], ["name", "Name: A to Z"]].map(([value, label]) => `<option value="${value}" ${compareSort === value ? "selected" : ""}>${label}</option>`).join("")}</select></label></div></div>
    ${active ? `<div class="active-request">${icon("list")} Picking for <strong>${esc(active.name)}</strong><span>· ${active.quantity} package${active.quantity > 1 ? "s" : ""}</span><button data-action="clear-active">Search whole catalog ${icon("close")}</button></div>` : ""}
    ${liveSection(active)}
    ${
      !activeStores().some((st) => !st.live)
        ? liveStatus
          ? ""
          : `<div class="empty wide">${icon("search")}<h3>${enabledStores().length ? "Search for a product to see live prices." : "Turn on a store to start comparing."}</h3><p>${enabledStores().length ? `Results come from ${esc(enabledStores().map((id) => locationFor(id)?.name || storeFor(id).name).join(", ").replace(/\.$/, ""))}.` : "Choose your stores in the Stores tab."}</p>${enabledStores().length ? "" : `<button class="button secondary" data-action="navigate" data-view="stores">Choose stores ${icon("arrow")}</button>`}</div>`
        : needsForm
        ? `<section class="clarify-card"><span class="big-emoji">🌿</span><div><h2>Fresh or dried basil?</h2><p>They're different products at different prices, so Store Scout compares them separately.</p><div class="inline-actions"><button class="button primary" data-action="clarify" data-query="Fresh basil">Fresh basil</button><button class="button secondary" data-action="clarify" data-query="Dried basil">Dried basil</button></div></div></section>`
        : `<div class="results-heading"><h2>${query ? `Relevant options for “${esc(query)}”` : "Find your next favorite"} <span class="count-bubble">${offers.length}</span></h2><span>In-store · sample offers</span></div>${current.length ? `<h3 class="match-group-heading">Your selected product</h3><div class="product-grid">${current.map((o) => productCard(o, active)).join("")}</div><h3 class="match-group-heading">Other relevant options · alternatives</h3>` : ""}<div class="product-grid">${alternatives.map((o) => productCard(o, active)).join("") || (current.length ? '<p class="no-alternatives">No other relevant sample products for this search.</p>' : `<div class="empty wide">${icon("search")}<h3>No matching sample products</h3><p>${!state.stores.length ? "Enable a store to see its sample products." : active ? `You are still choosing for ${esc(active.name)}. Search the whole catalog to find a different grocery and add it separately.` : "This sample catalog is limited. Try eggs, milk, fresh basil, avocados, or chicken."}</p><button class="button secondary" data-action="${active ? "clear-active" : "clear-query"}">${active ? "Search whole catalog" : "Browse sample catalog"}</button></div>`)}</div>`
    }
    <div class="compare-explainer">${icon("spark")}<div><strong>How matching works</strong><p>A different brand is shown as an alternative, never as the same product. Offers will be grouped once stores share a verified product ID. Unit-price sorting only compares matching units, like per ounce with per ounce.</p></div></div>${demo()}`
    );
  }
  function liveCard(p, active) {
    const selected = active?.offerId === p.id;
    const promo = p.regularPrice && p.regularPrice > p.price;
    const unit = M.unitPrice(p);
    return `<article class="${selected ? "live-selected" : ""}${p.image ? " has-photo" : ""}">${p.image ? `<div class="live-photo-frame">${photo(p.image, "live-photo")}</div>` : ""}<div class="live-info"><strong>${esc(p.name)}</strong><span class="live-store">${storeBadge(p.retailer)} ${esc(p.brand || storeFor(p.retailer)?.name || "")} · ${esc(p.size || "size unavailable")}</span><small>${p.deal ? `<span class="deal-tag">${esc(p.deal)}</span> ` : ""}${p.note ? esc(p.note) : `${promo ? "On sale · " : ""}${p.available === true ? "Fulfillment offered · shelf stock unverified" : "Shelf stock unverified"} · fetched ${esc(new Date(p.fetchedAt).toLocaleTimeString())}`}</small></div><div class="live-buy"><b>${tagMoney(p.price)}${p.size === "per lb" ? "<i>/lb</i>" : ""}${promo ? ` <s>${money(p.regularPrice)}</s>` : ""}${unit ? `<em>${money(unit.value)} / ${esc(unit.unit)}</em>` : ""}</b><button class="button ${selected ? "secondary" : "primary"}" data-action="select-live" data-live="${esc(p.id)}">${icon(selected ? "check" : "plus")} ${selected ? "Selected" : active ? "Choose" : "Add to list"}</button></div></article>`;
  }
  function liveSection(active) {
    if (!liveStatus || !liveStores().some((s) => isOn(s.id))) return "";
    const enabled = liveProducts.filter((p) => isOn(p.retailer));
    const brands = [...new Set(enabled.map((p) => p.brand).filter(Boolean))].sort();
    const shown = M.sortLive(
      enabled.filter(
        (p) =>
          (!liveBrand || p.brand === liveBrand) &&
          (!liveSaleOnly || (p.regularPrice && p.regularPrice > p.price)),
      ),
      compareSort,
    );
    const where = liveStores()
      .filter((s) => isOn(s.id))
      .map((s) => `${s.name}: ${storeWhere(s.id)}`)
      .join(" · ");
    const filters = enabled.length
      ? `<div class="live-filters"><label>Brand <select id="live-brand" aria-label="Filter by brand"><option value="">All brands (${enabled.length})</option>${brands.map((b) => `<option value="${esc(b)}" ${liveBrand === b ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></label><label class="live-sale"><input type="checkbox" id="live-sale" ${liveSaleOnly ? "checked" : ""}> On sale only</label><button class="text-button" data-action="navigate" data-view="stores">Change store ${icon("arrow")}</button></div>`
      : "";
    const notes = liveNotes.length && enabled.length ? `<ul class="live-notes">${liveNotes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "";
    // Best matches (the product *is* what was searched) come first; products
    // that only mention the word ("Egg Noodles" for eggs) wait under Related.
    const best = shown.filter((p) => M.relevance(liveTerm, p) === 2);
    const related = best.length ? shown.filter((p) => M.relevance(liveTerm, p) !== 2) : [];
    const main = best.length ? best : shown;
    const grid = (list) => `<div class="live-results">${list.map((p) => liveCard(p, active)).join("")}</div>`;
    const relatedBlock = related.length
      ? `<div class="related-toggle"><button class="text-button" data-action="toggle-related" aria-expanded="${liveShowRelated}">${liveShowRelated ? "Hide" : "Show"} ${related.length} related item${related.length === 1 ? "" : "s"} ${icon("arrow")}</button><span>Products that mention “${esc(liveTerm)}” but aren’t ${esc(liveTerm)}</span></div>${liveShowRelated ? grid(related) : ""}`
      : "";
    return `<section class="live-panel"><div class="results-heading"><h2>${esc(liveStatus)} ${enabled.length ? `<span class="count-bubble">${main.length}</span>` : ""}</h2><span>${esc(where)}</span></div>${notes}${filters}${main.length ? grid(main) + relatedBlock : enabled.length ? '<p class="no-alternatives">No live products match these filters.</p>' : ""}</section>`;
  }
  let liveRun = 0;
  async function attachPhotos(run) {
    if (!window.ScoutPhotos || !liveProducts.length) return;
    try {
      const photos = await window.ScoutPhotos.lookup(liveProducts);
      if (run !== liveRun || !photos.size) return;
      liveProducts = liveProducts.map((p) => (photos.has(p.id) ? { ...p, image: photos.get(p.id) } : p));
      render();
    } catch {}
  }
  async function loadLiveProducts(query) {
    const term = String(query || "").trim();
    const targets = liveStores().filter((s) => isOn(s.id));
    liveBrand = "";
    liveSaleOnly = false;
    liveNotes = [];
    liveShowRelated = false;
    liveTerm = term;
    if (!targets.length || term.length < 2) {
      liveProducts = [];
      liveStatus = "";
      return;
    }
    const run = ++liveRun;
    const current = () => run === liveRun;
    const names = targets.map((s) => s.name).join(" & ");
    liveStatus = `Looking up current ${names} prices…`;
    liveProducts = [];
    render();
    const results = await Promise.allSettled(
      targets.map((store) =>
        Retailers.search(
          store.id,
          term,
          { locationId: locationFor(store.id)?.id, zip: shopZip() },
          (product) => {
            if (!current()) return;
            liveProducts.push({ ...product, retailer: product.retailer || store.id });
            liveStatus = `Live results for “${term}”`;
            render();
          },
          (message) => {
            if (!current() || liveProducts.length) return;
            liveStatus = message;
            render();
          },
        ),
      ),
    );
    if (!current()) return;
    void attachPhotos(run);
    // Weekly ads only list sale items, so say so instead of showing nothing.
    const adMisses = targets.filter(
      (s, n) => s.pricing === "weekly-ad" && results[n].status === "fulfilled" && !liveProducts.some((p) => p.retailer === s.id),
    );
    liveNotes = adMisses.map((s) => `${s.name}: no “${term}” in this week’s ad. Weekly ads only list items on sale.`);
    if (!liveProducts.length)
      liveStatus = results.some((r) => r.status === "rejected")
        ? `Live ${names} prices are temporarily unavailable.`
        : adMisses.length === targets.length
          ? `No “${term}” in this week’s ${names} ad.`
          : `${names} returned no products for this search.`;
    render();
  }
  function productCard(o, active) {
    const selected = active?.offerId === o.id;
    return `<article class="product-card ${selected ? "product-selected" : ""}"><div class="product-art ${o.department}"><span>${o.emoji}</span><span class="product-type">${o.category === "fresh basil" ? "FRESH HERB" : o.category === "dried basil" ? "DRIED SPICE" : "SAMPLE PRODUCT"}</span>${selected ? `<span class="selected-badge">${icon("check")} Your pick</span>` : ""}</div><div class="product-body"><span class="product-brand">${esc(o.brand)}</span><h3>${esc(o.name)}</h3><p class="product-size">${esc(o.size)} <span>·</span> ${selected ? "Your selected product" : active && offerFor(active) ? "Alternative to your selected product" : active ? "Relevant sample option" : "Sample product"}</p><div class="product-price"><strong>${money(o.price)}</strong><span>${money(o.price / o.amount)} / ${o.unit}</span></div><div class="product-store">${storeBadge(o.storeId)}<span>${esc(storeFor(o.storeId).label)}<small>Sample price</small></span></div><div class="stock ${o.available === true ? "available" : ""}"><i></i>${o.available === true ? "Sample: in stock" : o.available === false ? "Sample: unavailable" : "Availability unknown"}</div>${o.promotion ? `<p class="promo">${esc(o.promotion)}</p>` : ""}<button class="button ${selected ? "secondary" : "primary"} full" data-action="select-offer" data-offer="${o.id}" ${o.available === false ? "disabled" : ""}>${icon(selected ? "check" : "plus")} ${selected ? "Selected" : active ? "Choose this product" : "Add to my list"}</button></div></article>`;
  }
  function shoppingPage() {
    const sum = summarize(state.items),
      pending = state.items.filter((i) => !offerFor(i)),
      selected = state.items.filter((i) => offerFor(i));
    return (
      heading(
        "Shopping trip",
        "Your picks, grouped by store. Check items off as they go in the cart.",
        `<button class="button secondary" data-action="navigate" data-view="list">${icon("list")} Back to my list</button>`,
      ) +
      `<section class="shopping-summary"><span class="stat-icon mint">${icon("shopping")}</span><div><h2>${sum.done === sum.selected && sum.selected ? (pending.length ? "Every pick is in the cart." : "Everything is in the cart.") : "Trip progress"}</h2><p>${sum.selected ? `${sum.done} of ${sum.selected} item${sum.selected === 1 ? "" : "s"} in the cart` : "No products picked yet"}${pending.length ? ` · ${pending.length} still need${pending.length === 1 ? "s" : ""} a product` : ""}</p></div><strong>${tagMoney(sum.total)}<small>estimated total</small></strong><div class="progress-track"><span style="width:${sum.selected ? (sum.done / sum.selected) * 100 : 0}%"></span></div></section>
    <div class="shopping-columns">${
      activeStores()
        .map((s) => {
          const items = selected.filter((i) => offerFor(i).storeId === s.id);
          if (!items.length) return "";
          return `<section class="shopping-store"><div class="shopping-store-head">${storeBadge(s.id)}<div><h2>${s.name}</h2><p>${esc(storeWhere(s.id))}</p></div><strong>${money(summarize(items).total)}</strong></div>${!state.stores.includes(s.id) ? '<div class="store-warning">Disabled for comparisons. Your existing picks are kept here.</div>' : ""}<div class="shopping-items">${items
            .map((i) => {
              const o = offerFor(i);
              return `<label class="shopping-item ${i.done ? "completed" : ""}"><input type="checkbox" data-check-id="${esc(i.id)}" ${i.done ? "checked" : ""}><span class="shopping-food">${thumb(o, "🛒")}</span><span><strong>${esc(i.name)}</strong><small>${esc(o.brand)} · ${esc(o.size)} · Qty ${i.quantity}</small></span><b>${money(o.price * i.quantity)}</b></label>`;
            })
            .join(
              "",
            )}</div><div class="store-completion">${items.filter((i) => i.done).length} of ${items.length} in the cart <span>In-store shopping</span></div></section>`;
        })
        .join("") ||
      '<div class="empty wide"><h3>Nothing to shop for yet</h3><p>Pick a product for an item and it shows up here, under the store that sells it.</p><button class="button primary" data-action="navigate" data-view="compare">Pick products</button></div>'
    }</div>
    ${pending.length ? `<section class="pending-panel"><span class="stat-icon peach">${icon("list")}</span><div><h3>Still needs a product</h3><p>${pending.map((i) => esc(i.name)).join(" · ")}</p></div><button class="button secondary" data-action="compare-item" data-id="${esc(pending[0].id)}">Finish picking ${icon("arrow")}</button></section>` : ""}${demo()}`
    );
  }
  function locationList(store) {
    const results = locationResults[store.id];
    if (!results) return "";
    if (!results.length) return '<p class="location-empty">No stores found near that ZIP code.</p>';
    const chosen = locationFor(store.id)?.id;
    return `<ul class="location-list">${results
      .map(
        (loc) =>
          `<li class="${chosen === loc.id ? "chosen" : ""}"><span><strong>${esc(loc.name)}</strong><small>${esc(loc.address || "Address unavailable")}${Number.isFinite(loc.distanceMiles) ? ` · ${loc.distanceMiles.toFixed(1)} mi` : ""}</small></span><button class="button ${chosen === loc.id ? "secondary" : "primary"}" data-action="choose-location" data-store="${esc(store.id)}" data-location="${esc(loc.id)}" ${chosen === loc.id ? "disabled" : ""}>${chosen === loc.id ? `${icon("check")} Your store` : "Choose"}</button></li>`,
      )
      .join("")}</ul>`;
  }
  function storeCard(s) {
    const on = isOn(s.id);
    const live = s.live && Retailers?.available?.(s.id);
    const loc = locationFor(s.id);
    const samples = M.catalog.filter((o) => o.storeId === s.id).length;
    const where = loc
      ? `<strong>${esc(loc.name)}</strong><small>${esc(loc.address || `Store ${loc.id}`)}</small>`
      : live
        ? `<strong>No store chosen</strong><small>Using the nearest store to ${esc(shopZip())}</small>`
        : "<strong>Location search coming soon</strong><small>Available once live prices are connected</small>";
    return `<article class="store-card"><div class="store-visual ${esc(s.id)}">${storeBadge(s.id)}</div><div class="store-card-body"><div class="store-name-line"><h2>${esc(s.name)}</h2>${storeStatus(s)}<button class="toggle ${on ? "enabled" : ""}" role="switch" aria-checked="${on}" aria-label="Include ${esc(s.name)} in comparisons" data-action="toggle-store" data-store="${esc(s.id)}"><span></span></button></div><div class="store-location">${icon("pin")}<span>${where}${loc ? `<button class="text-button use-nearest" data-action="clear-location" data-store="${esc(s.id)}">Use nearest</button>` : ""}</span></div><div class="store-facts"><span>${icon("spark")} ${s.pricing === "weekly-ad" ? "Weekly ad prices" : live ? "Live prices" : "Sample prices"}</span><span>${s.pricing === "weekly-ad" ? "Updated each week" : live ? "Official retailer API" : `${samples} sample products`}</span></div>${s.family?.length ? `<p class="store-family">Also covers ${esc(s.family.join(", "))}</p>` : ""}${live && locationResults[s.id] ? `<div class="nearby-stores"><p class="nearby-label">Nearby stores</p>${locationList(s)}</div>` : ""}<button class="button secondary full" data-action="browse-store" data-store="${esc(s.id)}">${live ? "Search products" : "Browse sample products"} ${icon("arrow")}</button></div></article>`;
  }
  function storesPage() {
    const searchable = liveStores();
    const intro = searchable.length
      ? `Search by ZIP code to choose your ${esc(searchable.map((st) => st.name).join(", "))} location.`
      : "Location search will appear when a store has live prices.";
    const form = searchable.length
      ? `<form id="location-form" class="location-form"><input name="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" required aria-label="ZIP code" value="${esc(shopZip())}"><button class="button primary" type="submit">${icon("search")} Find stores</button></form>`
      : "";
    return (
      heading(
        "Your stores",
        "Choose which stores to compare and the exact location for each one.",
      ) +
      `<section class="area-card"><span class="area-icon">${icon("pin")}</span><div><h2>Shopping near <span>${esc(shopZip())}</span></h2><p>${intro}</p></div>${form}</section>${locationStatus ? `<p class="location-status" role="status">${esc(locationStatus)}</p>` : ""}<div class="results-heading"><h2>Stores you compare <span class="count-bubble">${enabledStores().length} on</span></h2><span>Switch a store off to leave it out of comparisons</span></div><div class="stores-grid">${activeStores().map(storeCard).join("")}</div>${comingSoon().length ? `<div class="results-heading"><h2>Coming soon <span class="count-bubble">${comingSoon().length}</span></h2><span>Not connected yet</span></div><div class="soon-grid">${comingSoon().map((st) => `<article class="soon-card">${storeBadge(st.id)}<div><h3>${esc(st.name)}</h3>${storeStatus(st)}<p>Waiting on an official source for live prices and store locations.</p></div></article>`).join("")}</div>` : ""}<section class="future-card">${icon("leaf")}<div><h3>More stores on the way</h3><p>A store is added once an official source for its real prices and locations is connected.</p></div></section>${demo()}`
    );
  }
  async function findLocations(zip) {
    if (!/^\d{5}$/.test(zip)) {
      locationStatus = "Enter a five-digit ZIP code.";
      render();
      return;
    }
    areaZip = zip;
    locationStatus = `Looking for stores near ${zip}…`;
    locationResults = {};
    render();
    const stores = liveStores();
    const results = await Promise.allSettled(stores.map((st) => Retailers.locations(st.id, zip)));
    if (areaZip !== zip) return;
    results.forEach((r, n) => {
      if (r.status === "fulfilled") locationResults[stores[n].id] = r.value;
    });
    const failed = results.filter((r) => r.status === "rejected").length;
    const found = Object.values(locationResults).reduce((sum, list) => sum + list.length, 0);
    locationStatus = failed
      ? "Some store locations could not be loaded. Try again shortly."
      : `${found} store${found === 1 ? "" : "s"} found near ${zip}. Choose one for each retailer.`;
    render();
  }
  function render() {
    nav();
    main.innerHTML =
      view === "account" || Account.locked()
        ? Account.render()
        : {
            list: listPage,
            compare: comparePage,
            shopping: shoppingPage,
            stores: storesPage,
            import: ()=>window.ScoutImportUI.render(),
          }[view]();
    const entering = view !== renderedView;
    renderedView = view;
    main.classList?.remove("view-enter");
    if (entering && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      void main.offsetWidth;
      main.classList?.add("view-enter");
    }
    document.querySelector("#location-icon").innerHTML = icon("pin");
    const enabled = activeStores().filter((st) => isOn(st.id));
    const label = document.querySelector("#location-label");
    if (label) label.textContent = `Near ${shopZip()}`;
    const sidebar = document.querySelector("#sidebar-stores");
    if (sidebar)
      sidebar.innerHTML = enabled.length
        ? `<ul class="sidebar-store-list">${enabled
            .map((st) => {
              const place = (locationFor(st.id)?.name || "").replace(new RegExp(`^${st.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-\\s*`, "i"), "");
              return `<li>${storeStatus(st)}<span><strong>${esc(st.name)}</strong>${place ? `<small>${esc(place)}</small>` : ""}</span></li>`;
            })
            .join("")}</ul>`
        : "No stores enabled";
    updateAccountChrome();
    renderedUid = Account.user()?.uid || null;
    renderedLocked = Account.locked();
  }
  function updateAccountChrome() {
    document.querySelector(".account-button").textContent = Account.user()
      ? "Account"
      : "Sign in";
    document.querySelector("#workspace-label").textContent = Account.user()
      ? state.profile?.name || "Your account"
      : "Guest workspace";
    document.querySelector("#workspace-status").textContent = Account.label();
    document
      .querySelectorAll(".cloud-save-status")
      .forEach((el) => (el.textContent = storageLabel()));
  }
  function openDialog(content) {
    document.querySelector("#dialog-content").innerHTML =
      `<button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close dialog">${icon("close")}</button>${content}`;
    dialog.showModal();
  }
  function addItem(name) {
    name = name.trim();
    if (!name) return;
    if (state.items.length >= 200) {
      notify("This pilot supports up to 200 grocery items per list.");
      return;
    }
    const preferred = state.preferences[M.normalize(name)];
    const known = M.catalog.find(
      (o) =>
        o.id === preferred &&
        M.canSelect(name, o.id) &&
        isOn(o.storeId) &&
        o.available !== false,
    );
    state.items.push({
      id: crypto.randomUUID(),
      name: name.slice(0, 100),
      quantity: 1,
      offerId: known?.id || null,
      done: false,
    });
    save();
    dialog.close();
    filter = "all";
    listQuery = "";
    render();
    notify(
      known ? "Added with your remembered product." : "Added to your list.",
    );
  }
  document.addEventListener("submit", (event) => {
    if (event.target.id === "location-form") {
      event.preventDefault();
      void findLocations(String(new FormData(event.target).get("zip") || "").trim());
      return;
    }
    if (["quick-add", "add-form", "compare-form"].includes(event.target.id)) {
      event.preventDefault();
      const data = new FormData(event.target);
      if (event.target.id === "compare-form") {
        compareQuery = String(data.get("query")).trim();
        // A search that no longer names the item being picked (milk → peanuts)
        // is a new search, so its results add to the list instead.
        const picking = state.items.find((i) => i.id === activeId);
        if (picking && compareQuery && !M.fitsItem(picking.name, { name: compareQuery })) {
          activeId = null;
          notify(`Searching “${compareQuery}” on its own. ${picking.name} still needs a product.`);
        }
        liveProducts = [];
        liveStatus = "";
        render();
        void loadLiveProducts(compareQuery);
      } else addItem(String(data.get("grocery")));
    }
  });
  document.addEventListener("input", (event) => {
    if (event.target.id === "list-search") {
      const start = event.target.selectionStart;
      listQuery = event.target.value;
      render();
      const input = document.querySelector("#list-search");
      input.focus();
      input.setSelectionRange(start, start);
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "live-brand") {
      liveBrand = event.target.value;
      render();
    }
    if (event.target.id === "live-sale") {
      liveSaleOnly = event.target.checked;
      render();
    }
    if (event.target.id === "sort") {
      compareSort = event.target.value;
      render();
    }
    if (event.target.dataset.checkId) {
      const item = state.items.find(
        (i) => i.id === event.target.dataset.checkId,
      );
      if (item) {
        item.done = event.target.checked;
        save();
        render();
      }
    }
  });
  document.addEventListener("click", (event) => {
    const navLink = event.target.closest('a[href^="#"]');
    if (navLink && names[navLink.hash.slice(1)]) {
      event.preventDefault();
      navigate(navLink.hash.slice(1));
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action,
      id = button.dataset.id,
      item = state.items.find((i) => i.id === id);
    if (action === "navigate") navigate(button.dataset.view);
    if (action === "add-dialog")
      openDialog(
        `<span class="dialog-symbol">${icon("plus")}</span><h2 id="dialog-title">Add an item</h2><p>Write it the way you would on a list. You'll pick the exact product next.</p><form id="add-form"><label class="field-label" for="new-item">Item</label><input class="dialog-input" id="new-item" name="grocery" placeholder="e.g. fresh basil" maxlength="100" required autofocus><button class="button primary full" type="submit">Add to list ${icon("plus")}</button></form>`,
      );
    if (action === "close-dialog") dialog.close();
    if (action === "sync") navigate("import");
    if (action === "about")
      openDialog(
        `<span class="dialog-symbol">✳</span><h2 id="dialog-title">A little smarter, together.</h2><p>This is Store Scout’s first interactive GUI. Use a local guest list or sign in to save a private list across devices.</p><div class="dialog-note">${esc(priceNote())} Live prices come from official retailer APIs; shelf prices and stock can differ. Accounts and private cloud lists are connected.</div><button class="button primary full" data-action="close-dialog">Back to my list</button>`,
      );
    if (action === "filter") {
      filter = button.dataset.filter;
      render();
    }
    if (action === "quantity" && item) {
      item.quantity = Math.min(
        99,
        Math.max(1, item.quantity + Number(button.dataset.delta)),
      );
      save();
      render();
    }
    if (action === "remove" && item) {
      removed = { item, index: state.items.indexOf(item) };
      state.items = state.items.filter((i) => i.id !== id);
      save();
      render();
      notify(`${item.name} removed.`, true);
    }
    if (action === "clear-list" && state.items.length) {
      removed = { items: state.items };
      state.items = [];
      activeId = null;
      save();
      render();
      notify("List cleared.", true);
    }
    if (action === "undo" && removed?.items) {
      state.items = [...removed.items, ...state.items].slice(0, 200);
      removed = null;
      save();
      render();
      notify("List restored.");
    }
    if (action === "undo" && removed) {
      state.items.splice(removed.index, 0, removed.item);
      removed = null;
      save();
      render();
      notify("Item restored.");
    }
    if (action === "compare-item" && item) {
      activeId = id;
      compareQuery = item.name;
      navigate("compare");
      void loadLiveProducts(item.name);
    }
    if (action === "clarify") {
      compareQuery = button.dataset.query;
      const active = state.items.find((i) => i.id === activeId);
      if (active && M.intent(active.name).needsForm) {
        active.name = compareQuery;
        active.offerId = null;
        active.done = false;
        save();
      }
      render();
      void loadLiveProducts(compareQuery);
    }
    if (action === "clear-active") {
      const search = document.querySelector('#compare-form input[name="query"]');
      compareQuery = search?.value?.trim() || compareQuery;
      activeId = null;
      render();
    }
    if (action === "clear-query") {
      compareQuery = "";
      if (activeId) activeId = null;
      render();
    }
    if (action === "toggle-store") {
      const sid = button.dataset.store;
      if (!isActive(sid)) return;
      if (storeFor(sid)?.live) liveRun++;
      state.stores = state.stores.includes(sid)
        ? state.stores.filter((s) => s !== sid)
        : [...state.stores, sid];
      save();
      render();
    }
    if (action === "browse-store") {
      state.stores = [button.dataset.store];
      save();
      compareQuery = "";
      activeId = null;
      navigate("compare");
      notify(storeFor(button.dataset.store)?.live ? `Search for a product to see live ${storeFor(button.dataset.store).name} prices.` : `Showing ${storeFor(button.dataset.store).name} sample products. Re-enable other stores to compare.`);
    }
    if (action === "select-offer") {
      const offer = M.catalog.find((o) => o.id === button.dataset.offer);
      if (
        !offer ||
        offer.available === false ||
        !isOn(offer.storeId)
      )
        return;
      const active = state.items.find((i) => i.id === activeId);
      if (active && !M.canSelect(active.name, offer.id)) {
        notify(
          "That product does not fit this grocery. Browse the catalog to add it separately.",
        );
        return;
      }
      if (active) {
        active.offerId = offer.id;
        delete active.live;
        active.done = false;
        state.preferences[M.normalize(active.name)] = offer.id;
        notify(`Product selected for ${active.name.toLowerCase()}.`);
      } else {
        if (state.items.length >= 200) {
          notify("This pilot supports up to 200 grocery items per list.");
          return;
        }
        const groceryName = M.canSelect(offer.name, offer.id)
          ? offer.name
          : offer.category;
        state.items.push({
          id: crypto.randomUUID(),
          name: groceryName,
          quantity: 1,
          offerId: offer.id,
          done: false,
        });
        state.preferences[M.normalize(groceryName)] = offer.id;
        notify("Product added to your list.");
      }
      save();
      render();
    }
    if (action === "choose-location") {
      const sid = button.dataset.store;
      const loc = (locationResults[sid] || []).find((l) => l.id === button.dataset.location);
      if (!loc) return;
      state.locations = M.cleanLocations({ ...state.locations, [sid]: loc });
      liveRun++;
      liveProducts = [];
      liveStatus = "";
      save();
      notify(`${storeFor(sid).name} store set to ${loc.name}.`);
      render();
    }
    if (action === "clear-location") {
      const sid = button.dataset.store;
      const next = { ...state.locations };
      delete next[sid];
      state.locations = next;
      liveRun++;
      liveProducts = [];
      liveStatus = "";
      save();
      notify(`${storeFor(sid).name} will use the nearest store.`);
      render();
    }
    if (action === "toggle-related") {
      liveShowRelated = !liveShowRelated;
      render();
    }
    if (action === "select-live") {
      const product = liveProducts.find((p) => p.id === button.dataset.live);
      const live = product && M.cleanLive(product);
      if (!live || !isOn(live.retailer)) return;
      const active = state.items.find((i) => i.id === activeId);
      if (active && !M.fitsItem(active.name, live)) {
        notify(`That isn't a match for ${active.name.toLowerCase()}. Search for ${active.name.toLowerCase()} to pick it.`);
        return;
      }
      if (active) {
        active.offerId = live.id;
        active.live = live;
        active.done = false;
        notify(`${storeFor(live.retailer).name} product selected for ${active.name.toLowerCase()}.`);
      } else {
        if (state.items.length >= 200) {
          notify("This pilot supports up to 200 grocery items per list.");
          return;
        }
        state.items.push({
          id: crypto.randomUUID(),
          name: live.name.slice(0, 100),
          quantity: 1,
          offerId: live.id,
          live,
          done: false,
        });
        notify(`${storeFor(live.retailer).name} product added to your list.`);
      }
      save();
      render();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  });
  let importOwner=null;
  window.ScoutImportUI?.init({getState:()=>state,getUser:()=>Account.user(),isReady:()=>Account.ready(),apply:(next,base)=>Account.importState(next,base),changed:()=>{if(view==='import')render();},navigate});
  window.addEventListener("hashchange", () => {
  view = names[location.hash.slice(1)] ? location.hash.slice(1) : "list";
    render();
  });
  view = names[location.hash.slice(1)] ? location.hash.slice(1) : "list";
  render();
  void Account.init({
    getState: () => state,
    getGuest: readGuest,
    onState: (next) => {
      const owner=Account.user()?.uid||null;
      if(owner!==importOwner){window.ScoutImportUI?.reset();importOwner=owner;}
      state = next;
      window.ScoutTheme?.apply(Account.user() ? { ...next.profile, ...Account.appearance?.() } : null);
      activeId = null;
      removed = null;
      compareQuery = "";
      listQuery = "";
      filter = "all";
      clearTimeout(notify.timer);
      const toast = document.querySelector("#toast");
      toast.classList.remove("show");
      toast.textContent = "";
    },
    onStatus: () => {
      if (
        view === "account" ||
        Account.locked() ||
        renderedUid !== (Account.user()?.uid || null) ||
        renderedLocked !== Account.locked()
      )
        render();
      else updateAccountChrome();
    },
    navigate,
    confirmReload: (reload, download) => {
      openDialog(
        '<h2 id="dialog-title">Keep a copy before reloading.</h2><p>Loading the cloud copy replaces the unsaved list currently in this tab. Download your current list first if you want to keep those edits.</p><div class="account-actions"><button class="button secondary" id="export-before-reload">Download current list</button><button class="button primary" id="confirm-cloud-reload">Load cloud copy</button></div>',
      );
      document
        .querySelector("#export-before-reload")
        .addEventListener("click", download);
      document
        .querySelector("#confirm-cloud-reload")
        .addEventListener("click", () => {
          dialog.close();
          reload();
        });
    },
    confirmSignout: (logout, download) => {
      openDialog(
        '<h2 id="dialog-title">Some changes are not saved.</h2><p>Download a copy before signing out if you want to keep your unsaved edits. Signing out will clear them from this tab.</p><div class="account-actions"><button class="button secondary" id="export-before-signout">Download current list</button><button class="button primary" id="confirm-signout">Discard unsaved edits and sign out</button></div>',
      );
      document
        .querySelector("#export-before-signout")
        .addEventListener("click", download);
      document
        .querySelector("#confirm-signout")
        .addEventListener("click", () => {
          dialog.close();
          logout();
        });
    },
  });
})();
