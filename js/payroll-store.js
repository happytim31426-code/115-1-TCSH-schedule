// Private, device-local store. Never synchronizes to Firebase or public data.
const database='tcsh-private-payroll-v1';
export async function payrollStore(operation,value,key='latest'){
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(database,1);r.onupgradeneeded=()=>r.result.createObjectStore('private');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('private',operation==='get'?'readonly':'readwrite'),s=tx.objectStore('private');let conflict=false;
    const r=operation==='get'||operation==='snapshot'?s.get(key):operation==='delete'?s.delete(key):s.put(value,key);let result;
    r.onsuccess=()=>{result=r.result;if(operation==='snapshot'){if(!result||result.updatedAt!==value.updatedAt){conflict=true;tx.abort();return;}s.put(value,key);}};
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(conflict?Error('另一個分頁已更新課表，請重新整理後再修正'):tx.error||Error('本機儲存中止'));
  });}finally{db.close();}
}
