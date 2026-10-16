// Walmart adapter. Uses the Walmart I/O affiliate APIs (product search and
// store locator). Every request is signed with the app's RSA private key:
// WALMART_CONSUMER_ID, WALMART_KEY_VERSION and WALMART_PRIVATE_KEY (PKCS#8
// PEM) are Worker secrets. Prices are Walmart.com prices, not per-store.
const API = 'https://developer.api.walmart.com/api-proxy/service/affil/product/v2';

let cachedKey = null;

function reject(status) {
  throw Object.assign(new Error('Walmart request rejected'), {status});
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function base64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

async function privateKey(pem) {
  if (cachedKey?.pem === pem) return cachedKey.key;
  const body = pem
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  let der;
  try {
    der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  } catch {
    reject(503);
  }
  const key = await crypto.subtle
    .importKey('pkcs8', der, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['sign'])
    .catch(() => reject(503));
  cachedKey = {pem, key};
  return key;
}

// Walmart signs the header values sorted by header name, each followed by "\n".
export async function signedHeaders(env, now = Date.now()) {
  const consumerId = cleanText(env.WALMART_CONSUMER_ID, 80);
  const keyVersion = cleanText(env.WALMART_KEY_VERSION, 10);
  if (!consumerId || !keyVersion || !env.WALMART_PRIVATE_KEY) reject(503);
  const timestamp = String(now);
  const key = await privateKey(env.WALMART_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${consumerId}\n${timestamp}\n${keyVersion}\n`),
  );
  return {
    'WM_CONSUMER.ID': consumerId,
    'WM_CONSUMER.INTIMESTAMP': timestamp,
    'WM_SEC.KEY_VERSION': keyVersion,
    'WM_SEC.AUTH_SIGNATURE': base64(signature),
    Accept: 'application/json',
  };
}

async function get(path, env, fetcher) {
  const response = await fetcher(`${API}${path}`, {headers: await signedHeaders(env)});
  if (!response.ok) reject(response.status === 400 ? 400 : 503);
  return response.json();
}

function mapLocation(store) {
  return {
    id: String(store?.no ?? '').replace(/\D/g, '').slice(0, 10),
    name: `Walmart - ${cleanText(store?.name, 100) || cleanText(store?.city, 80)}`,
    address: [
      cleanText(store?.streetAddress, 120),
      cleanText(store?.city, 80),
      cleanText(store?.stateProvCode, 20),
    ]
      .filter(Boolean)
      .join(', '),
    distanceMiles: null,
  };
}

// Walmart image URLs carry resize parameters; the bare file is enough.
const IMAGE = /^https:\/\/i5\.walmartimages\.com\/[A-Za-z0-9/._-]+\.(jpg|jpeg|png|webp)$/;
function imageFor(item) {
  for (const field of ['largeImage', 'mediumImage', 'thumbnailImage']) {
    const url = cleanText(item?.[field], 300).split('?')[0];
    if (IMAGE.test(url)) return url;
  }
  return null;
}

export function mapProduct(item, locationId) {
  const sale = Number(item?.salePrice);
  const msrp = Number(item?.msrp);
  const productId = String(item?.itemId ?? '').replace(/\D/g, '').slice(0, 20);
  const name = cleanText(item?.name, 200);
  if (!productId || !name || !Number.isFinite(sale) || sale <= 0) return null;
  const stock = cleanText(item?.stock, 40).toLowerCase();
  return {
    id: `walmart:${productId}:${locationId || 'nearby'}`,
    retailer: 'walmart',
    productId,
    upc: cleanText(item?.upc, 20) || null,
    name,
    brand: cleanText(item?.brandName, 120) || null,
    size: cleanText(item?.size, 80) || null,
    price: sale,
    regularPrice: Number.isFinite(msrp) && msrp > sale ? msrp : null,
    available: stock ? stock === 'available' : null,
    locationId: locationId || null,
    note: 'Walmart.com price; store prices can differ',
    image: imageFor(item),
    source: 'Walmart API',
    fetchedAt: new Date().toISOString(),
  };
}

export async function locations({zipCode, limit = 10}, env, fetcher = fetch) {
  const zip = cleanText(zipCode, 5);
  if (!/^\d{5}$/.test(zip)) reject(400);
  const bounded = Math.min(25, Math.max(1, Number(limit) || 10));
  const data = await get(`/stores?${new URLSearchParams({zip})}`, env, fetcher);
  return (Array.isArray(data) ? data : [])
    .map(mapLocation)
    .filter((location) => location.id)
    .slice(0, bounded);
}

export async function products({query, locationId, limit = 25}, env, fetcher = fetch) {
  const term = cleanText(query, 100);
  if (term.length < 2) reject(400);
  const store = cleanText(locationId, 10);
  if (store && !/^\d{1,10}$/.test(store)) reject(400);
  const bounded = Math.min(25, Math.max(1, Number(limit) || 25));
  const params = new URLSearchParams({query: term, numItems: String(bounded)});
  const data = await get(`/search?${params}`, env, fetcher);
  return (Array.isArray(data?.items) ? data.items : [])
    .map((item) => mapProduct(item, store))
    .filter(Boolean);
}

export function clearKeyCache() {
  cachedKey = null;
}
