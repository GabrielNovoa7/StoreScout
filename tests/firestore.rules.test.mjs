import {before,after,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,deleteDoc,serverTimestamp} from 'firebase/firestore';
let env;
const valid=revision=>({schema:1,state:{version:1,items:[],stores:['heb','walmart'],preferences:{}},revision,updatedAt:serverTimestamp()});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-store-scout',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{await env?.cleanup();});
test('verified owner can create and read their own list',async()=>{
  const db=env.authenticatedContext('alice',{email_verified:true}).firestore();
  await assertSucceeds(setDoc(doc(db,'users/alice/lists/main'),valid(1)));
  await assertSucceeds(getDoc(doc(db,'users/alice/lists/main')));
});
test('other accounts, unverified users, and signed-out visitors cannot access a private list',async()=>{
  for(const context of [env.authenticatedContext('bob',{email_verified:true}),env.authenticatedContext('alice',{email_verified:false}),env.unauthenticatedContext()]){
    const ref=doc(context.firestore(),'users/alice/lists/main');
    await assertFails(getDoc(ref));await assertFails(setDoc(ref,valid(2)));
  }
});
test('owner updates require the next revision, server timestamp, and allowed fields',async()=>{
  const ref=doc(env.authenticatedContext('alice',{email_verified:true}).firestore(),'users/alice/lists/main');
  await assertSucceeds(setDoc(ref,valid(2)));
  await assertFails(setDoc(ref,valid(2)));
  await assertFails(setDoc(ref,{...valid(3),password:'not allowed'}));
  await assertFails(setDoc(ref,{...valid(3),updatedAt:new Date(0)}));
  await assertFails(deleteDoc(ref));
});
test('new lists cannot skip revisions or write at unapproved paths',async()=>{
  const db=env.authenticatedContext('carol',{email_verified:true}).firestore();
  await assertFails(setDoc(doc(db,'users/carol/lists/main'),valid(2)));
  await assertFails(setDoc(doc(db,'users/carol/lists/other'),valid(1)));
  await assertFails(setDoc(doc(db,'public/leak'),valid(1)));
});
test('profiles accept allowed themes but reject unexpected fields and invalid values',async()=>{
  const ref=doc(env.authenticatedContext('profile-owner',{email_verified:true}).firestore(),'users/profile-owner/lists/main');
  const profile={name:'Sam',zip:'77019',mode:'dark',accent:'pink'};
  const payload={...valid(1),state:{...valid(1).state,profile}};
  await assertSucceeds(setDoc(ref,payload));
  for(const bad of [{...profile,password:'no'},{...profile,accent:'red'},{...profile,zip:'x'},{...profile,name:'a'.repeat(61)}])await assertFails(setDoc(ref,{...valid(2),state:{...payload.state,profile:bad}}));
  await assertFails(getDoc(doc(env.authenticatedContext('outsider',{email_verified:true}).firestore(),'users/profile-owner/lists/main')));
});
