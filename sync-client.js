/* Upload inbox requests. Firebase tokens are used only in Authorization headers. */
window.ScoutSync={
  configured(){const c=window.STORE_SCOUT_SYNC;try{const url=new URL(c?.workerUrl);return !!c.enabled&&url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash;}catch{return false;}},
  async request(path,method='GET',body){
    if(!this.configured())throw new Error('Cloudflare sync is not configured yet. You can still paste a list below.');
    const account=window.ScoutAccount.user();if(!account?.emailVerified)throw new Error('Sign in and verify your email first.');
    const uid=account.uid,token=await window.ScoutAccount.requestToken();
    if(window.ScoutAccount.user()?.uid!==uid)throw new Error('Account changed. Please try again.');
    let response;
    try{response=await fetch(window.STORE_SCOUT_SYNC.workerUrl.replace(/\/$/,'')+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'omit',redirect:'error'});}catch{throw new Error('The sync inbox could not be reached. Try again online or paste your list.');}
    if(window.ScoutAccount.user()?.uid!==uid)throw new Error('Account changed. Please try again.');
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(response.status===401?'Your connection expired. Sign in again or pair the Shortcut again.':response.status===429?'Too many sync requests. Please wait and try again.':response.status===403?'This account cannot access that import.':'The sync request failed. Please retry.');
    return data;
  }
};
