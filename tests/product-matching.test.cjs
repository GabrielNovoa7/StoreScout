const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../model.js');
const C=require('../account-core.js');
test('unrelated saved products are removed without losing groceries or quantities',()=>{
 const item={id:'fish',name:'Fish oil pills',quantity:2,offerId:'beef-w',done:true};
 const data={version:1,items:[item],stores:['heb','walmart'],preferences:{'fish oil pills':'beef-w'}};
 for(const state of [M.restore(JSON.stringify(data)),C.cleanState(data)]){assert.equal(state.items[0].name,'Fish oil pills');assert.equal(state.items[0].quantity,2);assert.equal(state.items[0].offerId,null);assert.equal(state.items[0].done,false);assert.equal(state.preferences['fish oil pills'],undefined);}
});
test('selection checks separate relevant products, unsupported requests and basil forms',()=>{
 assert.equal(M.canSelect('Fish oil pills','beef-w'),false);
 assert.equal(M.canSelect('ground beef','beef-w'),true);
 assert.equal(M.canSelect('fresh basil','basil-d'),false);
 assert.equal(M.canSelect('dried basil','basil'),false);
 assert.equal(M.canSelect('basil leaves','basil-d'),false);
 assert.equal(M.canSelect('fresh basil leaves','basil'),true);
 assert.equal(M.canSelect('basil pesto','basil'),false);
 assert.equal(M.canSelect('fresh basil sauce','basil'),false);
});
test('full catalog product names resolve without accepting unrelated variants',()=>{
 for(const offer of M.catalog.filter(o=>o.id!=='basil-dw'))assert.ok(M.matchOffers(offer.name).some(o=>o.id===offer.id),offer.name);
 for(const request of ['almond milk','skim milk','chicken broth','fish oil pills','basil pesto'])assert.equal(M.matchOffers(request).length,0,request);
});
test('totals and selected counts exclude stale unrelated products',()=>{
 const item={name:'Fish oil pills',quantity:3,offerId:'beef-w',done:true};
 assert.deepEqual(M.summary([item]),{total:0,selected:0,done:0});
});
const vm=require('node:vm'),fs=require('node:fs');
function uiHarness(items,{retailers,stores=['heb','walmart']}={}){
 const handlers={},nodes=new Map();let hooks;
 const get=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',classList:{add(){},remove(){}},addEventListener(){},close(){}});return nodes.get(selector);};
 const account={user:()=>null,locked:()=>false,label:()=>'',render:()=>'',init:h=>hooks=h};
 const state={version:1,items,stores,preferences:{}};
 const location={hash:''};
 const window={Scout:M,ScoutAccount:account,ScoutRetailers:retailers,location,addEventListener(){},scrollTo(){}};
 class FormData{constructor(form){return new Map(Object.entries(form.fields));}}
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8'),{window,location,FormData,document:{querySelector:get,querySelectorAll:()=>[],addEventListener:(type,fn)=>handlers[type]=fn},localStorage:{getItem:()=>JSON.stringify(state),setItem(){}},Intl,crypto:globalThis.crypto,clearTimeout(){},setTimeout:()=>1});
 const click=(action,extra={})=>handlers.click({target:{closest:selector=>selector.startsWith('a[')?null:{dataset:{action,...extra}}}});
 const search=query=>handlers.submit({preventDefault(){},target:{id:'compare-form',fields:{query}}});
 return {click,search,state:()=>hooks.getState(),html:()=>get('#main').innerHTML};
}
test('changing a Compare search cannot bind beef to a fish-oil request',()=>{
 const h=uiHarness([{id:'fish',name:'Fish oil pills',quantity:2,offerId:null,done:false}]);h.click('compare-item',{id:'fish'});h.search('ground beef');assert.ok(!h.html().includes('data-offer="beef-w"'));h.click('select-offer',{offer:'beef-w'});assert.equal(h.state().items[0].offerId,null);assert.equal(h.state().items[0].name,'Fish oil pills');
});
test('explicit basil clarification updates the grocery before accepting a product',()=>{
 const h=uiHarness([{id:'herb',name:'Basil',quantity:2,offerId:null,done:false}]);h.click('compare-item',{id:'herb'});h.click('clarify',{query:'Fresh basil'});h.click('select-offer',{offer:'basil'});assert.equal(h.state().items[0].name,'Fresh basil');assert.equal(h.state().items[0].quantity,2);assert.equal(h.state().items[0].offerId,'basil');assert.equal(h.state().preferences['fresh basil'],'basil');
});
test('selected product and other relevant options render in separate groups',()=>{
 const h=uiHarness([{id:'milk',name:'Milk',quantity:1,offerId:'milk',done:false}]);h.click('compare-item',{id:'milk'});assert.ok(h.html().includes('Your selected product'));assert.ok(h.html().includes('Other relevant options · alternatives'));assert.ok(h.html().indexOf('data-offer="milk"')<h.html().indexOf('Other relevant options · alternatives'));
});
test('adding a dried-basil catalog product records its form instead of ambiguous leaves',()=>{
 const h=uiHarness([]);h.click('select-offer',{offer:'basil-dw'});assert.equal(h.state().items[0].name,'dried basil');assert.equal(C.cleanState(h.state()).items[0].offerId,'basil-dw');
});
test('an explicitly named egg variant does not match another variant',()=>{
 assert.equal(M.canSelect('Large brown eggs','eggs-w'),false);
 assert.equal(M.canSelect('Large brown eggs','eggs'),true);
 assert.equal(M.canSelect('H-E-B Whole milk','milk-w'),false);
});
test('whole-catalog search preserves bananas query and keeps pesto separate',()=>{
 const h=uiHarness([{id:'pesto',name:'Pesto Sauce',quantity:1,offerId:null,done:false}]);h.click('compare-item',{id:'pesto'});h.search('yellow Bananas');assert.ok(h.html().includes('Search whole catalog'));assert.ok(!h.html().includes('data-offer="banana"'));h.click('clear-active');assert.ok(h.html().includes('value="yellow Bananas"'));assert.ok(h.html().includes('data-offer="banana"'));assert.ok(!h.html().includes('Picking for'));h.click('select-offer',{offer:'banana'});assert.equal(h.state().items.length,2);assert.equal(h.state().items[0].offerId,null);assert.equal(h.state().items[0].name,'Pesto Sauce');assert.equal(h.state().items[1].offerId,'banana');
});

