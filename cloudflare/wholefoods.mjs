// Whole Foods Market adapter. Reads the same search feed wholefoodsmarket.com
// uses (store-specific prices, sale and Prime prices, photos). No credentials
// are involved; requests identify Store Scout and are rate-limited by the Worker.
const SITE = 'https://www.wholefoodsmarket.com';
const USER_AGENT = 'StoreScout/1.0 (personal grocery price comparison project)';

// Houston-area stores, from wholefoodsmarket.com/api/stores/{id}/summary (2026-10-15).
export const STORES = [
  {id: '10346', name: 'Whole Foods - Montrose', address: '701 Waugh Drive, Houston, TX 77019', lat: 29.757872, lon: -95.397632},
  {id: '10115', name: 'Whole Foods - Kirby', address: '2955 Kirby Dr, Houston, TX 77098', lat: 29.73913, lon: -95.41811},
  {id: '10251', name: 'Whole Foods - Post Oak', address: '1700 Post Oak Blvd, Houston, TX 77056', lat: 29.75015692, lon: -95.46141434},
  {id: '10134', name: 'Whole Foods - Bellaire', address: '4004 Bellaire Blvd, Houston, TX 77025', lat: 29.70668, lon: -95.44167},
  {id: '10552', name: 'Whole Foods - Voss', address: '1407 S Voss Rd, Houston, TX 77057', lat: 29.752298, lon: -95.5005014},
  {id: '10652', name: 'Whole Foods - Independence Heights', address: '101 N Loop W, Houston, TX 77018', lat: 29.81368, lon: -95.39843},
  {id: '10612', name: 'Whole Foods - Westchase', address: '11041 Westheimer Road, Houston, TX 77042', lat: 29.734901, lon: -95.570629},
  {id: '10497', name: 'Whole Foods - Champions', address: '10133 Louetta Rd, Houston, TX 77070', lat: 29.998508, lon: -95.56197},
  {id: '10258', name: 'Whole Foods - Sugar Land', address: '15900 Southwest Freeway, Sugar Land, TX 77478', lat: 29.600115, lon: -95.623358},
  {id: '10474', name: 'Whole Foods - Katy', address: '6601 S Fry Rd, Katy, TX 77494', lat: 29.71243225447675, lon: -95.77184826135637},
  {id: '10574', name: 'Whole Foods - The Woodlands', address: '1925 Hughes Landing Blvd Ste 100, The Woodlands, TX 77380', lat: 30.169128, lon: -95.471151},
];

function reject(status) {
  throw Object.assign(new Error('Whole Foods request rejected'), {status});
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function miles(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

// ZIP -> coordinates through the free zippopotam.us service; on failure the
// stores keep their default (central Houston first) order.
async function zipPoint(zip, fetcher) {
  try {
    const response = await fetcher(`https://api.zippopotam.us/us/${zip}`);
    if (!response.ok) return null;
    const place = (await response.json())?.places?.[0];
    const lat = Number(place?.latitude), lon = Number(place?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) ? {lat, lon} : null;
  } catch {
    return null;
  }
}

export async function locations({zipCode, limit = STORES.length}, env, fetcher = fetch) {
  const zip = cleanText(zipCode, 5);
  if (!/^\d{5}$/.test(zip)) reject(400);
  const bounded = Math.min(STORES.length, Math.max(1, Number(limit) || STORES.length));
  const point = await zipPoint(zip, fetcher);
  return STORES
    .map((s) => ({id: s.id, name: s.name, address: s.address,
      distanceMiles: point ? Math.round(miles(point, s) * 10) / 10 : null}))
    .sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0))
    .slice(0, bounded);
}

