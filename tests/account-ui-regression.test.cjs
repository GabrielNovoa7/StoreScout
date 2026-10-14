const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const M=require('../model.js');
function harness(){
  let hooks,user=null,writes=0;
  const nodes=new Map();
  const get=selector=>{
    if(!nodes.has(selector))nodes.set(selector,{textContent:'',_html:'',classList:{remove(){},add(){}},set innerHTML(v){this._html=v;if(selector==='#main')writes++;},get innerHTML(){return this._html;},addEventListener(){},close(){}});
    return nodes.get(selector);
  };
  const account={user:()=>user,locked:()=>false,label:()=>user?'Saving…':'Guest',render:()=>'',init:options=>{hooks=options;}};
  const sandbox={window:{Scout:M,ScoutAccount:account,addEventListener(){},location:{hash:''}},location:{hash:''},localStorage:{getItem:()=>null},document:{querySelector:get,querySelectorAll:()=>[],addEventListener(){}},Intl,clearTimeout,setTimeout,crypto:globalThis.crypto};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8'),sandbox);
  return {get,hooks:()=>hooks,writes:()=>writes,setUser:value=>{user=value;}};
}
test('background sync status updates do not replace the list DOM or erase drafts',()=>{
  const h=harness();h.setUser({uid:'A'});h.hooks().onState(M.initial());h.hooks().onStatus();
  const before=h.writes();h.hooks().onStatus();
  assert.equal(h.writes(),before);
});
test('account data changes clear old toast contents and undo notification',()=>{
  const h=harness();h.get('#toast').textContent='Private grocery removed.';
  h.hooks().onState(M.initial());
  assert.equal(h.get('#toast').textContent,'');
});
