import test from 'node:test';
import assert from 'node:assert/strict';
import {clearKeyCache, locations, mapProduct, products, signedHeaders} from '../walmart.mjs';

// A throwaway key pair, generated per run; the real key is a Worker secret.
const pair = await crypto.subtle.generateKey(
  {name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'},
  true,
  ['sign', 'verify'],
);
const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der)).match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
const env = {WALMART_CONSUMER_ID: 'consumer-1', WALMART_KEY_VERSION: '1', WALMART_PRIVATE_KEY: pem};

function response(data, ok = true, status = 200) {
  return {ok, status, async json() { return data; }};
}

test('Walmart requests carry a valid RSA-SHA256 signature over the sorted headers', async () => {
  clearKeyCache();
  const headers = await signedHeaders(env, 1760000000000);
  assert.equal(headers['WM_CONSUMER.ID'], 'consumer-1');
  assert.equal(headers['WM_CONSUMER.INTIMESTAMP'], '1760000000000');
  assert.equal(headers['WM_SEC.KEY_VERSION'], '1');
  const signature = Uint8Array.from(atob(headers['WM_SEC.AUTH_SIGNATURE']), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    pair.publicKey,
    signature,
    new TextEncoder().encode('consumer-1\n1760000000000\n1\n'),
  );
  assert.ok(valid);
});

test('Walmart adapter is unavailable until its secrets are set', async () => {
  clearKeyCache();
  await assert.rejects(products({query: 'milk'}, {}, async () => response({})), {status: 503});
  await assert.rejects(
    products({query: 'milk'}, {...env, WALMART_PRIVATE_KEY: 'not a key'}, async () => response({})),
    {status: 503},
  );
});

test('Walmart locations map the store locator and bound the ZIP', async () => {
  clearKeyCache();
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options});
    return response([
      {no: 5959, name: 'Houston Supercenter', streetAddress: '111 Yale St', city: 'Houston', stateProvCode: 'TX'},
      {no: null, name: 'Broken'},
    ]);
  };
  const result = await locations({zipCode: '77019', limit: 5}, env, fetcher);
  assert.deepEqual(result, [{
    id: '5959',
    name: 'Walmart - Houston Supercenter',
    address: '111 Yale St, Houston, TX',
    distanceMiles: null,
  }]);
  assert.match(calls[0].url, /\/stores\?zip=77019$/);
  assert.ok(calls[0].options.headers['WM_SEC.AUTH_SIGNATURE']);
  await assert.rejects(locations({zipCode: '7701'}, env, fetcher), {status: 400});
});

test('Walmart products map price, savings, stock and photos', async () => {
  clearKeyCache();
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    return response({items: [
      {
        itemId: 10450114,
        name: 'Great Value Whole Milk, 1 Gallon',
        salePrice: 3.12,
        msrp: 3.5,
        upc: '078742351865',
        brandName: 'Great Value',
        size: '128 fl oz',
        stock: 'Available',
        largeImage: 'https://i5.walmartimages.com/asr/abc.jpeg?odnHeight=450&odnWidth=450',
      },
      {itemId: 2, name: 'No price'},
    ]});
  };
  const result = await products({query: 'milk', locationId: '5959', limit: 99}, env, fetcher);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'walmart:10450114:5959');
  assert.equal(result[0].price, 3.12);
  assert.equal(result[0].regularPrice, 3.5);
  assert.equal(result[0].available, true);
  assert.equal(result[0].image, 'https://i5.walmartimages.com/asr/abc.jpeg');
  assert.match(calls[0], /query=milk/);
  assert.match(calls[0], /numItems=25/);
});

test('Walmart adapter rejects bad input and drops unknown image hosts', async () => {
  await assert.rejects(products({query: 'x'}, env, async () => response({})), {status: 400});
  await assert.rejects(products({query: 'milk', locationId: '../1'}, env, async () => response({})), {status: 400});
  const item = mapProduct({itemId: 1, name: 'Eggs', salePrice: 2, largeImage: 'https://evil.example/x.jpg'}, '');
  assert.equal(item.image, null);
  assert.equal(item.id, 'walmart:1:nearby');
  assert.equal(item.regularPrice, null);
});