test('Kroger selection survives account serialization and renders a live store card',()=>{
 const state={version:1,items:[],stores:['kroger'],preferences:{}};
 assert.deepEqual(C.cleanState(state).stores,['kroger']);
 const h=uiHarness([]);h.click('toggle-store',{store:'kroger'});
 assert.ok(h.state().stores.includes('kroger'));
 h.click('browse-store',{store:'kroger'});
 assert.match(h.html(),/data-store="kroger"/);
 assert.doesNotMatch(h.html(),/Showing Kroger sample products/);
});

const krogerMilk={id:'kroger:0001111041700:03400355',retailer:'kroger',productId:'0001111041700',upc:'0001111041700',name:'Kroger® 2% Reduced Fat Milk Gallon',brand:'Kroger',size:'1 gal',price:3.09,regularPrice:3.29,unitPrice:null,unit:null,available:true,locationId:'03400355',source:'Kroger API',fetchedAt:'2026-10-15T08:41:24.741Z'};
const fakeRetailers=products=>({enabled:true,async streamKroger(query,onProduct,onStatus){onStatus('Searching Kroger…');for(const p of products)onProduct(p);}});
const settle=()=>new Promise(r=>setImmediate(r));

test('live Kroger snapshots are validated before they can price an item',()=>{
 const item={id:'k',name:'Milk',quantity:2,offerId:krogerMilk.id,live:krogerMilk,done:true};
 assert.equal(M.selectedOffer(item).price,3.09);
 assert.deepEqual(M.summary([item]),{total:6.18,selected:1,done:1});
 assert.equal(M.cleanSelection(item).live.productId,'0001111041700');
 for(const bad of [{...krogerMilk,price:-1},{...krogerMilk,id:'kroger:<x>:1'},{...krogerMilk,retailer:'heb'},{...krogerMilk,name:''}]){
  const cleaned=M.cleanSelection({...item,live:bad});assert.equal(cleaned.offerId,null);assert.equal(cleaned.live,undefined);assert.equal(M.selectedOffer({...item,live:bad}),null);
 }
 const mismatched=M.cleanSelection({...item,offerId:'milk'});assert.equal(mismatched.live,undefined);assert.equal(mismatched.offerId,'milk');
});

test('a streamed Kroger product can be added, saved to the account shape, and shopped',async()=>{
 const h=uiHarness([],{retailers:fakeRetailers([krogerMilk]),stores:['kroger','heb','walmart']});
 h.click('navigate',{view:'compare'});h.search('milk');await settle();
 assert.match(h.html(),/Live Kroger results/);
 assert.match(h.html(),/data-action="select-live"/);
 assert.match(h.html(),/\$3\.29/);
 h.click('select-live',{live:krogerMilk.id});
 const item=h.state().items[0];
 assert.equal(item.offerId,krogerMilk.id);
 const saved=C.cleanState({...h.state(),profile:undefined});
 assert.equal(saved.items[0].live.price,3.09);assert.deepEqual(saved.stores,['kroger','heb','walmart']);
 h.click('navigate',{view:'shopping'});
 assert.match(h.html(),/River Oaks/);assert.match(h.html(),/Kroger® 2% Reduced Fat Milk Gallon/);
});

test('a Kroger pick for an existing grocery keeps its name and can be replaced by a sample pick',async()=>{
 const h=uiHarness([{id:'milk',name:'Milk',quantity:1,offerId:null,done:false}],{retailers:fakeRetailers([krogerMilk]),stores:['kroger','heb','walmart']});
 h.click('compare-item',{id:'milk'});await settle();
 h.click('select-live',{live:krogerMilk.id});
 assert.equal(h.state().items[0].name,'Milk');assert.equal(M.selectedOffer(h.state().items[0]).storeId,'kroger');
 h.click('select-offer',{offer:'milk'});
 assert.equal(h.state().items[0].offerId,'milk');assert.equal(h.state().items[0].live,undefined);
});
