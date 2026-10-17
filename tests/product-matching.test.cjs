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
function uiHarness(items,{retailers,photos,stores=['heb','walmart'],realStatus=false}={}){
 // Sample-catalog tests keep every store active; realStatus uses the shipped store status.
 const Scout=realStatus?M:{...M,stores:M.stores.map(s=>({...s,status:'active'}))};
 const handlers={},nodes=new Map();let hooks;
 const get=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',classList:{add(){},remove(){}},addEventListener(){},close(){}});return nodes.get(selector);};
 const account={user:()=>null,locked:()=>false,label:()=>'',render:()=>'',init:h=>hooks=h};
 const state={version:1,items,stores,preferences:{}};
 const location={hash:''};
 const window={Scout,ScoutAccount:account,ScoutRetailers:retailers,ScoutPhotos:photos,location,addEventListener(){},scrollTo(){},STORE_SCOUT_RETAILERS:{zipCode:'77019'}};
 class FormData{constructor(form){return new Map(Object.entries(form.fields));}}
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8'),{window,location,FormData,document:{querySelector:get,querySelectorAll:()=>[],addEventListener:(type,fn)=>handlers[type]=fn},localStorage:{getItem:()=>JSON.stringify(state),setItem(){}},Intl,crypto:globalThis.crypto,clearTimeout(){},setTimeout:()=>1});
 const click=(action,extra={})=>handlers.click({target:{closest:selector=>selector.startsWith('a[')?null:{dataset:{action,...extra}}}});
 const search=query=>handlers.submit({preventDefault(){},target:{id:'compare-form',fields:{query}}});
 const findStores=zip=>handlers.submit({preventDefault(){},target:{id:'location-form',fields:{zip}}});
 const change=(id,value,checked)=>handlers.change({target:{id,value,checked,dataset:{}}});
 return {click,search,findStores,change,state:()=>hooks.getState(),html:()=>get('#main').innerHTML};
}
test('changing a Compare search cannot bind beef to a fish-oil request',()=>{
 const h=uiHarness([{id:'fish',name:'Fish oil pills',quantity:2,offerId:null,done:false}]);h.click('compare-item',{id:'fish'});h.search('ground beef');assert.ok(!h.html().includes('Picking for'));h.click('select-offer',{offer:'beef-w'});assert.equal(h.state().items[0].offerId,null);assert.equal(h.state().items[0].name,'Fish oil pills');assert.equal(h.state().items[1].offerId,'beef-w');
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
test('a search for something else leaves pesto picking and keeps the bananas query and keeps pesto separate',()=>{
 const h=uiHarness([{id:'pesto',name:'Pesto Sauce',quantity:1,offerId:null,done:false}]);h.click('compare-item',{id:'pesto'});h.search('yellow Bananas');assert.ok(h.html().includes('value="yellow Bananas"'));assert.ok(h.html().includes('data-offer="banana"'));assert.ok(!h.html().includes('Picking for'));h.click('select-offer',{offer:'banana'});assert.equal(h.state().items.length,2);assert.equal(h.state().items[0].offerId,null);assert.equal(h.state().items[0].name,'Pesto Sauce');assert.equal(h.state().items[1].offerId,'banana');
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
const riverOaks={id:'03400355',name:'Kroger - River Oaks',address:'1938 W Gray St, Houston, TX',distanceMiles:null};
const fakeRetailers=(products,{locations=[riverOaks],calls=[]}={})=>({enabled:true,available:id=>id==='kroger',async locations(id,zip){calls.push(['locations',id,zip]);return locations;},async search(id,query,opts,onProduct,onStatus){calls.push(['search',id,query,opts]);onStatus('Searching…');for(const p of products)onProduct(p);}});
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
 assert.match(h.html(),/Live results for/);
 assert.match(h.html(),/data-action="select-live"/);
 assert.match(h.html(),/\$3\.29/);
 h.click('select-live',{live:krogerMilk.id});
 const item=h.state().items[0];
 assert.equal(item.offerId,krogerMilk.id);
 const saved=C.cleanState({...h.state(),profile:undefined});
 assert.equal(saved.items[0].live.price,3.09);assert.deepEqual(saved.stores,['kroger','heb','walmart']);
 h.click('navigate',{view:'shopping'});
 assert.match(h.html(),/Nearest store to 77019/);assert.match(h.html(),/Kroger® 2% Reduced Fat Milk Gallon/);
});

test('a Kroger pick for an existing grocery keeps its name and can be replaced by a sample pick',async()=>{
 const h=uiHarness([{id:'milk',name:'Milk',quantity:1,offerId:null,done:false}],{retailers:fakeRetailers([krogerMilk]),stores:['kroger','heb','walmart']});
 h.click('compare-item',{id:'milk'});await settle();
 h.click('select-live',{live:krogerMilk.id});
 assert.equal(h.state().items[0].name,'Milk');assert.equal(M.selectedOffer(h.state().items[0]).storeId,'kroger');
 h.click('select-offer',{offer:'milk'});
 assert.equal(h.state().items[0].offerId,'milk');assert.equal(h.state().items[0].live,undefined);
});

const krogerSoy=[
 {...krogerMilk,id:'kroger:1:03400355',productId:'1',name:'Kikkoman Soy Sauce',brand:'Kikkoman',size:'20 fl oz',price:5.49,regularPrice:5.49},
 {...krogerMilk,id:'kroger:2:03400355',productId:'2',name:'Kroger Less Sodium Soy Sauce',brand:'Kroger',size:'10 fl oz',price:1.49,regularPrice:1.99},
 {...krogerMilk,id:'kroger:3:03400355',productId:'3',name:'Kikkoman Less Sodium Soy Sauce',brand:'Kikkoman',size:'40 fl oz',price:8.99,regularPrice:8.99},
];
const order=html=>[...html.matchAll(/data-live="([^"]+)"/g)].map(m=>m[1].split(':')[1]);

test('live results sort by price, unit price and name, and filter by brand or sale',async()=>{
 const h=uiHarness([],{retailers:fakeRetailers(krogerSoy),stores:['kroger']});
 h.click('navigate',{view:'compare'});h.search('soy sauce');await settle();
 assert.deepEqual(order(h.html()),['2','1','3']);
 h.change('sort','price-desc');assert.deepEqual(order(h.html()),['3','1','2']);
 h.change('sort','unit');assert.deepEqual(order(h.html()),['2','3','1']);
 h.change('sort','name');assert.deepEqual(order(h.html()),['3','1','2']);
 assert.match(h.html(),/\$0\.15 \/ fl oz/);
 h.change('live-brand','Kikkoman');assert.deepEqual(order(h.html()).sort(),['1','3']);
 h.change('live-brand','');h.change('live-sale','',true);assert.deepEqual(order(h.html()),['2']);
});

test('choosing a store location is saved and used for live searches',async()=>{
 const calls=[];
 const h=uiHarness([],{retailers:fakeRetailers([krogerMilk],{calls}),stores:['kroger','heb']});
 h.click('navigate',{view:'stores'});h.findStores('77005');await settle();
 assert.deepEqual(calls[0],['locations','kroger','77005']);
 assert.match(h.html(),/Kroger - River Oaks/);assert.match(h.html(),/Location search coming soon/);
 h.click('choose-location',{store:'kroger',location:'03400355'});
 assert.deepEqual(h.state().locations.kroger,{id:'03400355',name:'Kroger - River Oaks',address:'1938 W Gray St, Houston, TX'});
 assert.deepEqual(C.cleanState({...h.state(),profile:undefined}).locations.kroger.id,'03400355');
 h.click('navigate',{view:'compare'});h.search('milk');await settle();
 assert.equal(JSON.stringify(calls.at(-1)),JSON.stringify(['search','kroger','milk',{locationId:'03400355',zip:'77005'}]));
 h.click('clear-location',{store:'kroger'});assert.equal(h.state().locations.kroger,undefined);
});

test('stored locations are validated and pilot wording is gone',()=>{
 assert.deepEqual(M.cleanLocations({kroger:{id:'bad id!',name:'x'},walmart:{id:'5959',name:'Walmart Heights'},target:{id:'1'}}),{walmart:{id:'5959',name:'Walmart Heights',address:''}});
 const h=uiHarness([],{retailers:fakeRetailers([]),stores:['kroger','heb','walmart']});
 for(const view of ['list','compare','shopping','stores']){h.click('navigate',{view});assert.doesNotMatch(h.html(),/pilot|Houston|illustrative/i,view);}
});

test('coming-soon stores are hidden from comparisons and shopping but keep saved picks',async()=>{
 const items=[{id:'eggs',name:'Eggs',quantity:1,offerId:'eggs-w',done:false},{id:'k',name:'Milk',quantity:1,offerId:krogerMilk.id,live:krogerMilk,done:false}];
 const h=uiHarness(items,{retailers:fakeRetailers([krogerMilk]),stores:['kroger','heb','walmart'],realStatus:true});
 h.click('navigate',{view:'compare'});
 assert.doesNotMatch(h.html(),/data-store="heb"/);assert.doesNotMatch(h.html(),/data-offer=/);
 assert.match(h.html(),/Search for a product to see live prices/);
 h.click('navigate',{view:'shopping'});
 assert.match(h.html(),/Kroger · 1 gal · Qty 1/);assert.doesNotMatch(h.html(),/<h2>(Walmart|H-E-B)<\/h2>/);
 assert.match(h.html(),/1 still needs a product/);
 h.click('navigate',{view:'stores'});
 assert.match(h.html(),/Coming soon/);assert.match(h.html(),/H-E-B<\/h3>/);assert.doesNotMatch(h.html(),/Walmart<\/h3>/);assert.match(h.html(),/<h2>Walmart<\/h2>/);assert.doesNotMatch(h.html(),/Sellers Bros\.<\/h3>/);assert.match(h.html(),/<h2>Sellers Bros\.<\/h2>/);assert.match(h.html(),/Also covers Ralphs/);
 h.click('toggle-store',{store:'heb'});assert.ok(h.state().stores.includes('heb'));
 assert.equal(h.state().items[0].offerId,'eggs-w');
});

const OFF_IMG='https://images.openfoodfacts.org/images/products/001/111/041/7008/front_en.10.200.jpg';
test('Open Food Facts photos appear on live results and stay with a saved pick',async()=>{
 const photos={async lookup(products){return new Map(products.map(p=>[p.id,OFF_IMG]));}};
 const h=uiHarness([],{retailers:fakeRetailers([krogerMilk]),photos,stores:['kroger'],realStatus:true});
 h.click('navigate',{view:'compare'});h.search('milk');await settle();await settle();
 assert.match(h.html(),/class="live-photo" src="https:\/\/images\.openfoodfacts\.org/);
 h.click('select-live',{live:krogerMilk.id});
 assert.equal(h.state().items[0].live.image,OFF_IMG);
 h.click('navigate',{view:'shopping'});assert.match(h.html(),/class="product-photo"/);
});
test('products that already carry a retailer photo skip the Open Food Facts lookup',async()=>{
 require('../product-photos.js');const P=globalThis.ScoutPhotos;
 const calls=[];const saved=globalThis.fetch;globalThis.fetch=async(url)=>{calls.push(url);return {ok:true,async json(){return {products:[]};}};};
 try{await P.lookup([{...krogerMilk,image:'https://www.kroger.com/product/images/large/front/0001111041700'}]);}finally{globalThis.fetch=saved;}
 assert.equal(calls.length,0);
});
test('photo barcodes convert Kroger UPCs and reject invalid codes',()=>{
 require('../product-photos.js');const P=globalThis.ScoutPhotos;
 assert.equal(P.barcodeFor({retailer:'kroger',upc:'0004139000105'}),'041390001055');
 assert.equal(P.barcodeFor({retailer:'kroger',upc:'0001111041700'}),'011110417008');
 assert.equal(P.barcodeFor({retailer:'walmart',upc:'041390001055'}),'041390001055');
 assert.equal(P.barcodeFor({retailer:'walmart',upc:'041390001054'}),null);
 assert.equal(M.cleanLive({...krogerMilk,image:'https://evil.example/x.jpg'}).image,null);
 const KROGER_IMG='https://www.kroger.com/product/images/large/front/0001111041700';
 assert.equal(M.cleanLive({...krogerMilk,image:KROGER_IMG}).image,KROGER_IMG);
 assert.equal(M.cleanLive({...krogerMilk,image:'https://www.kroger.com/product/images/large/front/../x'}).image,null);
 assert.equal(M.cleanLive({...krogerMilk,image:'https://i5.walmartimages.com/asr/abc.jpeg'}).image,'https://i5.walmartimages.com/asr/abc.jpeg');
});

test('an empty weekly-ad search explains that the ad only lists sale items',async()=>{
 const retailers={enabled:true,available:id=>id==='kroger'||id==='sellers',async locations(){return [];},
  async search(id,q,opts,onProduct){if(id==='kroger')onProduct(krogerMilk);}};
 const h=uiHarness([],{retailers,stores:['kroger','sellers'],realStatus:true});
 h.click('navigate',{view:'compare'});h.search('milk');await settle();
 assert.match(h.html(),/Sellers Bros\.: no “milk” in this week’s ad/);
 const only=uiHarness([],{retailers,stores:['sellers'],realStatus:true});
 only.click('navigate',{view:'compare'});only.search('eggs');await settle();
 assert.match(only.html(),/No “eggs” in this week’s Sellers Bros\. ad/);
});

test('search relevance ranks products by what they are, not words they mention',()=>{
 const best=(q,n)=>M.relevance(q,{name:n});
 for(const n of ['Kroger® Grade A Jumbo White Eggs','Simple Truth™ Natural Cage Free Grade A Large Brown Eggs','Liquid Whole Eggs','Organic Large Grade A Eggs, 12 CT'])assert.equal(best('eggs',n),2,n);
 for(const n of ['Organic Easter Egg Radish','Chung’s Egg Rolls','Wide Egg Noodles','Kale and Spinach Egg Bites with Egg White'])assert.equal(best('eggs',n),1,n);
 assert.equal(best('eggs',"Kellogg's Eggo Waffles"),0);assert.equal(best('eggs',"Nellie's Free Range Eggs Large"),2);
 assert.equal(best('chicken','Chicken Breast'),2);assert.equal(best('chicken','Chicken Broth'),1);
 assert.equal(best('milk','Milk Chocolate Bar'),1);assert.equal(best('milk','2% Reduced Fat Milk Gallon'),2);
 assert.equal(best('orange juice','Orange Soda'),0);assert.equal(best('orange juice','Simply Orange Juice'),2);
});

test('live results show best matches first and fold related items behind a toggle',async()=>{
 const mk=(n,name,price)=>({...krogerMilk,id:`kroger:${n}:03400355`,productId:String(n),name,price,regularPrice:price,brand:'Kroger'});
 const items=[mk(1,'Wide Egg Noodles',3.39),mk(2,'Kroger Grade A Large White Eggs',2.49),mk(3,'Organic Easter Egg Radish',2.49),mk(4,'Kroger Jumbo White Eggs',2.09)];
 const h=uiHarness([],{retailers:fakeRetailers(items),stores:['kroger'],realStatus:true});
 h.click('navigate',{view:'compare'});h.search('eggs');await settle();
 assert.deepEqual(order(h.html()),['4','2']);
 assert.match(h.html(),/Show 2 related items/);
 h.click('toggle-related');
 assert.deepEqual(order(h.html()),['4','2','3','1']);
 assert.match(h.html(),/Hide 2 related items/);
});

test('an item fits only products that name all of its important words',()=>{
 assert.equal(M.fitsItem('Milk',{name:'Kroger® 2% Reduced Fat Milk Gallon'}),true);
 assert.equal(M.fitsItem('Milk',{name:'peanuts'}),false);
 assert.equal(M.fitsItem('Gluten free tortillas',{name:'Mission Gluten Free Soft Taco Tortillas, 6 ct'}),true);
 assert.equal(M.fitsItem('Gluten free tortillas',{name:'tortilla'}),false);
 assert.equal(M.fitsItem('Gluten free tortillas',{name:'Mission Flour Tortillas'}),false);
 assert.equal(M.fitsItem('Eggs, 12 count',{name:'Large White Eggs'}),true);
 assert.equal(M.fitsItem('Oreo cookies',{name:'Chocolate Sandwich Cookies',brand:'Oreo'}),true);
});

const krogerPeanuts={...krogerMilk,id:'kroger:0001111000001:03400355',productId:'0001111000001',upc:'0001111000001',name:'Kroger Dry Roasted Peanuts',size:'16 oz',price:2.49,regularPrice:2.49};
test('searching peanuts while picking milk adds peanuts as their own item',async()=>{
 const h=uiHarness([{id:'milk',name:'Milk',quantity:1,offerId:null,done:false}],{retailers:fakeRetailers([krogerPeanuts]),stores:['kroger','heb','walmart']});
 h.click('compare-item',{id:'milk'});await settle();
 h.search('peanuts');await settle();
 assert.ok(!h.html().includes('Picking for'));
 h.click('select-live',{live:krogerPeanuts.id});
 assert.equal(h.state().items[0].name,'Milk');assert.equal(h.state().items[0].offerId,null);
 assert.equal(h.state().items[1].offerId,krogerPeanuts.id);
});
test('dropping "gluten free" from the search stops picking for gluten-free tortillas',async()=>{
 const flour={...krogerPeanuts,id:'kroger:0001111000002:03400355',productId:'0001111000002',upc:'0001111000002',name:'Kroger Flour Tortillas',size:'10 ct'};
 const h=uiHarness([{id:'gf',name:'Gluten free tortillas',quantity:1,offerId:null,done:false}],{retailers:fakeRetailers([flour]),stores:['kroger','heb','walmart']});
 h.click('compare-item',{id:'gf'});await settle();
 h.click('select-live',{live:flour.id});
 assert.equal(h.state().items[0].offerId,null);assert.equal(h.state().items.length,1);
 h.search('tortilla');await settle();
 assert.ok(!h.html().includes('Picking for'));
 h.click('select-live',{live:flour.id});
 assert.equal(h.state().items[0].offerId,null);assert.equal(h.state().items[1].offerId,flour.id);
});

test('old sample Walmart picks stay hidden now that Walmart has live prices',()=>{
 const h=uiHarness([{id:'eggs',name:'Eggs',quantity:1,offerId:'eggs-w',done:false}],{stores:['walmart']});
 h.click('navigate',{view:'shopping'});
 assert.doesNotMatch(h.html(),/<h2>Walmart<\/h2>/);assert.equal(h.state().items[0].offerId,'eggs-w');
});
test('Clear list empties the list and Undo brings every item back',()=>{
 const h=uiHarness([{id:'a',name:'Milk',quantity:1,offerId:null,done:false},{id:'b',name:'Eggs',quantity:2,offerId:null,done:false}]);
 assert.match(h.html(),/data-action="clear-list"/);
 h.click('clear-list');assert.equal(h.state().items.length,0);assert.doesNotMatch(h.html(),/data-action="clear-list"/);
 h.click('undo');assert.equal(h.state().items.map(i=>i.name).join(','),'Milk,Eggs');
});
test("Sam's Club, Costco and Aldi are listed as coming soon",()=>{
 const h=uiHarness([],{realStatus:true});h.click('navigate',{view:'stores'});
 for(const name of ["Sam&#39;s Club",'Costco','Aldi'])assert.match(h.html(),new RegExp(`<h3>${name}</h3>`));
 assert.ok(!M.stores.find(s=>s.id==='costco').live);
});
test('store cards and the sidebar show an Active or Not active status',()=>{
 const h=uiHarness([],{retailers:fakeRetailers([]),stores:['kroger'],realStatus:true});h.click('navigate',{view:'stores'});
 assert.match(h.html(),/<h2>Kroger<\/h2><span class="store-status is-active">/);
 assert.match(h.html(),/<h2>Whole Foods<\/h2><span class="store-status ">/);
 assert.match(h.html(),/<h3>Costco<\/h3><span class="store-status ">/);
});
