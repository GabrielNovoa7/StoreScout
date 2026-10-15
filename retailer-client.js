(function (root) {
  "use strict";
  const config = root.STORE_SCOUT_RETAILERS || {};
  // Retailers with a Worker adapter at /retailers/<id>/products and /locations.
  const adapters = Array.isArray(config.adapters) ? config.adapters : ["kroger"];
  const base = () => String(config.workerUrl || "").replace(/\/$/, "");
  const available = (retailer) =>
    !!config.enabled && !!config.workerUrl && adapters.includes(retailer);

  async function getJson(path, params) {
    const response = await fetch(`${base()}${path}?${new URLSearchParams(params)}`);
    if (!response.ok) throw new Error("Live retailer request failed.");
    return response.json();
  }

  async function locations(retailer, zip) {
    if (!available(retailer)) return [];
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
    if (locationId) {
      for (const product of await products(retailer, query, locationId)) onProduct(product);
      return;
    }
    if (retailer !== "kroger") return;
    await streamNearest(query, zip || config.zipCode || "77019", onProduct, onStatus);
  }

  root.ScoutRetailers = Object.freeze({
    enabled: !!config.enabled && !!config.workerUrl,
    available,
    locations,
    search,
  });
})(typeof window !== "undefined" ? window : globalThis);
