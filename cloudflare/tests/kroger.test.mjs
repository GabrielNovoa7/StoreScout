import test from 'node:test';
import assert from 'node:assert/strict';
import {clearTokenCache, locations, products} from '../kroger.mjs';

function response(data, ok = true) {
  return {ok, async json() { return data; }};
}

test('Kroger locations use a server-side token and bounded zip query', async () => {
  clearTokenCache();
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options});
    if (url.includes('/oauth2/token'))
      return response({access_token: 'token', expires_in: 3600});
    return response({data: [{
      locationId: '01234',
      name: 'Kroger',
      distance: 1.2,
      address: {addressLine1: '1 Main St', city: 'Houston', state: 'TX'},
    }]});
  };
  const result = await locations({zipCode: '77019', limit: 99}, {
    KROGER_CLIENT_ID: 'id',
    KROGER_CLIENT_SECRET: 'secret',
  }, fetcher);
  assert.deepEqual(result[0], {
    id: '01234',
    name: 'Kroger',
    address: '1 Main St, Houston, TX',
    distanceMiles: 1.2,
  });
  assert.match(calls[1].url, /filter\.zipCode\.near=77019/);
  assert.match(calls[1].url, /filter\.limit=25/);
  assert.match(calls[1].options.headers.Authorization, /^Bearer token$/);
});

test('Kroger products map promotional price, UPC, and availability', async () => {
  clearTokenCache();
  const fetcher = async (url) => url.includes('/oauth2/token')
    ? response({access_token: 'token', expires_in: 3600})
    : response({data: [{
      productId: '0123',
      upc: '000123',
      description: 'Whole Milk',
      brand: 'Kroger',
      items: [{
        size: '1 gal',
        price: {regular: 4.99, promo: 3.99},
        fulfillment: {curbside: true, delivery: false},
      }],
    }]});
  const result = await products({query: 'milk', locationId: '01234'}, {
    KROGER_CLIENT_ID: 'id',
    KROGER_CLIENT_SECRET: 'secret',
  }, fetcher);
  assert.equal(result[0].price, 3.99);
  assert.equal(result[0].regularPrice, 4.99);
  assert.equal(result[0].upc, '000123');
  assert.equal(result[0].available, true);
  assert.equal(result[0].locationId, '01234');
});

test('Kroger adapter rejects invalid search input', async () => {
  await assert.rejects(
    products({query: 'x'}, {KROGER_CLIENT_ID: 'id', KROGER_CLIENT_SECRET: 'secret'}, async () => response({})),
    {status: 400},
  );
});

test('Kroger products use the front photo from the API and drop unknown hosts', async () => {
  clearTokenCache();
  const fetcher = async (url) => url.includes('/oauth2/token')
    ? response({access_token: 'token', expires_in: 3600})
    : response({data: [
      {
        productId: '0001111041700',
        description: 'Milk',
        items: [{price: {regular: 3.29}}],
        images: [
          {perspective: 'back', sizes: [{size: 'large', url: 'https://www.kroger.com/product/images/large/back/0001111041700'}]},
          {perspective: 'front', featured: true, sizes: [
            {size: 'thumbnail', url: 'https://www.kroger.com/product/images/thumbnail/front/0001111041700'},
            {size: 'large', url: 'https://www.kroger.com/product/images/large/front/0001111041700'},
          ]},
        ],
      },
      {
        productId: '0002',
        description: 'Bread',
        items: [{price: {regular: 2}}],
        images: [{perspective: 'front', sizes: [{size: 'large', url: 'https://evil.example/large/front/0002'}]}],
      },
    ]});
  const result = await products({query: 'milk', locationId: '01234'}, {
    KROGER_CLIENT_ID: 'id',
    KROGER_CLIENT_SECRET: 'secret',
  }, fetcher);
  assert.equal(result[0].image, 'https://www.kroger.com/product/images/large/front/0001111041700');
  assert.equal(result[1].image, null);
});
