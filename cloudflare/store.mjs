export class Store {
 constructor(db){this.db=db;}
 stmt(sql,...args){return this.db.prepare(sql).bind(...args);}
 async rate(subject,action,limit,now){const bucket=Math.floor(now/3600);return !!await this.stmt('INSERT INTO rates(subject,action,bucket,count) VALUES(?,?,?,1) ON CONFLICT(subject,action,bucket) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count',subject,action,bucket,limit).first();}
 async pairing(uid,hash,now){await this.db.batch([this.stmt('INSERT INTO accounts(uid,code_hash,code_expires) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET code_hash=excluded.code_hash,code_expires=excluded.code_expires,credential_hash=NULL',uid,hash,now+600),this.stmt('DELETE FROM snapshots WHERE uid=?',uid)]);}
 async claim(hash,credential,now){return this.stmt('UPDATE accounts SET credential_hash=?,code_hash=NULL,code_expires=NULL WHERE code_hash=? AND code_expires>? RETURNING uid',credential,hash,now).first();}
 async device(hash){return this.stmt('SELECT uid FROM accounts WHERE credential_hash=?',hash).first();}
 async connection(uid){return this.stmt('SELECT credential_hash IS NOT NULL AS connected,last_upload_at FROM accounts WHERE uid=?',uid).first();}
 async revoke(uid){await this.db.batch([this.stmt('UPDATE accounts SET credential_hash=NULL,code_hash=NULL,code_expires=NULL WHERE uid=?',uid),this.stmt('DELETE FROM snapshots WHERE uid=?',uid)]);}
 async upload(hash,id,listName,items,now){const results=await this.db.batch([this.stmt('INSERT INTO snapshots(id,uid,list_name,items,uploaded_at,expires_at) SELECT ?,uid,?,?,?,? FROM accounts WHERE credential_hash=? ON CONFLICT(uid) DO UPDATE SET id=excluded.id,list_name=excluded.list_name,items=excluded.items,uploaded_at=excluded.uploaded_at,expires_at=excluded.expires_at RETURNING id',id,listName,JSON.stringify(items),now,now+86400,hash),this.stmt('UPDATE accounts SET last_upload_at=? WHERE credential_hash=?',now,hash)]);return !!results[0].results?.length;}
 async latest(uid,now){return this.stmt('SELECT id,list_name,items,uploaded_at FROM snapshots WHERE uid=? AND expires_at>? AND NOT EXISTS(SELECT 1 FROM acknowledgements a WHERE a.id=snapshots.id)',uid,now).first();}
 async ack(uid,id,now){await this.db.batch([this.stmt('INSERT INTO acknowledgements(id,uid,expires_at) SELECT id,uid,? FROM snapshots WHERE uid=? AND id=? ON CONFLICT(id) DO NOTHING',now+2592000,uid,id),this.stmt('DELETE FROM snapshots WHERE uid=? AND id=?',uid,id)]);}
 async cleanup(now){await this.db.batch([this.stmt('DELETE FROM snapshots WHERE expires_at<=?',now),this.stmt('DELETE FROM acknowledgements WHERE expires_at<=?',now),this.stmt('UPDATE accounts SET code_hash=NULL,code_expires=NULL WHERE code_expires<=?',now),this.stmt('DELETE FROM rates WHERE bucket<?',Math.floor(now/3600)-1)]);}
}
