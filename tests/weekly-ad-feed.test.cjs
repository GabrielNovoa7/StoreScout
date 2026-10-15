const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../model.js');

const feed={retailer:'sellers',validFrom:'2026-10-14',validTo:'2026-10-20',fetchedAt:'2026-10-15T09:00:00+00:00',
 stores:[{id:'sb-8011-elvera',name:'Sellers Bros. - 8011 Elvera',address:'8011 Elvera, Houston, TX 77012',zip:'77012'},
         {id:'sb-2311-strawberry',name:'Sellers Bros. - 2311 Strawberry',address:'2311 Strawberry, Pasadena, TX 77502',zip:'77502'}],
 products:[
  {productId:'a1b2c3d4e5f6',name:'Chicken Breast',details:'Family Pack · Boneless',price:1.77,deal:null,unit:'lb'},
  {productId:'0f9e8d7c6b5a',name:'Limes',details:'',price:0.11,deal:'18 for $1.99',unit:'each'},
  {productId:'123456abcdef',name:'Goya Beans',details:'Select Varieties · 15.5 oz.',price:2.5,deal:'2 for $5.00',unit:'each'},
  {productId:'aaaaaa111111',name:"Kellogg's Eggo Waffles",details:'Select Varieties · 24 ct.',price:1.99,deal:null,unit:'each'},
  {productId:'bbbbbb222222',name:'Tomatoes On the Vine',details:'16 oz. Bag Fresh',price:1.97,deal:null,unit:'each'},
 ]};

function client(){
 const calls=[];
 const root={STORE_SCOUT_RETAILERS:{enabled:true,workerUrl:'https://worker.example',adapters:['kroger'],feeds:{sellers:'data/sellers-weekly.json'}}};
 const fetch=async url=>{calls.push(String(url));return {ok:true,json:async()=>feed};};
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../retailer-client.js'),'utf8'),{window:root,fetch,URLSearchParams,TextDecoder,Uint8Array});
 return {R:root.ScoutRetailers,calls};
}

test('weekly-ad feed search matches words, plurals and accents, without the Worker',async()=>{
 const {R,calls}=client();
 assert.equal(R.available('sellers'),true);
 const found=[];await R.search('sellers','lime',{},p=>found.push(p));
 assert.deepEqual(found.map(p=>p.name),['Limes']);
 assert.equal(found[0].deal,'18 for $1.99');
 assert.match(found[0].note,/Weekly ad/);
 const chicken=[];await R.search('sellers','boneless chicken',{locationId:'sb-8011-elvera'},p=>chicken.push(p));
 assert.equal(chicken[0].id,'sellers:a1b2c3d4e5f6:sb8011elvera');
 assert.equal(chicken[0].size,'per lb');
 const beans=[];await R.search('sellers','goya',{},p=>beans.push(p));
 assert.equal(beans[0].size,'15.5 oz.');
 assert.ok(calls.every(u=>u==='data/sellers-weekly.json'));
 assert.equal(calls.length,1,'feed is fetched once and cached');
});

test('weekly-ad locations list the closest ZIP first',async()=>{
 const {R}=client();
 const locs=await R.locations('sellers','77503');
 assert.equal(locs[0].id,'sb-2311-strawberry');
});

test('a weekly-ad pick keeps its deal and is saved with a valid id',async()=>{
 const {R}=client();
 const found=[];await R.search('sellers','goya beans',{},p=>found.push(p));
 const live=M.cleanLive(found[0]);
 assert.equal(live.deal,'2 for $5.00');
 const item={id:'x',name:'Goya Beans',quantity:2,offerId:live.id,live,done:false};
 assert.equal(M.selectedOffer(item).storeId,'sellers');
 assert.equal(M.summary([item]).total,5);
});

test('weekly-ad search matches whole words, not word starts',async()=>{
 const {R}=client();
 const run=async q=>{const out=[];await R.search('sellers',q,{},p=>out.push(p.name));return out;};
 assert.deepEqual(await run('eggs'),[]);
 assert.deepEqual(await run('egg'),[]);
 assert.deepEqual(await run('eggo'),["Kellogg's Eggo Waffles"]);
 assert.deepEqual(await run('tomato'),['Tomatoes On the Vine']);
 assert.deepEqual(await run('limes'),['Limes']);
 assert.deepEqual(await run('chick'),[]);
});

test('a Whole Foods pick keeps its Amazon-hosted photo, sale price and Prime deal',()=>{
 const live=M.cleanLive({id:'wholefoods:B00TFXF3G4:10346',retailer:'wholefoods',productId:'B00TFXF3G4',name:'Organic Large Grade A Eggs',
  brand:'Chino Valley Ranchers',size:'12 ct',price:7.49,regularPrice:7.99,deal:'Prime $6.74',locationId:'10346',
  image:'https://m.media-amazon.com/images/S/assets.wholefoodsmarket.com/PIE/product/41z-lCjam0L.jpg',fetchedAt:'2026-10-15T10:00:00Z'});
 assert.ok(live);assert.equal(live.deal,'Prime $6.74');assert.match(live.image,/^https:\/\/m\.media-amazon\.com\//);
 const offer=M.selectedOffer({id:'x',name:'Eggs',quantity:1,offerId:live.id,live,done:false});
 assert.equal(offer.storeId,'wholefoods');assert.equal(offer.price,7.49);assert.equal(offer.unit,'ct');
});
