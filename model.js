(function (root) {
  "use strict";
  const stores = [
    {
      id: "heb",
      name: "H-E-B",
      label: "H-E-B · Houston pilot",
      short: "H",
      color: "#df4c4c",
    },
    {
      id: "walmart",
      name: "Walmart",
      label: "Walmart · Houston pilot",
      short: "✳",
      color: "#3274bb",
    },
  ];
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
  function selectedOffer(item) {
    return item && canSelect(item.name, item.offerId)
      ? catalog.find((o) => o.id === item.offerId)
      : null;
  }
  function cleanSelection(item) {
    const offerId = canSelect(item.name, item.offerId) ? item.offerId : null;
    return { ...item, offerId, done: !!offerId && !!item.done };
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
        : a.price - b.price,
    );
  }
  function initial() {
    return {
      version: 1,
      stores: ["heb", "walmart"],
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
