(function (root) {
  "use strict";
  const config = root.STORE_SCOUT_RETAILERS || {};

  async function searchKroger(query) {
    if (!config.enabled || !config.workerUrl) return [];
    const params = new URLSearchParams({ q: query, limit: "20" });
    if (config.krogerLocationId)
      params.set("locationId", config.krogerLocationId);
    const response = await fetch(
      `${config.workerUrl.replace(/\/$/, "")}/retailers/kroger/products?${params}`,
    );
    if (!response.ok) throw new Error("Live retailer search failed.");
    const data = await response.json();
    return Array.isArray(data.products) ? data.products : [];
  }

  async function streamKroger(query, onProduct, onStatus) {
    if (!config.enabled || !config.workerUrl) return;
    const params = new URLSearchParams({ q: query, zip: config.zipCode || "77019" });
    const response = await fetch(
      `${config.workerUrl.replace(/\/$/, "")}/retailers/compare/stream?${params}`,
    );
    if (!response.ok || !response.body)
      throw new Error("Live retailer stream failed.");
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

  root.ScoutRetailers = Object.freeze({
    enabled: !!config.enabled,
    searchKroger,
    streamKroger,
  });
})(typeof window !== "undefined" ? window : globalThis);
