const API = 'https://api.kroger.com/v1';

let cachedToken = null;

function reject(status) {
  throw Object.assign(new Error('Kroger request rejected'), { status });
}

function encodedCredentials(clientId, clientSecret) {
  return btoa(`${clientId}:${clientSecret}`);
}

async function token(env, fetcher) {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  if (!env.KROGER_CLIENT_ID || !env.KROGER_CLIENT_SECRET) reject(503);
  const response = await fetcher(`${API}/connect/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encodedCredentials(
        env.KROGER_CLIENT_ID,
        env.KROGER_CLIENT_SECRET,
      )}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=product.compact',
  });
  if (!response.ok) reject(503);
  const data = await response.json();
  if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in))
    reject(503);
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(30, data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

async function get(path, env, fetcher) {
  const response = await fetcher(`${API}${path}`, {
    headers: { Authorization: `Bearer ${await token(env, fetcher)}` },
  });
  if (!response.ok) reject(response.status === 400 ? 400 : 503);
  return response.json();
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function mapLocation(location) {
  return {
    id: cleanText(location.locationId, 80),
    name: cleanText(location.name, 120),
    address: [
      cleanText(location.address?.addressLine1, 120),
      cleanText(location.address?.city, 80),
      cleanText(location.address?.state, 20),
    ]
      .filter(Boolean)
      .join(', '),
    distanceMiles: Number.isFinite(location.distance)
      ? Number(location.distance)
      : null,
  };
}

function mapProduct(product, locationId) {
  const item = Array.isArray(product.items)
    ? product.items.find((candidate) => candidate?.price?.regular != null) ||
      product.items[0]
    : null;
  const regular = Number(item?.price?.regular);
  const promo = Number(item?.price?.promo);
  const price = Number.isFinite(promo) && promo > 0 ? promo : regular;
  if (!product.productId || !Number.isFinite(price)) return null;
  const size = cleanText(item?.size, 80);
  return {
    id: `kroger:${product.productId}:${locationId || 'nearby'}`,
    retailer: 'kroger',
    productId: cleanText(product.productId, 80),
    upc: cleanText(product.upc, 20) || null,
    name: cleanText(product.description, 200),
    brand: cleanText(product.brand, 120) || null,
    size: size || null,
    price,
    regularPrice: Number.isFinite(regular) ? regular : null,
    unitPrice: null,
    unit: null,
    available: item?.fulfillment
      ? Object.values(item.fulfillment).some(Boolean)
      : null,
    locationId: locationId || null,
    source: 'Kroger API',
    fetchedAt: new Date().toISOString(),
  };
}

export async function locations({ zipCode, limit = 10 }, env, fetcher = fetch) {
  const zip = cleanText(zipCode, 5);
  if (!/^\d{5}$/.test(zip)) reject(400);
  const bounded = Math.min(25, Math.max(1, Number(limit) || 10));
  const params = new URLSearchParams({
    'filter.zipCode.near': zip,
    'filter.limit': String(bounded),
  });
  const data = await get(`/locations?${params}`, env, fetcher);
  return (Array.isArray(data.data) ? data.data : []).map(mapLocation);
}

export async function products(
  { query, locationId, limit = 20 },
  env,
  fetcher = fetch,
) {
  const term = cleanText(query, 100);
  if (term.length < 2) reject(400);
  const bounded = Math.min(50, Math.max(1, Number(limit) || 20));
  const params = new URLSearchParams({
    'filter.term': term,
    'filter.limit': String(bounded),
  });
  if (locationId) params.set('filter.locationId', cleanText(locationId, 80));
  const data = await get(`/products?${params}`, env, fetcher);
  return (Array.isArray(data.data) ? data.data : [])
    .map((product) => mapProduct(product, locationId))
    .filter(Boolean);
}

export function clearTokenCache() {
  cachedToken = null;
}
