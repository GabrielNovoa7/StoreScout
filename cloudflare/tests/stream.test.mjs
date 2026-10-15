import test from 'node:test';
import assert from 'node:assert/strict';
import {clearTokenCache} from '../kroger.mjs';
import {createWorker} from '../worker.mjs';

function database(){
  return {prepare(){return {bind(){return {async first(){return {count:1};}};}};},async batch(){return [{results:[]}];}};
}

test('comparison stream emits status, products, and completion events', async()=>{
  clearTokenCache();
  const calls=[];
  const fetcher=async(url)=>{
    calls.push(url);
    if(url.includes('/oauth2/token'))return new Response(JSON.stringify({access_token:'token',expires_in:3600}),{status:200});
    if(url.includes('/locations'))return new Response(JSON.stringify({data:[{locationId:'12345',name:'Kroger'}]}),{status:200});
    return new Response(JSON.stringify({data:[{productId:'p1',description:'Whole Milk',items:[{price:{regular:4.99}}]}]}),{status:200});
  };
  const worker=createWorker({fetcher});
  const response=await worker.fetch(new Request('https://inbox.example/retailers/compare/stream?q=milk&zip=77019'),{DB:database(),KROGER_CLIENT_ID:'id',KROGER_CLIENT_SECRET:'secret'});
  assert.equal(response.headers.get('content-type'),'text/event-stream');
  const text=await response.text();
  assert.match(text,/"type":"status"/);
  assert.match(text,/"type":"product"/);
  assert.match(text,/"name":"Whole Milk"/);
  assert.match(text,/"type":"complete"/);
  assert.ok(calls.some(url=>url.includes('/locations')));
});
