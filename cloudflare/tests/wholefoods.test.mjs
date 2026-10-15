import test from 'node:test';
import assert from 'node:assert/strict';
import {STORES, locations, mapProduct, products} from '../wholefoods.mjs';

function response(data, ok = true, status = 200) {
  return {ok, status, async json() { return data; }};
}

test('Whole Foods locations sort Houston stores by distance from the ZIP', async () => {
  const fetcher = async (url) => {
    assert.equal(url, 'https://api.zippopotam.us/us/77019');
    return response({places: [{latitude: '29.7543', longitude: '-95.4005'}]});
  };
  const result = await locations({zipCode: '77019', limit: 3}, {}, fetcher);
  assert.equal(result.length, 3);
  assert.equal(result[0].id, '10346'); // Montrose is in 77019
  assert.ok(result[0].distanceMiles < result[1].distanceMiles);
  await assert.rejects(locations({zipCode: 'abc'}, {}, fetcher), {status: 400});
});

test('Whole Foods locations still work when ZIP lookup fails', async () => {
  const result = await locations({zipCode: '77019'}, {}, async () => { throw new Error('offline'); });
  assert.equal(result.length, STORES.length);
  assert.equal(result[0].distanceMiles, null);
});

test('Whole Foods products map sale, Prime, size, weight and photo', () => {
  const sale = mapProduct({
    regularPrice: 3.59, salePrice: 2.79, incrementalSalePrice: 2.51,
    saleEndDate: '2026-11-03T23:59:59Z',
    name: 'Organic Kids Orange Juice Shot, 1.7 FZ',
    slug: 'kor-shots-organic-kids-orange-juice-shot-17-fz-b0b5k7htwz',
    brand: 'KOR Shots',
    imageThumbnail: 'https://m.media-amazon.com/images/S/assets.wholefoodsmarket.com/PIE/product/41aVKNCW-1L.jpg',
  }, '10346');
  assert.deepEqual(
    {id: sale.id, name: sale.name, size: sale.size, price: sale.price, regularPrice: sale.regularPrice, deal: sale.deal, note: sale.note},
    {id: 'wholefoods:B0B5K7HTWZ:10346', name: 'Organic Kids Orange Juice Shot', size: '1.7 fl oz', price: 2.79, regularPrice: 3.59, deal: 'Prime $2.51', note: 'Sale through Nov 3'},
  );
  assert.match(sale.image, /^https:\/\/m\.media-amazon\.com\//);
  const byWeight = mapProduct({regularPrice: 9.99, name: 'Organic Bananas', slug: 'organic-bananas-b07xyz1234', uom: 'lb'}, '10346');
  assert.equal(byWeight.size, 'per lb');
  assert.equal(mapProduct({regularPrice: 0, name: 'Free', slug: 'x-b000000000'}, '1'), null);
  assert.equal(mapProduct({regularPrice: 2, name: 'Bad image', slug: 'x-b000000001', imageThumbnail: 'https://evil.example/a.jpg'}, '1').image, null);
});

test('Whole Foods products validate input and use the nearest store when none is chosen', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, options});
    if (url.startsWith('https://api.zippopotam.us')) return response({places: [{latitude: '29.60', longitude: '-95.62'}]});
    return response({results: [{regularPrice: 7.99, name: 'Organic Large Grade A Eggs, 12 CT', slug: 'chino-valley-eggs-b00tfxf3g4', brand: 'Chino Valley Ranchers'}]});
  };
  const result = await products({query: 'eggs', zipCode: '77478'}, {}, fetcher);
  assert.match(calls.at(-1).url, /store=10258/); // Sugar Land
  assert.match(calls.at(-1).options.headers['User-Agent'], /StoreScout/);
  assert.equal(result[0].size, '12 ct');
  await assert.rejects(products({query: 'e'}, {}, fetcher), {status: 400});
  await assert.rejects(products({query: 'eggs', locationId: '99999'}, {}, fetcher), {status: 400});
  await assert.rejects(products({query: 'eggs', locationId: '10346'}, {}, async () => response({}, false, 403)), {status: 503});
});
