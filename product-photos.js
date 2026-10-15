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

  // Trims plain white borders so the product fills its frame. Open Food Facts
  // images allow cross-origin reads, so the browser can crop them on a canvas.
  const trimmed = new Map();
  const pending = new Map();
  const WHITE = 236;
  function larger(url) {
    return url.replace(/\.(100|200)\.(jpg|jpeg|png|webp)$/, ".400.$2");
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  function contentBox(data, width, height) {
    let top = height, left = width, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] > 16 && (data[i] < WHITE || data[i + 1] < WHITE || data[i + 2] < WHITE)) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    return right < 0 ? null : { left, top, right, bottom };
  }
  async function trim(url) {
    let img;
    try {
      img = await loadImage(larger(url));
    } catch {
      img = await loadImage(url);
    }
    const scan = document.createElement("canvas");
    const scale = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight));
    scan.width = Math.max(1, Math.round(img.naturalWidth * scale));
    scan.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const sctx = scan.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, scan.width, scan.height);
    const box = contentBox(sctx.getImageData(0, 0, scan.width, scan.height).data, scan.width, scan.height);
    if (!box) return img.src;
    const pad = 2;
    const sx = Math.max(0, (box.left - pad) / scale);
    const sy = Math.max(0, (box.top - pad) / scale);
    const sw = Math.min(img.naturalWidth - sx, (box.right - box.left + 1 + pad * 2) / scale);
    const sh = Math.min(img.naturalHeight - sy, (box.bottom - box.top + 1 + pad * 2) / scale);
    // Nothing worth cropping: keep the original (already cached by the browser).
    if (sw * sh > img.naturalWidth * img.naturalHeight * 0.92) return img.src;
    const out = document.createElement("canvas");
    out.width = Math.round(sw);
    out.height = Math.round(sh);
    out.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.88);
  }
  // Returns the best source available now; calls onReady once a trimmed one exists.
  function display(url, onReady) {
    if (!cleanUrl(url)) return "";
    if (trimmed.has(url)) return trimmed.get(url);
    if (typeof document !== "undefined" && !pending.has(url)) {
      pending.set(
        url,
        trim(url)
          .then((src) => trimmed.set(url, src))
          .catch(() => trimmed.set(url, url))
          .finally(() => {
            pending.delete(url);
            onReady?.();
          }),
      );
    }
    return url;
  }

  root.ScoutPhotos = Object.freeze({ lookup, display, barcodeFor, isPhotoUrl: (url) => !!cleanUrl(url) });
})(typeof window !== "undefined" ? window : globalThis);
