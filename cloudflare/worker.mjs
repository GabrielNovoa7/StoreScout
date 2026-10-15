import {verifyFirebase} from './auth.mjs';
import {Store} from './store.mjs';
import {locations as krogerLocations, products as krogerProducts} from './kroger.mjs';
const ORIGINS=new Set(['https://gabrielnovoa7.github.io','http://localhost:5500','http://127.0.0.1:5500']);
const secret=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function fail(status){throw Object.assign(Error('Request rejected'),{status});}
async function body(request){if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))fail(415);if(Number(request.headers.get('content-length'))>65536)fail(413);const reader=request.body?.getReader();if(!reader)fail(400);let size=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();fail(413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail(400);}}
function object(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail(400);}
function bearer(request){const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(request.headers.get('authorization')||'');if(!match)fail(401);return match[1];}
export function createWorker({verify=verifyFirebase,clock=()=>Math.floor(Date.now()/1000),fetcher=fetch}={}){return {
 async fetch(request,env){const origin=request.headers.get('origin');const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};if(origin&&!ORIGINS.has(origin))return new Response(JSON.stringify({error:'Request rejected'}),{status:403,headers});if(origin)headers['Access-Control-Allow-Origin']=origin;
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(request.method==='OPTIONS'){headers['Access-Control-Allow-Methods']='GET, POST, DELETE, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';headers['Access-Control-Max-Age']='600';return new Response(null,{status:204,headers});}
 try{const path=new URL(request.url).pathname,method=request.method,store=new Store(env.DB),now=clock();
 if(method==='GET'&&path==='/health')return reply({ok:true});
 if(method==='GET'&&path==='/retailers/kroger/locations'){
   const subject=request.headers.get('CF-Connecting-IP')||'anonymous';
   if(!await store.rate(subject,'kroger-locations',30,now))fail(429);
   const zip=new URL(request.url).searchParams.get('zip');
   const limit=new URL(request.url).searchParams.get('limit');
   return reply({retailer:'kroger',locations:await krogerLocations({zipCode:zip,limit},env,fetcher)});
 }
 if(method==='GET'&&path==='/retailers/kroger/products'){
   const subject=request.headers.get('CF-Connecting-IP')||'anonymous';
   if(!await store.rate(subject,'kroger-products',60,now))fail(429);
   const params=new URL(request.url).searchParams;
   return reply({retailer:'kroger',products:await krogerProducts({query:params.get('q'),locationId:params.get('locationId'),limit:params.get('limit')},env,fetcher)});
 }
 if(method==='GET'&&path==='/retailers/compare/stream'){
   const subject=request.headers.get('CF-Connecting-IP')||'anonymous';
   if(!await store.rate(subject,'retailer-compare',30,now))fail(429);
   const params=new URL(request.url).searchParams, query=params.get('q')||'';
   const zip=params.get('zip')||'';
   const stream=new ReadableStream({
     async start(controller){
       const encoder=new TextEncoder();
       const send=value=>controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
       try{
         send({type:'status',retailer:'kroger',message:'Searching Kroger…'});
         const nearby=await krogerLocations({zipCode:zip,limit:1},env,fetcher);
         const locationId=nearby[0]?.id;
         if(!locationId) send({type:'status',retailer:'kroger',message:'No Kroger location found nearby.'});
         else{
           const products=await krogerProducts({query,locationId,limit:20},env,fetcher);
           for(const product of products)send({type:'product',retailer:'kroger',product});
         }
         send({type:'complete',retailer:'kroger',fetchedAt:new Date().toISOString()});
       }catch(error){send({type:'error',retailer:'kroger',message:error.status===400?'Enter a product and valid ZIP code.':'Kroger live search is unavailable.'});}
       finally{controller.close();}
     }
   });
   return new Response(stream,{status:200,headers:{...headers,'Content-Type':'text/event-stream','Connection':'keep-alive','X-Content-Type-Options':'nosniff'}});
 }
 if(method==='POST'&&path==='/pairings/claim'){const b=await body(request);object(b,['code']);if(typeof b.code!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(b.code))fail(401);const credential=secret();if(!await store.claim(await hash(b.code),await hash(credential),now))fail(401);return reply({credential});}
 if(method==='POST'&&path==='/snapshots'){const credential=bearer(request);if(!/^[A-Za-z0-9_-]{43}$/.test(credential))fail(401);const digest=await hash(credential),device=await store.device(digest);if(!device)fail(401);if(!await store.rate(device.uid,'upload',30,now))fail(429);const b=await body(request);object(b,['listName','items']);if(typeof b.listName!=='string'||b.listName.trim().length>100||!Array.isArray(b.items)||b.items.length>200||b.items.some(i=>typeof i!=='string'||!i.trim()||i.trim().length>100))fail(400);const snapshotId=crypto.randomUUID();if(!await store.upload(digest,snapshotId,b.listName.trim(),b.items.map(i=>i.trim()),now))fail(401);return reply({snapshotId});}
 const known=(method==='POST'&&path==='/pairings')||(['GET','DELETE'].includes(method)&&path==='/connection')||(method==='GET'&&path==='/snapshots/latest')||(method==='POST'&&/^\/snapshots\/[0-9a-f-]{36}\/ack$/.test(path));if(!known)fail(404);
 let user;try{user=await verify(bearer(request),env.FIREBASE_PROJECT_ID);}catch{fail(401);}const uid=user.uid;
 if(method==='POST'&&path==='/pairings'){if(!await store.rate(uid,'pairing',5,now))fail(429);const code=secret();await store.pairing(uid,await hash(code),now);return reply({code,expiresAt:new Date((now+600)*1000).toISOString()});}
 if(method==='DELETE'){await store.revoke(uid);return reply({ok:true});}
 if(method==='GET'){if(!await store.rate(uid,'read',120,now))fail(429);if(path==='/connection'){const row=await store.connection(uid);return reply({connected:!!row?.connected,...(row?.last_upload_at?{lastUploadAt:new Date(row.last_upload_at*1000).toISOString()}: {})});}const s=await store.latest(uid,now);return reply({snapshot:s?{snapshotId:s.id,listName:s.list_name,items:JSON.parse(s.items),uploadedAt:new Date(s.uploaded_at*1000).toISOString()}:null});}
 if(!await store.rate(uid,'ack',120,now))fail(429);await store.ack(uid,path.split('/')[2],now);return reply({ok:true});
 }catch(error){return reply({error:error.status===429?'Rate limit exceeded':'Request rejected'},error.status||503);}
 },
 async scheduled(event,env){await new Store(env.DB).cleanup(clock());}
};}
export default createWorker();
