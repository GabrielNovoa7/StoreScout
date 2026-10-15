/* Pure account/sync logic. Credentials and Firebase tokens never enter list state. */
(function(root){
  'use strict';
  const M=typeof module!=='undefined'&&module.exports?require('./model.js'):root.Scout;
  function passwordIssues(value){
    const issues=[];
    if(value.length<9)issues.push('At least 9 characters');
    if(value.length>128)issues.push('No more than 128 characters');
    if(!/[A-Z]/.test(value))issues.push('An uppercase letter');
    if(!/[a-z]/.test(value))issues.push('A lowercase letter');
    if(!/[0-9]/.test(value))issues.push('A number');
    return issues;
  }
  function cleanProfile(value={}){
    const p={name:'',zip:'77019',mode:'light',accent:'green',...value};
    if(typeof p.name!=='string'||p.name.trim().length>60||typeof p.zip!=='string'||!/^\d{5}$/.test(p.zip)||!['light','dark','system'].includes(p.mode)||!['green','blue','purple','orange','pink'].includes(p.accent))throw new Error('Enter a name up to 60 characters, a five-digit ZIP, and valid appearance settings.');
    return {name:p.name.trim(),zip:p.zip,mode:p.mode,accent:p.accent};
  }
  const empty=()=>({version:1,items:[],stores:['kroger','wholefoods','sellers','heb','walmart'],preferences:{},profile:cleanProfile()});
  function passwordChecks(value){
    return [
      {id:'length',label:'At least 9 characters',passed:value.length>=9&&value.length<=128},
      {id:'case',label:'Uppercase and lowercase letters',passed:/[A-Z]/.test(value)&&/[a-z]/.test(value)},
      {id:'number',label:'At least one number',passed:/[0-9]/.test(value)}
    ];
  }
  function authErrorMessage(error,operation='login'){
    const code=error?.code;
    if(error?.step==='send-verification')return 'Your account was created, but the verification email could not be sent. Please use Resend email.';
    if(code==='auth/invalid-email')return 'Enter a valid email address.';
    if(['auth/invalid-credential','auth/user-not-found','auth/wrong-password'].includes(code))return 'Email or password is incorrect.';
    if(code==='auth/weak-password'||code==='auth/password-does-not-meet-requirements')return 'Use at least 9 characters with uppercase, lowercase, and a number.';
    if(code==='auth/too-many-requests')return 'Too many attempts. Please wait before trying again.';
    if(code==='auth/network-request-failed')return operation==='signup'?'Could not connect to the account service to finish signup. Check your connection and try again in your regular browser.':'Could not connect to the account service. Please check your connection and try again.';
    if(code==='unavailable')return 'Cloud connection unavailable. Your changes have not been saved. Please retry online.';
    if(code==='permission-denied')return 'Cloud access was denied. Verify your email and check the project’s Firestore rules.';
    return 'Unable to complete that request. Check your details and try again. If signup cannot finish, try signing in or resetting your password.';
  }
  function cleanState(state){
    if(!state||state.version!==1||!Array.isArray(state.items)||state.items.length>200||!Array.isArray(state.stores))throw new Error('Invalid list. Maximum 200 items.');
    const ids=new Set();
    const items=state.items.map(i=>{
      if(!i||typeof i.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(i.id)||ids.has(i.id)||typeof i.name!=='string'||!i.name.trim()||i.name.length>100||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>99)throw new Error('Invalid grocery item.');
      ids.add(i.id);
      return M.cleanSelection({id:i.id,name:i.name,quantity:i.quantity,offerId:i.offerId,done:i.done,...(i.live?{live:i.live}:{})});
    });
    const preferences=M.cleanPreferences(state.preferences);
    const receipts=state.importReceipts;
    if(receipts!==undefined&&(!Array.isArray(receipts)||receipts.length>20||receipts.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))||new Set(receipts).size!==receipts.length))throw new Error('Invalid import receipts.');
    const locations=M.cleanLocations(state.locations);
    return {...(receipts?{importReceipts:[...receipts]}:{}),...(Object.keys(locations).length?{locations}:{}),version:1,items,stores:[...new Set(state.stores.filter(s=>M.stores.some(store=>store.id===s)))],preferences,profile:cleanProfile(state.profile)};
  }
  function createSync(adapter,onChange=()=>{}){
    let generation=0, uid=null, state=null, revision=0, dirty=false, status='signed-out',error=null,editVersion=0,running=null;
    const snapshot=()=>({uid,state:state?structuredClone(state):null,revision,dirty,status,error});
    const emit=()=>onChange(snapshot());
    function close(){generation++;uid=null;state=null;revision=0;dirty=false;status='signed-out';error=null;running=null;emit();}
    async function open(userId){
      close();uid=userId;status='loading';const mine=generation;emit();
      try{const doc=await adapter.load(userId);if(mine!==generation)return;
        if(doc&&(!Number.isInteger(doc.revision)||doc.revision<1))throw new Error('Invalid cloud revision.');
        state=doc?cleanState(doc.state):empty();revision=doc?.revision||0;status='ready';emit();
      }catch(e){if(mine===generation){status='load-error';error=e.code||'sync/load';emit();}}
    }
    function edit(value){
      if(!uid||!state||status==='loading'||status==='load-error')throw new Error('Sign in and load your list before editing.');
      state=cleanState(value);dirty=true;editVersion++;if(status!=='conflict')status='pending';emit();
    }
    function flush(){
      if(running)return running;
      if(!uid||!dirty||status==='conflict')return Promise.resolve();
      const mine=generation,userId=uid;
      const run=async()=>{
        while(mine===generation&&dirty){
          const version=editVersion,payload=cleanState(state),expected=revision;status='saving';error=null;emit();
          try{const next=await adapter.write(userId,payload,expected);if(mine!==generation)return;revision=next;dirty=editVersion!==version;status=dirty?'pending':'ready';emit();}
          catch(e){if(mine===generation){status=e.code==='sync/conflict'?'conflict':'save-error';error=e.code||'sync/save';emit();}return;}
        }
      };
      running=run().finally(()=>{if(mine===generation)running=null;});return running;
    }
    return {open,close,edit,flush,snapshot};
  }
  const api={cleanProfile,passwordIssues,passwordChecks,authErrorMessage,cleanState,empty,createSync};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ScoutAccountCore=api;
})(typeof window!=='undefined'?window:globalThis);
