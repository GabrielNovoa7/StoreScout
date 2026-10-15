const KEY_URL='https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let cache=null;
export function clearKeyCache(){cache=null;}
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function verifyFirebase(token,project,fetcher=fetch,now=Math.floor(Date.now()/1000)) {
 if(!project||typeof token!=='string'||token.length>16384)throw Error('Unauthorized');
 const parts=token.split('.'); if(parts.length!==3||parts.some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))throw Error('Unauthorized');
 const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))), p=JSON.parse(new TextDecoder().decode(decode(parts[1])));
 if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>128||header.crit)throw Error('Unauthorized');
 if(p.aud!==project||p.iss!==`https://securetoken.google.com/${project}`||typeof p.sub!=='string'||!p.sub||p.sub.length>128||p.email_verified!==true||![p.exp,p.iat,p.auth_time].every(Number.isSafeInteger)||p.exp<=now||p.iat>now||p.auth_time>now||p.exp<=p.iat||p.auth_time>p.iat)throw Error('Unauthorized');
 if(!cache||cache.expires<=now){const response=await fetcher(KEY_URL,{redirect:'manual'});if(!response.ok)throw Error('Unauthorized');const body=await response.json();if(!Array.isArray(body.keys)||body.keys.length>20)throw Error('Unauthorized');const maxAge=Number(/max-age=(\d+)/.exec(response.headers.get('cache-control')||'')?.[1]||300);cache={keys:body.keys,expires:now+Math.max(60,Math.min(3600,maxAge))};}
 const jwk=cache.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));if(!jwk)throw Error('Unauthorized');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error('Unauthorized');return {uid:p.sub};
}
