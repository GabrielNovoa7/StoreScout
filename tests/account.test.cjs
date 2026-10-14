const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../model.js');
const A = fs.existsSync(require('node:path').join(__dirname,'../account-core.js')) ? require('../account-core.js') : {};
const empty=()=>({version:1,items:[],stores:['heb','walmart'],preferences:{}});
test('signup requires 9 characters, uppercase, lowercase and a digit',()=>{
  assert.equal(typeof A.passwordIssues,'function');
  assert.deepEqual(A.passwordIssues('A sufficiently long password 7'),[]);
  assert.deepEqual(A.passwordIssues('ValidPw7A'),[]);
  for(const p of ['Short7A','alllowercasepassword7','ALLUPPERCASEPASSWORD7','NoDigitsInThisPassword'])assert.ok(A.passwordIssues(p).length);
});
test('live password indicators report missing and complete requirements independently',()=>{
  assert.equal(typeof A.passwordChecks,'function');
  assert.ok(A.passwordChecks('ValidPw7A').every(check=>check.passed));
  assert.ok(A.passwordChecks('').every(check=>!check.passed));
  const checks=A.passwordChecks('UPPERCASE123');
  assert.equal(checks.find(check=>check.id==='length').passed,true);
  assert.equal(checks.find(check=>check.id==='case').passed,false);
  assert.equal(checks.find(check=>check.id==='number').passed,true);
});
test('signup network errors do not incorrectly claim a grocery-list save failed',()=>{
  assert.equal(typeof A.authErrorMessage,'function');
  const text=A.authErrorMessage({code:'auth/network-request-failed'},'signup');
  assert.ok(text.includes('account'));assert.equal(text.includes('list'),false);
  assert.ok(A.authErrorMessage({code:'auth/network-request-failed',step:'send-verification'},'signup').includes('created'));
});
test('cloud serialization only includes grocery data, not arbitrary properties',()=>{
  assert.equal(typeof A.cleanState,'function');
  const s=M.initial();s.password='never upload';s.items[0].token='secret';
  const clean=A.cleanState(s);
  assert.equal('password' in clean,false);
  assert.equal('token' in clean.items[0],false);
  assert.throws(()=>A.cleanState({...s,items:[s.items[0],s.items[0]]}));
});
test('late account A load cannot populate account B',async()=>{
  assert.equal(typeof A.createSync,'function');
  let finishA;
  const sync=A.createSync({load:uid=>uid==='A'?new Promise(r=>finishA=r):Promise.resolve(null),write:async()=>1});
  const first=sync.open('A');await sync.open('B');finishA({state:M.initial(),revision:3});await first;
  assert.equal(sync.snapshot().uid,'B');assert.equal(sync.snapshot().state.items.length,0);
});
test('queued edits use the latest acknowledged revision and never cross accounts',async()=>{
  assert.equal(typeof A.createSync,'function');
  const calls=[];let finish;
  const sync=A.createSync({load:async()=>null,write:(uid,state,rev)=>{calls.push({uid,state,rev});return calls.length===1?new Promise(r=>finish=r):Promise.resolve(rev+1);}});
  await sync.open('A');sync.edit(M.initial());const pending=sync.flush();
  sync.edit({...M.initial(),items:[]});finish(1);await pending;await sync.flush();
  assert.deepEqual(calls.map(c=>c.rev),[0,1]);assert.equal(calls[1].state.items.length,0);
  await sync.open('B');assert.equal(sync.snapshot().state.items.length,0);
  sync.close();await sync.flush();assert.equal(calls.length,2);
});
test('conflicting cloud writes preserve unsaved work and surface an error',async()=>{
  assert.equal(typeof A.createSync,'function');
  const sync=A.createSync({load:async()=>null,write:async()=>{const e=new Error('Conflict');e.code='sync/conflict';throw e;}});
  await sync.open('A');sync.edit(M.initial());await sync.flush();
  assert.equal(sync.snapshot().status,'conflict');assert.equal(sync.snapshot().dirty,true);
  assert.equal(sync.snapshot().state.items.length,7);
});
test('a failed cloud load cannot fall back to sample data and overwrite the account',async()=>{
  const sync=A.createSync({load:async()=>{throw new Error('Offline');},write:async()=>{throw new Error('Must not write');}});
  await sync.open('A');
  assert.equal(sync.snapshot().status,'load-error');
  assert.equal(sync.snapshot().state,null);
  assert.throws(()=>sync.edit(M.initial()));
});
test('an in-flight save resolving after sign-out never restores private state',async()=>{
  let complete;
  const sync=A.createSync({load:async()=>null,write:()=>new Promise(resolve=>complete=resolve)});
  await sync.open('A');sync.edit(M.initial());const saving=sync.flush();sync.close();complete(1);await saving;
  assert.equal(sync.snapshot().uid,null);assert.equal(sync.snapshot().state,null);assert.equal(sync.snapshot().status,'signed-out');
});
