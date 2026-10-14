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
function uiHarness(items){
 const handlers={},nodes=new Map();let hooks;
 const get=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',classList:{add(){},remove(){}},addEventListener(){},close(){}});return nodes.get(selector);};
 const account={user:()=>null,locked:()=>false,label:()=>'',render:()=>'',init:h=>hooks=h};
 const state={version:1,items,stores:['heb','walmart'],preferences:{}};
 const location={hash:''};
 const window={Scout:M,ScoutAccount:account,location,addEventListener(){},scrollTo(){}};
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
