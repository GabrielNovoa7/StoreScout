/* Product photos from Open Food Facts (free, no key), looked up by barcode.
   Photos are a convenience: any failure just leaves the product without one. */
(function (root) {
  "use strict";
  const API = "https://world.openfoodfacts.org/api/v2";
  const IMAGE = /^https:\/\/images\.openfoodfacts\.org\/images\/products\/[A-Za-z0-9/._-]+\.(jpg|jpeg|png|webp)$/;
  const CACHE_KEY = "store-scout-photos-v1";
  const TTL = 7 * 24 * 60 * 60 * 1000;
  const MAX_LOOKUPS = 30;
  const cache = new Map();

  try {
    const saved = JSON.parse(root.localStorage?.getItem(CACHE_KEY) || "{}");
    for (const [code, entry] of Object.entries(saved))
      if (entry && Date.now() - entry.t < TTL) cache.set(code, entry.u || "");
  } catch {}
  function persist() {
    try {
      const out = {};
      for (const [code, url] of [...cache].slice(-500)) out[code] = { u: url, t: Date.now() };
      root.localStorage?.setItem(CACHE_KEY, JSON.stringify(out));
    } catch {}
  }

  function checkDigit(digits) {
    const sum = [...digits]
      .reverse()
      .reduce((total, d, i) => total + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
    return String((10 - (sum % 10)) % 10);
  }
  // Returns a 12- or 13-digit barcode Open Food Facts understands.
  function barcodeFor(product) {
    const digits = String(product?.upc || "").replace(/\D/g, "");
    if (!digits) return null;
    // Kroger sends 13 digits without the check digit: keep the last 11 and add it.
    if (product.retailer === "kroger" && digits.length === 13) {
      const body = digits.slice(-11);
      return body + checkDigit(body);
    }
    if (digits.length === 12 || digits.length === 13)
      return checkDigit(digits.slice(0, -1)) === digits.slice(-1) ? digits : null;
    return null;
  }
  const key = (code) => String(code).replace(/^0+/, "");
  const cleanUrl = (url) => (typeof url === "string" && IMAGE.test(url) ? url : "");

  async function searchBatch(codes) {
    const params = new URLSearchParams({
      code: codes.join(","),
      fields: "code,image_front_small_url",
      page_size: String(codes.length),
    });
    const response = await fetch(`${API}/search?${params}`);
    if (!response.ok) throw new Error("Photo search unavailable.");
    const data = await response.json();
    const found = new Map(
      (data.products || []).map((p) => [key(p.code), cleanUrl(p.image_front_small_url)]),
    );
    for (const code of codes) cache.set(key(code), found.get(key(code)) || "");
  }
  async function lookupOne(code) {
    const response = await fetch(
      `${API}/product/${encodeURIComponent(code)}?fields=code,image_front_small_url`,
    );
    if (response.status === 404) return cache.set(key(code), "");
    if (!response.ok) throw new Error("Photo lookup unavailable.");
    const data = await response.json();
    cache.set(key(code), cleanUrl(data.product?.image_front_small_url));
  }
  async function lookupEach(codes) {
    const queue = [...codes];
    const worker = async () => {
      while (queue.length) {
        try {
          await lookupOne(queue.shift());
        } catch {
          return; // Likely rate limited; leave the rest for a later search.
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  // Resolves to Map(productId -> photo URL) for products that have a photo.
  async function lookup(products) {
    const codes = new Map();
    for (const product of products || []) {
      const code = barcodeFor(product);
      if (code) codes.set(product.id, code);
    }
    const missing = [...new Set(codes.values())]
      .filter((code) => !cache.has(key(code)))
      .slice(0, MAX_LOOKUPS);
    if (missing.length) {
      try {
        await searchBatch(missing);
      } catch {
        await lookupEach(missing);
      }
      persist();
    }
    const result = new Map();
    for (const [id, code] of codes) {
      const url = cache.get(key(code));
      if (url) result.set(id, url);
    }
    return result;
  }

  root.ScoutPhotos = Object.freeze({ lookup, barcodeFor, isPhotoUrl: (url) => !!cleanUrl(url) });
})(typeof window !== "undefined" ? window : globalThis);
