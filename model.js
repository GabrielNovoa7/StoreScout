(function (root) {
  "use strict";
  // Store metadata drives logos, live search, and location pickers. A new
  // store needs an entry here; a live store also needs a Worker adapter.
  // status "coming-soon" keeps a store visible as in progress but out of
  // comparisons, totals, and shopping until its data source is connected.
  const stores = [
    { id: "kroger", name: "Kroger", label: "Kroger", short: "K", color: "#1768b2", domain: "kroger.com", live: true, status: "active",
      family: ["Ralphs", "King Soopers", "Fred Meyer", "Fry's", "Harris Teeter", "Smith's", "QFC", "Dillons", "Mariano's", "Food 4 Less"] },
    { id: "wholefoods", name: "Whole Foods", label: "Whole Foods", short: "WF", color: "#00674b", domain: "wholefoodsmarket.com", live: true, status: "active" },
    { id: "heb", name: "H-E-B", label: "H-E-B", short: "H", color: "#df4c4c", domain: "heb.com", live: false, status: "coming-soon" },
    { id: "walmart", name: "Walmart", label: "Walmart", short: "W", color: "#3274bb", domain: "walmart.com", live: false, status: "coming-soon" },
    { id: "sellers", name: "Sellers Bros.", label: "Sellers Bros.", short: "S", color: "#c8102e", domain: "sellersbros.com", live: true, status: "active", pricing: "weekly-ad" },
  ];
  const liveStoreIds = () => stores.filter((s) => s.live).map((s) => s.id);
  const products = [
    [
      "basil",
      "fresh basil",
      "Fresh basil",
      "H-E-B Organics",
      "0.75 oz",
      0.75,
      "oz",
      2.28,
      "🌿",
      "herbs",
    ],
    [
      "basil-w",
      "fresh basil",
      "Fresh basil",
      "Organic fresh herbs",
      "0.5 oz",
      0.5,
      "oz",
      1.98,
      "🌿",
      "herbs",
    ],
    [
      "basil-d",
      "dried basil",
      "Dried basil leaves",
      "H-E-B",
      "0.62 oz",
      0.62,
      "oz",
      1.84,
      "🌱",
      "herbs",
    ],
    [
      "basil-dw",
      "dried basil",
      "Basil leaves",
      "Great Value",
      "0.8 oz",
      0.8,
      "oz",
      1.12,
      "🌱",
      "herbs",
    ],
    [
      "eggs",
      "eggs",
      "Large brown eggs",
      "H-E-B Cage Free",
      "12 count",
      12,
      "each",
      3.48,
      "🥚",
      "dairy",
    ],
    [
      "eggs-w",
      "eggs",
      "Large white eggs",
      "Great Value",
      "12 count",
      12,
      "each",
      2.96,
      "🥚",
      "dairy",
    ],
    [
      "milk",
      "milk",
      "Whole milk",
      "H-E-B",
      "1 gallon",
      128,
      "fl oz",
      3.26,
      "🥛",
      "dairy",
    ],
    [
      "milk-w",
      "milk",
      "Whole milk",
      "Great Value",
      "1 gallon",
      128,
      "fl oz",
      3.12,
      "🥛",
      "dairy",
    ],
    [
      "avocado",
      "avocados",
      "Hass avocados",
      "Fresh produce",
      "4 count",
      4,
      "each",
      3.48,
      "🥑",
      "produce",
    ],
    [
      "avocado-w",
      "avocados",
      "Hass avocados",
      "Fresh produce",
      "4 count",
      4,
      "each",
      3.76,
      "🥑",
      "produce",
    ],
    [
      "bread",
      "bread",
      "Sourdough bread",
      "H-E-B Bakery",
      "18 oz loaf",
      18,
      "oz",
      3.98,
      "🍞",
      "bakery",
    ],
    [
      "bread-w",
      "bread",
      "Sourdough bread",
      "Marketside",
      "24 oz loaf",
      24,
      "oz",
      4.48,
      "🍞",
      "bakery",
    ],
    [
      "chicken",
      "chicken",
      "Boneless chicken breast",
      "H-E-B Natural",
      "1 lb",
      16,
      "oz",
      4.28,
      "🍗",
      "meat",
    ],
    [
      "chicken-w",
      "chicken",
      "Boneless chicken breast",
      "Freshness Guaranteed",
      "1 lb",
      16,
      "oz",
      3.94,
      "🍗",
      "meat",
    ],
    [
      "banana",
      "bananas",
      "Yellow bananas",
      "Fresh produce",
      "1 lb",
      16,
      "oz",
      0.58,
      "🍌",
      "produce",
    ],
    [
      "banana-w",
      "bananas",
      "Yellow bananas",
      "Fresh produce",
      "1 lb",
      16,
      "oz",
      0.54,
      "🍌",
      "produce",
    ],
    [
      "strawberry",
      "strawberries",
      "Fresh strawberries",
      "Fresh produce",
      "1 lb",
      16,
      "oz",
      2.98,
      "🍓",
      "produce",
    ],
    [
      "strawberry-w",
      "strawberries",
      "Fresh strawberries",
      "Fresh produce",
      "1 lb",
      16,
      "oz",
      3.24,
      "🍓",
      "produce",
    ],
    [
      "beef",
      "ground beef",
      "93% lean ground beef",
      "H-E-B",
      "1 lb",
      16,
      "oz",
      5.48,
      "🥩",
      "meat",
    ],
    [
      "beef-w",
      "ground beef",
      "93% lean ground beef",
      "All Natural",
      "1 lb",
      16,
      "oz",
      5.24,
      "🥩",
      "meat",
    ],
  ];
  const catalog = products.map((p, i) => ({
    id: p[0],
    category: p[1],
    name: p[2],
    brand: p[3],
    size: p[4],
    amount: p[5],
    unit: p[6],
    price: p[7],
    emoji: p[8],
    department: p[9],
    storeId: i % 2 ? "walmart" : "heb",
    available: p[0] === "bread-w" ? null : true,
    promotion:
      p[0] === "avocado"
        ? "Sample multi-pack offer · no coupon required"
        : null,
  }));
  const normalize = (value) =>
    String(value).toLowerCase().trim().replace(/\s+/g, " ");
  function intent(value) {
    const text = normalize(value);
    if (/\bbasil\b/.test(text)) {
      // A basil ingredient in a prepared product is not the herb itself.
      if (
        !/^(?:(?:fresh|dried|dry|ground|powder|basil|leaves|leaf|organic|herb|herbs)\s*)+$/.test(
          text,
        )
      )
        return { category: null, needsForm: false };
      const fresh = /\bfresh\b/.test(text),
        dried = /\b(dried|dry|ground|powder)\b/.test(text);
      if (fresh && dried) return { category: null, needsForm: true };
      if (fresh) return { category: "fresh basil", needsForm: false };
      if (dried) return { category: "dried basil", needsForm: false };
      return { category: null, needsForm: true };
    }
    const aliases = {
      egg: "eggs",
      avocado: "avocados",
      banana: "bananas",
      strawberry: "strawberries",
      "chicken breast": "chicken",
      "whole milk": "milk",
      sourdough: "bread",
      "sourdough bread": "bread",
    };
    const named = catalog.find(
      (o) =>
        normalize(o.name) === text ||
        normalize(o.brand + " " + o.name) === text,
    );
    return {
      category: aliases[text] || named?.category || text,
      needsForm: false,
      exactName: named ? normalize(named.name) : null,
      exactBrand:
        named && normalize(named.brand + " " + named.name) === text
          ? normalize(named.brand)
          : null,
    };
  }
  function matchOffers(value, enabled = ["heb", "walmart"]) {
    const request = intent(value);
    if (request.needsForm || !request.category) return [];
    return catalog.filter(
      (o) =>
        o.category === request.category &&
        (!request.exactName || normalize(o.name) === request.exactName) &&
        (!request.exactBrand || normalize(o.brand) === request.exactBrand) &&
        enabled.includes(o.storeId),
    );
  }
  function canSelect(value, offerId) {
    return matchOffers(value).some((o) => o.id === offerId);
  }
  // Live retailer picks are not in the sample catalog, so the item keeps a
  // bounded snapshot of the offer it was chosen from.
  const liveText = (value, max) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
  function cleanLive(value) {
    if (!value || typeof value !== "object" || !liveStoreIds().includes(value.retailer))
      return null;
    const id = liveText(value.id, 200),
      productId = liveText(value.productId, 80),
      name = liveText(value.name, 200),
      price = Number(value.price);
    if (
      !id ||
      !productId ||
      !name ||
      !id.startsWith(`${value.retailer}:`) ||
      !/^[a-z]+:[A-Za-z0-9]{1,80}:[A-Za-z0-9]{1,80}$/.test(id) ||
      !Number.isFinite(price) ||
      price <= 0 ||
      price > 10000
    )
      return null;
    const regular = Number(value.regularPrice),
      fetched = Date.parse(value.fetchedAt);
    return {
      id,
      retailer: value.retailer,
      productId,
      upc: liveText(value.upc, 20),
      name,
      brand: liveText(value.brand, 120),
      size: liveText(value.size, 80),
      price,
      regularPrice: Number.isFinite(regular) && regular > 0 ? regular : null,
      locationId: liveText(value.locationId, 80),
      available: typeof value.available === "boolean" ? value.available : null,
      deal: liveText(value.deal, 40),
      note: liveText(value.note, 160),
      image:
        typeof value.image === "string" &&
        (/^https:\/\/images\.openfoodfacts\.org\/images\/products\/[A-Za-z0-9/._-]+\.(jpg|jpeg|png|webp)$/.test(value.image) ||
          /^https:\/\/m\.media-amazon\.com\/images\/[A-Za-z0-9/._+-]+\.(jpg|jpeg|png|webp)$/.test(value.image))
          ? value.image
          : null,
      fetchedAt: Number.isFinite(fetched) ? new Date(fetched).toISOString() : null,
    };
  }
  // Converts retailer size text ("10 fl oz", "1 gal", "2 lb") into one unit
  // per family so unit prices are only compared like-for-like.
  const sizeUnits = {
    "fl oz": ["fl oz", 1], floz: ["fl oz", 1], gal: ["fl oz", 128], gallon: ["fl oz", 128],
    qt: ["fl oz", 32], quart: ["fl oz", 32], pt: ["fl oz", 16], pint: ["fl oz", 16],
    l: ["fl oz", 33.814], liter: ["fl oz", 33.814], ml: ["fl oz", 0.033814],
    oz: ["oz", 1], lb: ["oz", 16], lbs: ["oz", 16], g: ["oz", 0.035274], kg: ["oz", 35.274],
    ct: ["ct", 1], count: ["ct", 1], each: ["ct", 1], ea: ["ct", 1], pk: ["ct", 1], pack: ["ct", 1],
  };
  function parseSize(text) {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|[a-z]+)(?![a-z])/i.exec(String(text || ""));
    if (!match) return null;
    const key = match[2].toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
    const unit = sizeUnits[key];
    const amount = Number(match[1]) * (unit?.[1] || 0);
    return unit && amount > 0 ? { amount: Math.round(amount * 1000) / 1000, unit: unit[0] } : null;
  }
  function unitPrice(product) {
    const size = parseSize(product?.size);
    const price = Number(product?.price);
    return size && Number.isFinite(price) ? { value: price / size.amount, unit: size.unit } : null;
  }
  // ---- Search relevance -------------------------------------------------
  // A product name's last noun says what it is: "Wide Egg Noodles" are
  // noodles, "Jumbo White Eggs" are eggs. Results whose main noun matches the
  // search are best matches; ones that only mention the word are related.
  const singular = (w) =>
    w.length > 3 ? w.replace(/ies$/, "y").replace(/oes$/, "o").replace(/(?<!s)s$/, "") : w;
  const nameWords = (text) =>
    (String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’®™]/g, "")
      .match(/[a-z0-9%]+/g) || []).map(singular);
  // Packaging, size and grade words that can trail a name ("Eggs, 12 Count Carton").
  const TRAILING = new Set([
    "pack", "pk", "pkg", "package", "jar", "bag", "box", "bottle", "btl", "can", "tub", "carton",
    "count", "ct", "dozen", "doz", "gallon", "gal", "gl", "half", "quart", "qt", "pint", "pt",
    "oz", "fl", "fz", "lb", "lbs", "ea", "each", "size", "value", "family", "tray", "loose", "bunch",
    "small", "medium", "large", "xl", "jumbo", "extra", "mini", "regular",
  ]);
  // Cuts and forms that are still the searched food ("Chicken Breast" for chicken).
  const PARTS = new Set([
    "breast", "thigh", "wing", "drumstick", "tender", "tenderloin", "leg", "quarter", "fillet",
    "filet", "steak", "chop", "rib", "loin", "roast", "cutlet", "shoulder", "brisket", "ground",
    "half", "piece", "slice", "strip", "link", "sausage",
  ]);
  function mainNoun(name) {
    const head = String(name || "")
      .split(",")[0]
      .split(/\s(?:with|w\/|in|for|made with|featuring|plus)\s/i)[0];
    const words = nameWords(head);
    while (words.length > 1 && (TRAILING.has(words.at(-1)) || /^\d/.test(words.at(-1)))) words.pop();
    return { noun: words.at(-1) || "", words };
  }
  // 2 = best match, 1 = mentions every search word, 0 = otherwise.
  function relevance(query, product) {
    const terms = nameWords(query).filter((t) => t.length > 1);
    if (!terms.length) return 1;
    const { noun, words } = mainNoun(product?.name);
    const all = new Set([...words, ...nameWords(product?.brand)]);
    if (!terms.every((t) => all.has(t))) return 0;
    const target = terms.at(-1);
    if (noun === target) return 2;
    // "Chicken Breast": the search word sits right before a cut/form word.
    const i = words.lastIndexOf(target);
    if (terms.length === 1 && PARTS.has(noun) && i >= 0 && i === words.length - 2) return 2;
    return 1;
  }
  function sortLive(products, mode) {
    const list = [...products];
    const byName = (a, b) => String(a.name).localeCompare(String(b.name));
    if (mode === "price-desc") return list.sort((a, b) => b.price - a.price || byName(a, b));
    if (mode === "name") return list.sort(byName);
    if (mode === "unit")
      return list.sort((a, b) => {
        const ua = unitPrice(a), ub = unitPrice(b);
        if (!ua || !ub) return ua ? -1 : ub ? 1 : a.price - b.price;
        return ua.unit.localeCompare(ub.unit) || ua.value - ub.value;
      });
    return list.sort((a, b) => a.price - b.price || byName(a, b));
  }
  // One chosen location per store, e.g. { kroger: { id, name, address } }.
  function cleanLocations(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out = {};
    for (const store of stores) {
      const loc = value[store.id];
      const id = liveText(loc?.id, 80);
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) continue;
      out[store.id] = {
        id,
        name: liveText(loc.name, 120) || store.name,
        address: liveText(loc.address, 200) || "",
      };
    }
    return out;
  }
  function liveOffer(item) {
    const live = cleanLive(item?.live);
    if (!live || live.id !== item.offerId) return null;
    const size = parseSize(live.size);
    return {
      id: live.id,
      storeId: live.retailer,
      name: live.name,
      brand: live.brand || stores.find((st) => st.id === live.retailer)?.name || "",
      size: live.size || "size unavailable",
      price: live.price,
      amount: size?.amount || 1,
      unit: size?.unit || "package",
      emoji: "",
      department: "pantry",
      available: live.available,
      live,
    };
  }
  function selectedOffer(item) {
    if (!item) return null;
    const live = item.live && liveOffer(item);
    if (live) return live;
    return canSelect(item.name, item.offerId)
      ? catalog.find((o) => o.id === item.offerId)
      : null;
  }
  function cleanSelection(item) {
    const { live: rawLive, ...rest } = item;
    const live = rawLive ? cleanLive(rawLive) : null;
    if (live && live.id === item.offerId)
      return { ...rest, offerId: live.id, live, done: !!item.done };
    const offerId = canSelect(item.name, item.offerId) ? item.offerId : null;
    return { ...rest, offerId, done: !!offerId && !!item.done };
  }
  function cleanPreferences(value) {
    return Object.fromEntries(
      Object.entries(value || {})
        .filter(([key, id]) => key.length <= 100 && canSelect(key, id))
        .slice(-200),
    );
  }
  function sortOffers(offers, mode) {
    return [...offers].sort((a, b) =>
      mode === "unit"
        ? a.unit.localeCompare(b.unit) ||
          a.price / a.amount - b.price / b.amount
        : mode === "price-desc"
          ? b.price - a.price
          : mode === "name"
            ? a.name.localeCompare(b.name)
            : a.price - b.price,
    );
  }
  function initial() {
    return {
      version: 1,
      stores: ["kroger", "wholefoods", "sellers", "heb", "walmart"],
      locations: {},
      items: [
        { id: "i1", name: "Eggs", quantity: 1, offerId: "eggs-w", done: false },
        { id: "i2", name: "Milk", quantity: 1, offerId: "milk", done: false },
        { id: "i3", name: "Basil", quantity: 1, offerId: null, done: false },
        {
          id: "i4",
          name: "Avocados",
          quantity: 1,
          offerId: "avocado",
          done: false,
        },
        {
          id: "i5",
          name: "Sourdough bread",
          quantity: 1,
          offerId: null,
          done: false,
        },
        {
          id: "i6",
          name: "Chicken breast",
          quantity: 1,
          offerId: null,
          done: false,
        },
        {
          id: "i7",
          name: "Bananas",
          quantity: 1,
          offerId: "banana-w",
          done: false,
        },
      ],
      preferences: {},
    };
  }
  function restore(raw) {
    try {
      const data = JSON.parse(raw);
      if (
        data?.version !== 1 ||
        !Array.isArray(data.items) ||
        !Array.isArray(data.stores) ||
        !data.items.every(
          (i) =>
            i &&
            typeof i.id === "string" &&
            typeof i.name === "string" &&
            i.name.trim() &&
            Number.isInteger(i.quantity) &&
            i.quantity > 0 &&
            i.quantity <= 99,
        )
      )
        return initial();
      return {
        version: 1,
        items: data.items.map((i) => cleanSelection(i)),
        stores: data.stores.filter((id) => stores.some((s) => s.id === id)),
        locations: cleanLocations(data.locations),
        preferences: cleanPreferences(
          data.preferences && typeof data.preferences === "object"
            ? data.preferences
            : {},
        ),
      };
    } catch {
      return initial();
    }
  }
  function summary(items) {
    const valid = items.filter((i) => selectedOffer(i));
    return {
      total: valid.reduce(
        (sum, i) => sum + selectedOffer(i).price * i.quantity,
        0,
      ),
      selected: valid.length,
      done: valid.filter((i) => i.done).length,
    };
  }
  const api = {
    stores,
    catalog,
    normalize,
    intent,
    matchOffers,
    canSelect,
    selectedOffer,
    cleanLive,
    liveOffer,
    parseSize,
    unitPrice,
    sortLive,
    relevance,
    cleanLocations,
    cleanSelection,
    cleanPreferences,
    sortOffers,
    initial,
    restore,
    summary,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Scout = api;
})(typeof window !== "undefined" ? window : globalThis);
