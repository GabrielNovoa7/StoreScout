/* Firebase browser SDK boundary. Loaded only when the public project config is enabled. */
window.ScoutFirebase = {
  async connect(config,onUser){
    const base='https://www.gstatic.com/firebasejs/13.0.0/';
    const [appSDK,authSDK,dbSDK]=await Promise.all([
      import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')
    ]);
    const app=appSDK.initializeApp({apiKey:config.apiKey,authDomain:config.authDomain,projectId:config.projectId,appId:config.appId});
    // Firebase manages tab-scoped auth state in sessionStorage; never save passwords ourselves.
    // Refresh restores the session. Sign out clears it; closing the tab normally ends it.
    const auth=authSDK.initializeAuth(app,{persistence:authSDK.browserSessionPersistence});
    const db=dbSDK.initializeFirestore(app,{localCache:dbSDK.memoryLocalCache()});
    const current=()=>auth.currentUser;
    async function step(name,operation){
      try{return await operation();}catch(error){
        // Diagnostics intentionally exclude passwords, email addresses, tokens, and raw responses.
        console.warn('Store Scout Firebase request failed '+JSON.stringify({step:name,code:error.code||'unknown'}));
        error.step=name;throw error;
      }
    }
    const assertOwner=uid=>{
      if(current()?.uid!==uid||!current()?.emailVerified){const e=new Error('Verify your email to sync.');e.code='auth/unverified';throw e;}
    };
    const docFor=uid=>dbSDK.doc(db,'users',uid,'lists','main');
    const adapter={
      async load(uid){assertOwner(uid);const doc=await dbSDK.getDocFromServer(docFor(uid));assertOwner(uid);return doc.exists()?doc.data():null;},
      async write(uid,state,revision){
        assertOwner(uid);
        return dbSDK.runTransaction(db,async transaction=>{
          assertOwner(uid);
          const ref=docFor(uid),snapshot=await transaction.get(ref);
          const currentRevision=snapshot.exists()?snapshot.data().revision:0;
          if(currentRevision!==revision){const e=new Error('Newer cloud edits exist.');e.code='sync/conflict';throw e;}
          const next=revision+1;
          transaction.set(ref,{schema:1,state,revision:next,updatedAt:dbSDK.serverTimestamp()});
          return next;
        });
      }
    };
    // Read the public password policy before asking the user to enter credentials.
    // This also primes the SDK's policy cache for signup and detects blocked connections early.
    await step('password-policy',()=>authSDK.validatePassword(auth,''));
    let unsubscribe;
    // Wait for the first auth observation so a restored account cannot race guest edits.
    await new Promise((resolve,reject)=>{
      unsubscribe=authSDK.onAuthStateChanged(auth,user=>{
        onUser(user?{uid:user.uid,email:user.email,emailVerified:user.emailVerified}:null);
        resolve();
      },reject);
    });
    return {
      adapter,unsubscribe,
      async idToken(){const uid=current()?.uid;assertOwner(uid);const token=await authSDK.getIdToken(current());assertOwner(uid);return token;},
      async login(email,password){await step('sign-in',()=>authSDK.signInWithEmailAndPassword(auth,email,password));},
      async signup(email,password){
        const policy=await step('password-policy',()=>authSDK.validatePassword(auth,password));
        if(!policy.isValid){const e=new Error('Password does not meet the configured policy.');e.code='auth/password-does-not-meet-requirements';throw e;}
        const result=await step('create-account',()=>authSDK.createUserWithEmailAndPassword(auth,email,password));
        await step('send-verification',()=>authSDK.sendEmailVerification(result.user));
      },
      async sendVerification(){if(current())await authSDK.sendEmailVerification(current());},
      async refreshUser(){
        const user=current();if(!user)return;
        await authSDK.reload(user);await authSDK.getIdToken(user,true);
        onUser({uid:user.uid,email:user.email,emailVerified:user.emailVerified});
      },
      async reset(email){await authSDK.sendPasswordResetEmail(auth,email);},
      async logout(){await authSDK.signOut(auth);}
    };
  }
};