const SIZE = /,\s*(\d*\.?\d+(?:\s*-\s*\d*\.?\d+)?\s*(?:FZ|FL OZ|OZ|LB|LBS|CT|COUNT|GAL|GL|QT|PT|L|ML|G|KG|EA|PK)\.?)\s*$/i;
function splitSize(name) {
  const match = SIZE.exec(name);
  if (!match) return {name, size: ''};
  const size = match[1].toLowerCase()
    .replace(/\bfz\b/, 'fl oz')
    .replace(/\bgl\b/, 'gal')
    .replace(/(^|[^\d])\.(\d)/g, '$10.$2') // ".5 gal" -> "0.5 gal"
    .replace(/\s+/g, ' ');
  return {name: name.slice(0, match.index).trim(), size};
}

const money = (n) => `$${n.toFixed(2)}`;
const day = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
};

export function mapProduct(item, storeId) {
  const regular = Number(item?.regularPrice);
  const sale = Number(item?.salePrice);
  const prime = Number(item?.incrementalSalePrice);
  const onSale = Number.isFinite(sale) && sale > 0 && (!Number.isFinite(regular) || sale < regular);
  const price = onSale ? sale : regular;
  const rawName = cleanText(item?.name, 200);
  if (!rawName || !Number.isFinite(price) || price <= 0) return null;
  const slug = cleanText(item?.slug, 300);
  const asin = (/-(b0[0-9a-z]{8})$/i.exec(slug)?.[1] || '').toUpperCase();
  const productId = asin || slug.replace(/[^A-Za-z0-9]/g, '').slice(-40);
  if (!productId) return null;
  const {name, size} = splitSize(rawName);
  const byWeight = cleanText(item?.uom, 10).toLowerCase() === 'lb';
  const image = cleanText(item?.imageThumbnail, 300);
  const notes = [];
  if (onSale && item.saleEndDate) notes.push(`Sale through ${day(item.saleEndDate)}`);
  return {
    id: `wholefoods:${productId}:${storeId}`,
    retailer: 'wholefoods',
    productId,
    upc: null,
    name,
    brand: cleanText(item?.brand, 120) || null,
    size: byWeight ? 'per lb' : size || null,
    price,
    regularPrice: Number.isFinite(regular) && regular > 0 ? regular : null,
    available: null,
    locationId: storeId,
    deal: Number.isFinite(prime) && prime > 0 && prime < price ? `Prime ${money(prime)}` : null,
    note: notes.join(' · ') || null,
    image: /^https:\/\/m\.media-amazon\.com\/images\/[A-Za-z0-9/._+-]+\.(jpg|jpeg|png|webp)$/.test(image) ? image : null,
    source: 'Whole Foods',
    fetchedAt: new Date().toISOString(),
  };
}

export async function products({query, locationId, zipCode, limit = 30}, env, fetcher = fetch) {
  const term = cleanText(query, 100);
  if (term.length < 2) reject(400);
  let store = cleanText(locationId, 10);
  if (store && !STORES.some((s) => s.id === store)) reject(400);
  if (!store) {
    const zip = cleanText(zipCode, 5);
    store = /^\d{5}$/.test(zip) ? (await locations({zipCode: zip, limit: 1}, env, fetcher))[0].id : STORES[0].id;
  }
  const bounded = Math.min(60, Math.max(1, Number(limit) || 30));
  const params = new URLSearchParams({text: term, store, limit: String(bounded), offset: '0'});
  const response = await fetcher(`${SITE}/api/search?${params}`, {
    headers: {'User-Agent': USER_AGENT, Accept: 'application/json'},
  });
  if (!response.ok) reject(503);
  const data = await response.json();
  const mapped = (Array.isArray(data?.results) ? data.results : [])
    .map((item) => mapProduct(item, store))
    .filter(Boolean);
  // The site's search pads results with loosely related items (kimchi for
  // "eggs"); keep products that name a search word, unless that leaves none.
  const terms = words(term);
  const relevant = mapped.filter((p) => {
    const have = words(`${p.name} ${p.brand || ''}`);
    return terms.some((t) => have.includes(t));
  });
  return relevant.length ? relevant : mapped;
}

const singular = (w) => (w.length > 3 ? w.replace(/ies$/, 'y').replace(/oes$/, 'o').replace(/(?<!s)s$/, '') : w);
function words(text) {
  return (String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) || []).map(singular);
}
