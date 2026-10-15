(function (root) {
  "use strict";
  const config = root.STORE_SCOUT_RETAILERS || {};
  // Retailers with a Worker adapter at /retailers/<id>/products and /locations.
  const adapters = Array.isArray(config.adapters) ? config.adapters : ["kroger"];
  // Retailers served from a JSON file built by a scraper (see scrapers/).
  const feeds = config.feeds && typeof config.feeds === "object" ? config.feeds : {};
  const base = () => String(config.workerUrl || "").replace(/\/$/, "");
  const available = (retailer) =>
    !!config.enabled &&
    ((!!config.workerUrl && adapters.includes(retailer)) || typeof feeds[retailer] === "string");

  async function getJson(path, params) {
    const response = await fetch(`${base()}${path}?${new URLSearchParams(params)}`);
    if (!response.ok) throw new Error("Live retailer request failed.");
    return response.json();
  }

  // ---- Static weekly-ad feeds ----
  const feedCache = new Map();
  function loadFeed(retailer) {
    if (!feedCache.has(retailer))
      feedCache.set(
        retailer,
        fetch(feeds[retailer], { cache: "no-cache" }).then((response) => {
          if (!response.ok) throw new Error("Weekly ad unavailable.");
          return response.json();
        }),
      );
    return feedCache.get(retailer).catch((error) => {
      feedCache.delete(retailer);
      throw error;
    });
  }
  const words = (text) =>
    String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .match(/[a-z0-9]+/g) || [];
  // Singular form, so "eggs" = "egg", "tomatoes" = "tomato", "berries" = "berry".
  const stem = (word) =>
    word.length > 3 ? word.replace(/ies$/, "y").replace(/oes$/, "o").replace(/(?<!s)s$/, "") : word;
  // Whole words only: "egg" finds "Eggs" but not "Eggo".
  const matches = (term, word) => term === word;
  const sizeIn = (text) =>
    (/\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?\s*(?:fl\.?\s*oz|oz|lbs?|ct|ltr|l|gal|gallon|pack|pk)\b\.?/i.exec(text || "") || [""])[0];
  const shortDate = (iso) =>
    iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  function feedProduct(retailer, item, data, locationId) {
    const where = String(locationId || "all").replace(/[^A-Za-z0-9]/g, "").slice(0, 80) || "all";
    const size = item.unit === "lb" ? "per lb" : sizeIn(item.details) || item.details || "";
    return {
      id: `${retailer}:${item.productId}:${where}`,
      retailer,
      productId: item.productId,
      upc: null,
      name: item.name,
      brand: null,
      size: size.slice(0, 80),
      price: item.price,
      regularPrice: null,
      available: null,
      locationId: locationId || null,
      deal: item.deal || null,
      note: `Weekly ad${data.validTo ? ` · ${shortDate(data.validFrom)}–${shortDate(data.validTo)}` : ""}${item.details ? ` · ${item.details}` : ""}`.slice(0, 160),
      source: "Weekly ad",
      fetchedAt: data.fetchedAt,
    };
  }
  async function feedSearch(retailer, query, locationId, onProduct) {
    const data = await loadFeed(retailer);
    const terms = words(query).map(stem).filter((w) => w.length > 1);
    if (!terms.length) return;
    for (const item of data.products || []) {
      const haystack = words(`${item.name} ${item.details}`).map(stem);
      if (terms.every((t) => haystack.some((w) => matches(t, w))))
        onProduct(feedProduct(retailer, item, data, locationId));
    }
  }
  async function feedLocations(retailer, zip) {
    const data = await loadFeed(retailer);
    const stores = Array.isArray(data.stores) ? data.stores : [];
    // No distance data: list stores in the same ZIP first, then nearby ZIPs.
    return stores
      .map((s) => ({ id: s.id, name: s.name, address: s.address, distanceMiles: null, zip: s.zip }))
      .sort((a, b) => Math.abs(Number(a.zip) - Number(zip)) - Math.abs(Number(b.zip) - Number(zip)));
  }

  // ---- Worker adapters ----
  async function locations(retailer, zip) {
    if (!available(retailer)) return [];
    if (feeds[retailer]) return feedLocations(retailer, zip);
    const data = await getJson(`/retailers/${retailer}/locations`, { zip, limit: "10" });
    // Some chains list warehouses and transport hubs; keep shoppable stores only.
    return (Array.isArray(data.locations) ? data.locations : []).filter(
      (loc) => !/\b(unused|forecast|spoke|shed|trans|warehouse|distribution|fulfillment center)\b/i.test(loc.name || ""),
    );
  }

  async function products(retailer, query, locationId) {
    if (!available(retailer)) return [];
    const data = await getJson(`/retailers/${retailer}/products`, {
      q: query,
      locationId,
      limit: "30",
    });
    return Array.isArray(data.products) ? data.products : [];
  }

  // Streams results for the store nearest a ZIP when no location is chosen.
  async function streamNearest(query, zip, onProduct, onStatus) {
    const params = new URLSearchParams({ q: query, zip });
    const response = await fetch(`${base()}/retailers/compare/stream?${params}`);
    if (!response.ok || !response.body) throw new Error("Live retailer stream failed.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() || "";
      for (const message of messages) {
        const data = message
          .split("\n")
          .find((line) => line.startsWith("data: "))
          ?.slice(6);
        if (!data) continue;
        const event = JSON.parse(data);
        if (event.type === "product") onProduct(event.product);
        if (event.type === "status") onStatus(event.message);
        if (event.type === "error") throw new Error(event.message);
      }
      if (done) break;
    }
  }

  // Searches one retailer: a chosen location when given, else the nearest one.
  async function search(retailer, query, { locationId, zip } = {}, onProduct, onStatus = () => {}) {
    if (!available(retailer)) return;
    if (feeds[retailer]) return feedSearch(retailer, query, locationId, onProduct);
    if (locationId) {
      for (const product of await products(retailer, query, locationId)) onProduct(product);
      return;
    }
    if (retailer !== "kroger") return;
    await streamNearest(query, zip || config.zipCode || "77019", onProduct, onStatus);
  }

  root.ScoutRetailers = Object.freeze({
    enabled: !!config.enabled,
    available,
    locations,
    search,
  });
})(typeof window !== "undefined" ? window : globalThis);
