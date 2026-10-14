const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../model.js');
const M = fs.existsSync(file) ? require(file) : {};
test('basil requests require a form and do not match pesto', () => {
  assert.equal(typeof M.matchOffers, 'function');
  assert.equal(M.intent('basil').needsForm, true);
  const offers = M.matchOffers('fresh basil');
  assert.ok(offers.length > 1);
  assert.ok(offers.every(o => o.category === 'fresh basil'));
  assert.ok(M.matchOffers('dried basil').every(o => o.category === 'dried basil'));
  assert.equal(M.matchOffers('basil pesto').length, 0);
});
test('unit-price sorting uses comparable package contents', () => {
  assert.equal(typeof M.sortOffers, 'function');
  const offers = [{price:3,amount:1,unit:'oz'}, {price:5,amount:4,unit:'oz'}];
  assert.equal(M.sortOffers(offers, 'unit')[0].price, 5);
  assert.equal(M.sortOffers(offers, 'price')[0].price, 3);
  assert.equal(offers[0].price, 3);
});
test('restoring malformed local data produces a valid starter state', () => {
  assert.equal(typeof M.restore, 'function');
  for (const value of ['broken', 'null', '{"version":1,"items":[null]}', '{"version":1,"items":[]}']) {
    const state = M.restore(value);
    assert.ok(Array.isArray(state.items));
    assert.ok(Array.isArray(state.stores));
  }
});
test('totals include quantity and keep duplicate requests independent', () => {
  assert.equal(typeof M.summary, 'function');
  const offer = M.catalog.find(o => o.available !== false);
  const items = [{id:'a',name:'eggs',quantity:2,offerId:offer.id,done:false}, {id:'b',name:'eggs',quantity:1,offerId:offer.id,done:true}];
  assert.equal(M.summary(items).total, offer.price * 3);
  assert.equal(M.summary(items).done, 1);
  assert.equal(M.summary([{id:'c', name:'rice',quantity:1,offerId:null}]).total, 0);
});
