/* Account screens and cloud-list coordination. Passwords are never persisted. */
(() => {
  'use strict';
  const Core=window.ScoutAccountCore;
  const config=window.STORE_SCOUT_FIREBASE;
  const configured=!!(config?.enabled&&config.apiKey&&config.projectId&&config.authDomain&&config.appId);
  let provider=null,user=null,connection=configured?'connecting':'not-configured',mode='login';
  let profileDraft=null;
  let sync=null,hooks=null,feedback='',isError=false,busy=false,timer=null,lastStatus='signed-out',pendingUser;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=(action,label,cls='secondary')=>`<button class="button ${cls}" data-account-action="${action}">${label}</button>`;
  const current=()=>sync?.snapshot()||{status:'signed-out',dirty:false};
  function refresh(){
    const active=document.activeElement,focused=active?.closest?.('#profile-form')?{id:active.id,name:active.name,value:active.value,start:active.selectionStart,end:active.selectionEnd}:null;
    hooks?.onStatus();
    if(focused){const input=focused.id?document.getElementById(focused.id):document.querySelector(`#profile-form input[name="${focused.name}"][value="${focused.value}"]`);input?.focus();if(focused.start!=null)input?.setSelectionRange(focused.start,focused.end);}
  }
  function message(text,error=false){feedback=text;isError=error;refresh();}
  function errorText(error){
    return Core.authErrorMessage(error,mode);
  }
  async function onUser(next){
    if(!provider){pendingUser=next;return;}
    const previousUid=user?.uid;
    user=next;profileDraft=null;clearTimeout(timer);feedback='';isError=false;
    if(!user){sync.close();hooks.onState(hooks.getGuest());refresh();return;}
    // Clear all previous account content immediately, including pending undo state.
    if(previousUid!==user.uid||!user.emailVerified){sync.close();hooks.onState(Core.empty());}
    if(!user.emailVerified){refresh();return;}
    if(previousUid!==user.uid||current().status==='signed-out')await sync.open(user.uid);
    refresh();
  }
  async function init(callbacks){
    hooks=callbacks;
    sync=Core.createSync({load:uid=>provider.adapter.load(uid),write:(...args)=>provider.adapter.write(...args)},snapshot=>{
      if(snapshot.state&&lastStatus==='loading')hooks.onState(snapshot.state);
      lastStatus=snapshot.status;refresh();
    });
    if(!configured){refresh();return;}
    try{
      provider=await window.ScoutFirebase.connect(config,onUser);
      connection='connected';
      if(pendingUser!==undefined){const pending=pendingUser;pendingUser=undefined;await onUser(pending);}
      refresh();
    }catch{connection='failed';message('Firebase could not be reached. The guest list still works. Check your connection and Firebase configuration.',true);}
  }
  function save(state){
    if(!user)return false;
    sync.edit(state);clearTimeout(timer);
    timer=setTimeout(()=>sync.flush(),800);
    return true;
  }
  function label(){
    if(!user)return configured?'Guest · saved on this device':'Guest · accounts not configured';
    const s=current();
    if(!user.emailVerified)return 'Verify your email to sync your list';
    return ({loading:'Loading your cloud list…',ready:'Saved to your account',pending:'Unsaved changes',saving:'Saving to your account…',conflict:'Newer cloud edits found · resolve in Account','save-error':'Not saved · retry in Account','load-error':'Could not load cloud list'})[s.status]||'Account connected';
  }
  function render(){
    const s=current(),selected=user?'Your account':mode==='signup'?'Create your account':mode==='reset'?'Reset your password':'Welcome back.';
    if(!user&&configured&&connection==='connecting')return '<div class="page-heading"><div><div class="eyebrow">YOUR LIST. YOUR SPACE.</div><h1>Restoring your session…</h1><p role="status">Checking your sign-in before opening your list.</p></div></div>';
    let body='';
    if(user){
      body=`<div class="signed-in-identity"><span class="account-avatar">${esc((s.state?.profile?.name||user.email)?.charAt(0).toUpperCase()||'Y')}</span><div><strong>${esc(s.state?.profile?.name||user.email)}</strong><small>${esc(user.email)}</small><small>${user.emailVerified?'Email verified':'Email verification required'}</small></div></div>`;
      if(!user.emailVerified){body+=`<div class="account-callout"><h3>Check your email.</h3><p>Open the verification link from Firebase. Then return here and check again to unlock your private cloud list.</p><div class="account-actions">${button('check-email','I’ve verified my email','primary')}${button('resend-email','Resend email')}</div></div>`;}
      else if(s.status==='loading'||s.status==='signed-out'){body+='<div class="account-callout"><h3>Opening your list…</h3><p>Edits are paused until your account’s cloud copy is loaded.</p></div>';}
      else if(s.status==='load-error'){body+=`<div class="account-callout error"><h3>Your list could not be loaded.</h3><p>Nothing has been overwritten. Check your connection and database rules, then retry.</p>${button('reload','Retry loading','primary')}</div>`;}
      else{
        body+=`<div class="account-callout ${s.dirty?'warning':''}"><h3>${esc(label())}</h3><p>${s.status==='conflict'?'Another device changed the cloud list. Your unsaved changes are kept in memory. Download them before loading the newer cloud copy.':s.dirty?'Keep this page open until saving finishes. If a save failed, retry online.':'Your list is available when you sign into this same account on another device. Reopen the account or use Refresh cloud list to load later changes.'}</p><div class="account-actions">${s.dirty&&s.status!=='conflict'?button('retry-save','Save now','primary'):''}${button('reload',s.dirty?'Review cloud reload':'Refresh cloud list')}${button('export','Download my list')}${button('go-list','Go to my list','primary')}</div></div>`;
        const p=profileDraft||Core.cleanProfile(s.state.profile);
        body+=`<form id="profile-form" class="account-form profile-form"><div><div class="eyebrow">MAKE IT YOURS</div><h2>Profile & appearance</h2><p>Your settings travel with your account. Save after making changes.</p></div><label for="profile-name">Display name</label><input id="profile-name" class="dialog-input" name="name" autocomplete="nickname" maxlength="60" value="${esc(p.name)}" placeholder="What should we call you?"><label for="profile-zip">Shopping ZIP code</label><input id="profile-zip" class="dialog-input" name="zip" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}" maxlength="5" required value="${esc(p.zip)}"><small>Store coverage remains the Houston 77019 pilot.</small><fieldset><legend>Appearance</legend><div class="theme-options">${['light','dark','system'].map(mode=>`<label><input type="radio" name="mode" value="${mode}" ${p.mode===mode?'checked':''}>${mode.charAt(0).toUpperCase()+mode.slice(1)}</label>`).join('')}</div></fieldset><fieldset><legend>Accent color</legend><div class="accent-options">${['green','blue','purple','orange','pink'].map(accent=>`<label class="accent-choice" data-color="${accent}"><input type="radio" name="accent" value="${accent}" ${p.accent===accent?'checked':''}><span class="color-dot" aria-hidden="true"></span>${accent.charAt(0).toUpperCase()+accent.slice(1)}</label>`).join('')}</div></fieldset><p id="profile-status" role="status"></p><button class="button primary" type="submit">Save profile & appearance</button></form>`;
        body+=`<div class="account-import"><h3>Bring your guest list with you.</h3><p>Copy groceries saved in this browser into this account. This uploads that guest list to Firebase. It leaves the local guest copy intact.</p>${button('import','Copy guest list into account')}</div>`;
      }
      body+=`<div class="account-actions end">${button('logout','Sign out')}</div>`;
    }else{
      const signup=mode==='signup',reset=mode==='reset';
      body=`<div class="account-tabs" aria-label="Account options">${button('mode-login','Sign in',mode==='login'?'primary':'secondary')}${button('mode-signup','Create account',signup?'primary':'secondary')}</div>
      ${!configured?'<div class="account-callout"><strong>Account setup in progress</strong><p>The Firebase project must be connected before signup or login can work. Your guest list remains available.</p></div>':''}
      <form id="account-form" class="account-form"><label for="account-email">Email address</label><input class="dialog-input" id="account-email" name="email" type="email" autocomplete="username" maxlength="254" required placeholder="you@example.com">
      ${!reset?`<label for="account-password">Password</label><div class="password-field"><input class="dialog-input" id="account-password" name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" ${signup?'minlength="9" maxlength="128"':''} required><button type="button" data-account-action="show-password" aria-label="Show password">Show</button></div>`:''}
      ${signup?`<ul class="password-requirements" id="password-requirements" aria-live="polite">${Core.passwordChecks('').map(check=>`<li data-requirement="${check.id}" class="requirement-missing"><span class="requirement-mark" aria-hidden="true">×</span><span>${check.label}</span><span class="sr-only requirement-status"> — not met</span></li>`).join('')}</ul><label for="account-confirm">Confirm password</label><input class="dialog-input" id="account-confirm" name="confirm" type="password" autocomplete="new-password" minlength="9" maxlength="128" required>`:''}
      <p class="account-form-status ${isError?'error':''}" id="account-form-status" role="status">${esc(feedback)}</p><button class="button primary full" type="submit" ${!configured||connection!=='connected'||busy?'disabled':''}>${busy?'Please wait…':signup?'Create account':reset?'Send reset email':'Sign in'}</button></form>
      ${!reset?button('mode-reset','Forgot your password?','text-button'):button('mode-login','Back to sign in','text-button')}
      <div class="account-privacy"><strong>Your password stays with Firebase Authentication.</strong><p>Store Scout never saves your password. Firebase securely manages your sign-in state for this tab, so refreshing keeps you signed in. Sign out when finished on a shared device. Closing the tab normally ends the session; browser session-restore features may restore it. Your lists and settings are stored in your account, with no persistent offline list cache.</p></div>`;
    }
    return `<div class="page-heading"><div><div class="eyebrow">YOUR LIST. YOUR SPACE.</div><h1>${selected}</h1><p>One account, wherever your next grocery run begins.</p></div></div><section class="account-panel">${body}${user&&feedback?`<p role="status" class="account-form-status ${isError?'error':''}">${esc(feedback)}</p>`:''}</section><p class="account-footnote">Guest lists are local to this browser. Account lists are stored online. Signing out hides the account list and returns to the guest workspace.</p>`;
  }
  async function submit(event){
    event.preventDefault();if(!provider||busy)return;
    const form=event.target,data=new FormData(form),email=String(data.get('email')||'').trim();
    let password=String(data.get('password')||''),confirmation=String(data.get('confirm')||'');
    if(mode==='signup'){
      const issues=Core.passwordIssues(password);
      if(issues.length){const status=document.querySelector('#account-form-status');status.textContent=issues.join(' · ');status.classList.add('error');return;}
      if(password!==confirmation){document.querySelector('#account-form-status').textContent='The passwords do not match.';return;}
    }
    // Remove credentials from DOM and FormData before waiting on the network.
    form.querySelectorAll('input[type="password"],#account-password,#account-confirm').forEach(input=>input.value='');
    data.delete('password');data.delete('confirm');confirmation='';busy=true;
    const selectedMode=mode;feedback='';refresh();
    try{
      if(selectedMode==='signup'){await provider.signup(email,password);message('Account created. Check your inbox for the verification email.');}
      else if(selectedMode==='reset'){await provider.reset(email);message('If that address has an account, a password-reset email will arrive shortly.');}
      else await provider.login(email,password);
    }catch(error){
      if(selectedMode==='reset'&&['auth/user-not-found','auth/invalid-credential'].includes(error.code))message('If that address has an account, a password-reset email will arrive shortly.');
      else message(errorText(error),true);
    }finally{password='';busy=false;refresh();}
  }
  function exportList(){
    const blob=new Blob([JSON.stringify(Core.cleanState(hooks.getState()),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='store-scout-list.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function act(action){
    if(action.startsWith('mode-')){mode=action.slice(5);feedback='';isError=false;refresh();return;}
    if(action==='show-password'){const input=document.querySelector('#account-password');input.type=input.type==='password'?'text':'password';const btn=document.querySelector('[data-account-action="show-password"]');btn.textContent=input.type==='password'?'Show':'Hide';btn.setAttribute('aria-label',input.type==='password'?'Show password':'Hide password');return;}
    if(!provider||busy)return;
    if(action==='go-list'){hooks.navigate('list');return;}
    if(action==='export'){exportList();return;}
    if(action==='review-reload'){profileDraft=null;feedback='';await sync.open(user.uid);return;}
    if(action==='reload'&&(current().dirty||profileDraft)){hooks.confirmReload(()=>act('review-reload'),exportList);return;}
    if(action==='logout'&&(current().dirty||profileDraft)){hooks.confirmSignout(()=>act('discard-logout'),exportList);return;}
    busy=true;feedback='';refresh();
    try{
      if(action==='logout'||action==='discard-logout')await provider.logout();
      if(action==='reload'){profileDraft=null;}
      if(action==='reload')await sync.open(user.uid);
      if(action==='retry-save')await sync.flush();
      if(action==='resend-email'){await provider.sendVerification();message('Verification email sent. Check your inbox and spam folder.');}
      if(action==='check-email'){await provider.refreshUser();if(!user?.emailVerified)message('Email is not verified yet. Open the link in your inbox first.');}
      if(action==='import'){
        const s=current();if(!s.state||s.status==='loading')return;
        const guest=Core.cleanState(hooks.getGuest()),merged=Core.cleanState({...s.state,items:[...s.state.items,...guest.items.map(i=>({...i,id:crypto.randomUUID(),done:false}))]});
        hooks.onState(merged);save(merged);await sync.flush();message(current().dirty?'The guest list is copied in memory but has not saved yet. Retry saving.':'Guest groceries copied to your account.');
      }
    }catch(error){message(errorText(error),true);}finally{busy=false;refresh();}
  }
  document.addEventListener('submit',event=>{
    if(event.target.id==='account-form')void submit(event);
    if(event.target.id==='profile-form'){
      event.preventDefault();const status=document.querySelector('#profile-status');
      try{const data=new FormData(event.target),profile=Core.cleanProfile(Object.fromEntries(data));const next={...hooks.getState(),profile};profileDraft=null;save(next);hooks.onState(next);refresh();}
      catch(error){status.textContent=error.message;}
    }
  });
  const captureProfile=event=>{const form=event.target.closest?.('#profile-form');if(form)profileDraft=Object.fromEntries(new FormData(form));};
  document.addEventListener('change',captureProfile);
  document.addEventListener('input',event=>{
    captureProfile(event);
    if(event.target.id!=='account-password'||mode!=='signup')return;
    Core.passwordChecks(event.target.value).forEach(check=>{
      const row=document.querySelector(`[data-requirement="${check.id}"]`);if(!row)return;
      row.classList.toggle('requirement-met',check.passed);row.classList.toggle('requirement-missing',!check.passed);
      const mark=row.querySelector('.requirement-mark'),status=row.querySelector('.requirement-status');
      const nextMark=check.passed?'✓':'×',nextStatus=check.passed?' — complete':' — not met';
      if(mark.textContent!==nextMark)mark.textContent=nextMark;
      if(status.textContent!==nextStatus)status.textContent=nextStatus;
    });
  });
  document.addEventListener('click',event=>{const target=event.target.closest('[data-account-action]');if(target)void act(target.dataset.accountAction);});
  window.addEventListener('beforeunload',event=>{if(current().dirty||profileDraft){event.preventDefault();event.returnValue='';}});
  window.ScoutAccount={init,save,render,label,user:()=>user,locked:()=>configured&&connection==='connecting'||!!user&&(!user.emailVerified||!current().state),dirty:()=>current().dirty};
})();
