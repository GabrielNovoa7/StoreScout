const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Firebase restores a tab session and signs out through the SDK without app-managed token storage',async()=>{
 const session={type:'SESSION'},memory={type:'NONE'};let options,logout=false,seen;
 const user={uid:'alice',email:'demo@example.com',emailVerified:true};
 const authSDK={browserSessionPersistence:session,inMemoryPersistence:memory,initializeAuth:(app,config)=>{options=config;return{currentUser:user};},validatePassword:async()=>({isValid:true}),onAuthStateChanged:(auth,cb)=>{cb(auth.currentUser);return()=>{};},signOut:async auth=>{auth.currentUser=null;logout=true;}};
 const dbSDK={initializeFirestore:()=>({}),memoryLocalCache:()=>({})};
 const window={};const loadSDK=async url=>url.endsWith('firebase-app.js')?{initializeApp:()=>({})}:url.endsWith('firebase-auth.js')?authSDK:dbSDK;
 const source=fs.readFileSync(require('node:path').join(__dirname,'../firebase-client.js'),'utf8').replaceAll('import(base+', 'loadSDK(base+');
 vm.runInNewContext(source,{window,loadSDK,console});const client=await window.ScoutFirebase.connect({},next=>seen=next);assert.equal(options.persistence,session);assert.equal(seen.uid,'alice');await client.logout();assert.equal(logout,true);
});
test('connection waits for Firebase to report the restored session before exposing guest mode',async()=>{
 let observer,release;const observerReady=new Promise(resolve=>release=resolve);const window={};
 const authSDK={browserSessionPersistence:{type:'SESSION'},initializeAuth:()=>({}),validatePassword:async()=>({isValid:true}),onAuthStateChanged:(auth,cb)=>{observer=cb;release();return()=>{};}};
 const loadSDK=async url=>url.endsWith('firebase-app.js')?{initializeApp:()=>({})}:url.endsWith('firebase-auth.js')?authSDK:{initializeFirestore:()=>({}),memoryLocalCache:()=>({})};
 const source=fs.readFileSync(require('node:path').join(__dirname,'../firebase-client.js'),'utf8').replaceAll('import(base+', 'loadSDK(base+');vm.runInNewContext(source,{window,loadSDK,console});let connected=false;const pending=window.ScoutFirebase.connect({},()=>{}).then(()=>connected=true);await observerReady;await new Promise(setImmediate);assert.equal(connected,false);observer(null);await pending;assert.equal(connected,true);
});
