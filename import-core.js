/* Pure, explicit import preview. Incoming titles are data, never markup. */
(function(root){
  'use strict';
  const C=typeof module!=='undefined'&&module.exports?require('./account-core.js'):root.ScoutAccountCore;
  const M=typeof module!=='undefined'&&module.exports?require('./model.js'):root.Scout;
  function parse(text){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>65536)throw new Error('Import must be at most 64 KiB.');
    const trimmed=text.trim();let value;
    if(/^[{\[]/.test(trimmed)){try{value=JSON.parse(trimmed);}catch{throw new Error('This JSON is not valid. Paste reminder titles one per line, or a valid list export.');}}
    else value={items:trimmed?trimmed.split(/\r?\n/).filter(s=>s.trim()):[]};
    if(Array.isArray(value))value={items:value};
    if(!value||typeof value!=='object'||!Array.isArray(value.items)||value.items.length>200)throw new Error('Import must contain at most 200 reminder titles.');
    const items=value.items.map(name=>{if(typeof name!=='string'||!name.trim()||name.trim().length>100)throw new Error('Each reminder must have a title of 1–100 characters.');return name.trim();});
    const listName=value.listName??'Pasted groceries';if(typeof listName!=='string'||listName.length>100)throw new Error('List name must be at most 100 characters.');
    const snapshotId=value.snapshotId;if(snapshotId!==undefined&&(typeof snapshotId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(snapshotId)))throw new Error('Invalid import identifier.');
    return {listName,items,...(snapshotId?{snapshotId}:{})};
  }
  const fingerprint=state=>JSON.stringify(C.cleanState(state));
  function preview(payload,state){
    const safe=parse(JSON.stringify(payload)),clean=C.cleanState(state),existing=new Set(clean.items.map(i=>M.normalize(i.name))),seen=new Set();
    const rows=safe.items.map((name,index)=>{const key=M.normalize(name),status=existing.has(key)?'existing':seen.has(key)?'repeated':'new';seen.add(key);return{index,name,status,checked:status==='new'};});
    return {rows,fingerprint:fingerprint(state),alreadyApplied:!!safe.snapshotId&&!!clean.importReceipts?.includes(safe.snapshotId),remaining:200-clean.items.length};
  }
  function merge(payload,state,indices,base,makeId=()=>crypto.randomUUID()){
    const p=parse(JSON.stringify(payload)),view=preview(p,state);
    if(view.fingerprint!==base)throw new Error('Your list changed. Review a fresh preview before adding groceries.');
    const next=C.cleanState(state);if(view.alreadyApplied)return next;
    if(!Array.isArray(indices)||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=p.items.length))throw new Error('Select valid import rows.');
    if(next.items.length+indices.length>200)throw new Error('Your list supports at most 200 groceries. Select fewer rows.');
    if(!indices.length)throw new Error('Select at least one grocery.');
    for(const index of indices){const name=p.items[index],preferred=next.preferences[M.normalize(name)],offer=M.catalog.find(o=>o.id===preferred&&next.stores.includes(o.storeId)&&o.available!==false&&M.canSelect(name,o.id));next.items.push({id:makeId(),name,quantity:1,offerId:offer?.id||null,done:false});}
    if(p.snapshotId)next.importReceipts=[...(next.importReceipts||[]).filter(id=>id!==p.snapshotId),p.snapshotId].slice(-20);
    return C.cleanState(next);
  }
  const api={parse,preview,merge,fingerprint};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ScoutImport=api;
})(typeof window!=='undefined'?window:globalThis);
