const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const Core=require('../account-core.js');
test('typing updates visible checkmarks and classes without rerendering the form',()=>{
  const handlers={},rows=new Map();
  for(const id of ['length','case','number']){
    const classes=new Set(['requirement-missing']),mark={textContent:'×'},status={textContent:' — not met'};
    rows.set(`[data-requirement="${id}"]`,{classes,mark,status,classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},querySelector:selector=>selector==='.requirement-mark'?mark:status});
  }
  const document={addEventListener:(type,handler)=>{handlers[type]=handler;},querySelector:selector=>rows.get(selector)};
  const window={ScoutAccountCore:Core,STORE_SCOUT_FIREBASE:{enabled:false},addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../account-ui.js'),'utf8'),{window,document,clearTimeout,setTimeout});
  handlers.click({target:{closest:()=>({dataset:{accountAction:'mode-signup'}})}});
  handlers.input({target:{id:'account-password',value:'ValidPw7A'}});
  for(const row of rows.values()){
    assert.equal(row.mark.textContent,'✓');assert.ok(row.classes.has('requirement-met'));assert.equal(row.status.textContent,' — complete');
  }
  handlers.input({target:{id:'account-password',value:'UPPERCASE123'}});
  const mixed=rows.get('[data-requirement="case"]');
  assert.equal(mixed.mark.textContent,'×');assert.ok(mixed.classes.has('requirement-missing'));
});
