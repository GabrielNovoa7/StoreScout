/* Preview-before-save Reminders import, shared by inbox and paste fallback. */
(() => {
 'use strict';
 const I=window.ScoutImport,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let hooks,draft='',payload=null,view=null,chosen=new Set(),owner=null,message='',error=false,busy=false,code='',connection=null,pendingAction=null,generation=0;
 const configured=()=>!!window.ScoutSync?.configured();
 const uid=()=>hooks?.getUser()?.uid||null;
 const ready=()=>hooks?.getUser()?.emailVerified&&hooks.isReady();
 function changed(){hooks?.changed();}
 function reset(){generation++;draft='';payload=null;view=null;chosen.clear();owner=null;message='';error=false;busy=false;code='';connection=null;pendingAction=null;}
 function notify(text,failed=false){message=text;error=failed;changed();}
 function openPreview(input){if(!ready())throw new Error('Sign in, verify your email, and wait for your list to finish saving first.');payload=I.parse(input);view=I.preview(payload,hooks.getState());chosen=new Set(view.rows.filter(r=>r.checked).map(r=>r.index));owner=uid();message=view.alreadyApplied?'This import has already been added.':payload.items.length?'Choose what to add. Existing groceries stay unchanged.':'Nothing to import.';error=false;}
 function render(){
  const user=hooks?.getUser();
  if(!user?.emailVerified)return `<div class="page-heading"><div><h1>Bring your usual list.</h1><p>Sign in and verify your email to preview a private account import.</p></div></div><button class="button primary" data-import-action="account">Open account</button>`;
  return `<div class="page-heading"><div><h1>Review before you add.</h1><p>Import groceries from Reminders. Your existing list and product choices stay yours.</p></div></div><section class="import-panel"><div class="import-section"><h2>Connect your Shortcut</h2><p>${configured()?'Pair once, choose your Reminders list, then upload it for review. Cloudflare temporarily receives your reminder titles and account ID. Firebase remains your permanent list storage.':'The Cloudflare connection is being set up. The paste-and-preview option below works now.'}</p>${configured()?`<div class="account-actions"><button class="button secondary" data-import-action="status" ${busy?'disabled':''}>Check connection</button><button class="button secondary" data-import-action="pair" ${busy?'disabled':''}>Create pairing code</button><button class="button primary" data-import-action="fetch" ${busy?'disabled':''}>Check for uploaded list</button>${connection?.connected?'<button class="button secondary" data-import-action="disconnect">Disconnect Shortcut</button>':''}</div>`:''}${connection?`<p>${connection.connected?'Shortcut paired.':'No Shortcut paired.'}</p>`:''}${code?`<div class="pairing-code"><strong>One-time pairing code</strong><code>${esc(code)}</code><p>Paste this into the private Shortcut setup within ten minutes. Do not share the paired Shortcut. Creating another code replaces the connection and discards its pending upload.</p></div>`:''}${pendingAction?`<div class="pairing-code"><strong>${pendingAction==='pair'?'Replace Shortcut connection?':'Disconnect Shortcut?'}</strong><p>This revokes the current Shortcut connection and discards any pending upload. Groceries already saved to Firebase and your Apple Reminders stay unchanged.</p><div class="account-actions"><button class="button primary" data-import-action="${pendingAction}-confirm">${pendingAction==='pair'?'Replace and create code':'Disconnect and discard upload'}</button><button class="button secondary" data-import-action="connection-cancel">Keep current connection</button></div></div>`:''}<p class="import-small">Shortcut installation instructions will be available after the iPhone test. No working install link is claimed yet.</p></div><div class="import-section"><h2>Paste a list to try it now</h2><p>Copy reminder titles, one grocery per line. A JSON export with an items array also works. Nothing changes until you confirm.</p><label class="field-label" for="import-text">Groceries to review</label><textarea id="import-text" ${busy?'disabled':''} class="dialog-input import-text" maxlength="65536" placeholder="Milk&#10;Fresh basil&#10;Bananas">${esc(draft)}</textarea><div class="account-actions"><button class="button primary" data-import-action="preview" ${busy||!ready()?'disabled':''}>Preview import</button>${view?'<button class="button secondary" data-import-action="cancel">Cancel preview</button>':''}</div></div>${view?`<div class="import-section"><div class="import-preview-heading"><h2>${esc(payload.listName||'Groceries')}</h2><span>${view.rows.length} incoming · room for ${view.remaining}</span></div>${view.alreadyApplied?'<p>This upload was already saved to your account. It will not be added again.</p>':`<p>Existing and repeated titles are unchecked. Check one only if you want another copy.</p><div class="import-rows">${view.rows.map(r=>`<label class="import-row"><input type="checkbox" data-import-row="${r.index}" ${chosen.has(r.index)?'checked':''} ${busy?'disabled':''}><span>${esc(r.name)}</span><small>${{new:'New',existing:'Already on your list',repeated:'Repeated in this import'}[r.status]}</small></label>`).join('')}</div><button class="button primary" data-import-action="confirm" ${busy||!ready()||!chosen.size||chosen.size>view.remaining?'disabled':''}>${busy?'Saving…':`Add ${chosen.size} ${chosen.size===1?'grocery':'groceries'}`}</button>${chosen.size>view.remaining?'<p class="error">Select fewer groceries to stay within the 200-item list limit.</p>':''}`}</div>`:''}<p role="status" class="account-form-status ${error?'error':''}">${esc(message)}</p></section>`;
 }
 async function act(action){
  if(action==='account'){hooks.navigate('account');return;}
  if(busy)return;
  if(action==='connection-cancel'){pendingAction=null;changed();return;}
  if(action==='pair'||action==='disconnect'){pendingAction=action;changed();return;}
  if(action==='pair-confirm'||action==='disconnect-confirm'){if(action!==pendingAction+'-confirm')return;action=pendingAction;pendingAction=null;}
  if(action==='cancel'){payload=null;view=null;chosen.clear();message='Preview cancelled. Your list has not changed.';changed();return;}
  const mine=generation,who=uid();
  try{
   if(action==='preview'){openPreview(draft);changed();return;}
   if(!ready())throw new Error('Sign in and wait for your list to finish saving.');
   busy=true;error=false;message='';changed();
   if(action==='confirm'){
    if(!payload||!view)throw new Error('Preview your updated text before adding groceries.');
    if(owner!==uid())throw new Error('Account changed. Open a new preview.');
    const importedId=payload.snapshotId;
    const next=I.merge(payload,hooks.getState(),[...chosen],view.fingerprint);
    await hooks.apply(next,view.fingerprint);
    if(mine!==generation||who!==uid())return;
    payload=null;view=null;chosen.clear();draft='';message='Groceries saved to your account.';
    if(importedId&&configured()){try{await window.ScoutSync.request('/snapshots/'+encodeURIComponent(importedId)+'/ack','POST');}catch{message='Groceries saved. Inbox acknowledgement failed; retrying this upload will not add it twice.';}}
   }else if(action==='pair'){const result=await window.ScoutSync.request('/pairings','POST');if(mine!==generation||who!==uid())return;code=result.code;message='Pairing code created. Enter it in the Shortcut setup.';}
   else if(action==='status'){const result=await window.ScoutSync.request('/connection');if(mine!==generation||who!==uid())return;connection=result;}
   else if(action==='disconnect'){await window.ScoutSync.request('/connection','DELETE');if(mine!==generation||who!==uid())return;connection={connected:false};code='';payload=null;view=null;chosen.clear();message='Shortcut disconnected.';}
   else if(action==='fetch'){const result=await window.ScoutSync.request('/snapshots/latest');if(mine!==generation||who!==uid())return;if(result.snapshot){openPreview(JSON.stringify(result.snapshot));draft='';}else message='No pending upload. Run your Shortcut first, or paste a list below.';}
  }catch(e){if(mine!==generation||who!==uid())return;error=true;message=e.message||'The import could not be completed.';if(ready()&&payload&&view&&I.fingerprint(hooks.getState())!==view.fingerprint){view=I.preview(payload,hooks.getState());chosen=new Set(view.rows.filter(r=>r.checked).map(r=>r.index));message+=' A fresh preview is shown; review it before confirming again.';}}
  finally{if(mine===generation&&who===uid()){busy=false;changed();}}
 }
 document.addEventListener('input',event=>{if(!busy&&event.target.id==='import-text'){draft=event.target.value;if(view){payload=null;view=null;chosen.clear();message='Text changed. Preview it again before adding.';}}});
 document.addEventListener('change',event=>{if(event.target.dataset.importRow!==undefined){const index=Number(event.target.dataset.importRow);event.target.checked?chosen.add(index):chosen.delete(index);changed();}});
 document.addEventListener('click',event=>{const target=event.target.closest('[data-import-action]');if(target)void act(target.dataset.importAction);});
 window.ScoutImportUI={init:options=>{hooks=options;},render,reset};
})();
