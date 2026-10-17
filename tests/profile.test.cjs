const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../account-core.js');
test('old lists receive a light green profile without changing groceries',()=>{const old=C.empty();delete old.profile;assert.deepEqual(C.cleanState(old).profile,{name:'',zip:'77019',mode:'light',accent:'green'});});
test('profile accepts pink and dark, strips private fields and validates settings',()=>{const state={...C.empty(),profile:{name:' Gabe ',zip:'77019',mode:'dark',accent:'pink',password:'secret'}};assert.deepEqual(C.cleanState(state).profile,{name:'Gabe',zip:'77019',mode:'dark',accent:'pink'});assert.throws(()=>C.cleanState({...state,profile:{...state.profile,zip:'bad'}}));assert.throws(()=>C.cleanState({...state,profile:{...state.profile,accent:'javascript:bad'}}));});
test('cloud round trip retains profile and grocery edits together',async()=>{let stored;const sync=C.createSync({load:async()=>null,write:async(uid,state,rev)=>{stored=state;return rev+1;}});await sync.open('a');sync.edit({...C.empty(),profile:{name:'Sam',zip:'77019',mode:'system',accent:'blue'}});await sync.flush();sync.close();const other=C.createSync({load:async()=>({state:stored,revision:1})});await other.open('a');assert.equal(other.snapshot().state.profile.accent,'blue');});
const vm=require('node:vm'),fs=require('node:fs');
test('theme resets at sign-out and follows system changes only in system mode',()=>{let callback;const attrs={},vars={},media={matches:true,addEventListener:(type,cb)=>callback=cb};const window={matchMedia:()=>media};const document={documentElement:{dataset:attrs,style:{setProperty:(key,value)=>vars[key]=value}},querySelector:()=>null};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../theme.js'),'utf8'),{window,document});assert.equal(attrs.theme,'light');window.ScoutTheme.apply({mode:'dark',accent:'pink'});assert.equal(attrs.theme,'dark');assert.equal(attrs.accent,'pink');window.ScoutTheme.apply(null);assert.equal(attrs.theme,'light');assert.equal(attrs.accent,'green');window.ScoutTheme.apply({mode:'system',accent:'blue'});assert.equal(attrs.theme,'dark');media.matches=false;callback();assert.equal(attrs.theme,'light');});
test('account can render between auth transition and list loading',async()=>{const window={ScoutAccountCore:C,STORE_SCOUT_FIREBASE:{enabled:true,apiKey:'mock',projectId:'mock',authDomain:'mock',appId:'mock'},addEventListener(){}};const document={addEventListener(){}};let change;window.ScoutFirebase={connect:async(c,cb)=>{change=cb;return {adapter:{load:async()=>null}};}};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../account-ui.js'),'utf8'),{window,document,clearTimeout,setTimeout});await window.ScoutAccount.init({getGuest:()=>C.empty(),onState(){},onStatus:()=>window.ScoutAccount.render()});await change({uid:'test',email:'demo@example.com',emailVerified:true});assert.ok(window.ScoutAccount.render().includes('profile-form'));});
test('profile drafts and focus survive unrelated background sync status changes',async()=>{
  const handlers={};let rendered='',focused=0,change;
  const form={},input={id:'profile-name',name:'name',value:'New draft',selectionStart:9,selectionEnd:9,closest:()=>form,focus:()=>focused++,setSelectionRange(){}};
  const document={activeElement:input,getElementById:()=>input,querySelector:()=>input,addEventListener:(type,cb)=>handlers[type]=cb};
  const window={ScoutAccountCore:C,STORE_SCOUT_FIREBASE:{enabled:true,apiKey:'mock',projectId:'mock',authDomain:'mock',appId:'mock'},addEventListener(){},ScoutFirebase:{connect:async(c,cb)=>{change=cb;return {adapter:{load:async()=>null,write:async()=>1}};}}};
  class FormData{constructor(){return new Map([['name','New draft'],['zip','77'],['mode','dark'],['accent','pink']]);}}
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../account-ui.js'),'utf8'),{window,document,FormData,clearTimeout(){},setTimeout:()=>1});
  await window.ScoutAccount.init({getGuest:()=>C.empty(),onState(){},onStatus:()=>rendered=window.ScoutAccount.render()});await change({uid:'a',email:'demo@example.com',emailVerified:true});
  handlers.input({target:input});window.ScoutAccount.save(C.empty());assert.ok(rendered.includes('value="New draft"'));assert.ok(rendered.includes('value="77"'));assert.ok(focused>0);
  await change(null);assert.ok(!window.ScoutAccount.render().includes('New draft'));
});
test('appearance previews on click, save confirms, and leaving unsaved restores the saved look',async()=>{
  const handlers={},winHandlers={},applied=[];let rendered='',change;
  const form={querySelector:()=>null},radio={name:'mode',value:'dark',closest:()=>form};
  const document={activeElement:null,querySelector:()=>null,addEventListener:(type,cb)=>handlers[type]=cb};
  const location={hash:'#account'};
  const window={ScoutAccountCore:C,STORE_SCOUT_FIREBASE:{enabled:true,apiKey:'mock',projectId:'mock',authDomain:'mock',appId:'mock'},addEventListener:(type,cb)=>winHandlers[type]=cb,ScoutTheme:{apply:p=>applied.push(p)},ScoutFirebase:{connect:async(c,cb)=>{change=cb;return {adapter:{load:async()=>null,write:async()=>1}};}}};
  class FormData{constructor(){return new Map([['name',''],['zip','77019'],['mode','dark'],['accent','pink']]);}}
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../account-ui.js'),'utf8'),{window,document,location,FormData,clearTimeout(){},setTimeout:()=>1});
  let state=C.empty();
  await window.ScoutAccount.init({getGuest:()=>C.empty(),getState:()=>state,onState:next=>state=next,onStatus:()=>rendered=window.ScoutAccount.render()});await change({uid:'a',email:'demo@example.com',emailVerified:true});
  handlers.change({target:radio});
  assert.equal(applied.at(-1).mode,'dark');assert.equal(applied.at(-1).accent,'pink');
  location.hash='#list';winHandlers.hashchange();
  assert.equal(applied.at(-1).mode,'light');assert.equal(applied.at(-1).accent,'green');
  location.hash='#account';handlers.change({target:radio});
  handlers.submit({preventDefault(){},target:{id:'profile-form'}});
  assert.ok(rendered.includes('Changes saved.'));assert.equal(state.profile.mode,'dark');assert.equal(state.profile.accent,'pink');
});
