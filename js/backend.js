const el = id => document.getElementById(id);
let api, user = null, stopMember = () => {}, stopList = () => {}, stopPrivate=()=>{};
let privateActive=false;
let repairLegacyLeaves=()=>{};
const privateCollection=kind=>({recruit:'recruitmentRecords',course:'courseRecords',event:'schoolEvents'})[kind];
const publicCollection=kind=>({recruit:'publicRecruitments',course:'publicCourseRecords',event:'publicSchoolEvents'})[kind];
function startPrivate(member){
  if(!!member===privateActive)return;
  stopPrivate();privateActive=!!member;
  if(!member){for(const kind of ['recruit','course','event'])window.dispatchEvent(new CustomEvent(`cloud-${kind}-records`,{detail:[]}));return;}
  const stops=['recruit','course','event'].map(kind=>api.onSnapshot(api.collection(api.db,privateCollection(kind)),{includeMetadataChanges:true},snapshot=>{
    if(snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
    window.dispatchEvent(new CustomEvent(`cloud-${kind}-records`,{detail:snapshot.docs.map(d=>({...d.data(),id:d.id}))}));
  },error=>{el(kind==='recruit'?'recruit-message':kind==='event'?'event-status':'teaching-status').textContent=errorMessage(error);}));
  stopPrivate=()=>stops.forEach(stop=>stop());
}
function access(member) {
  window.AUTH_MEMBER = member;
  if(api)startPrivate(member);
  window.renderWorkspace?.();
  for (const id of ['recruit-save','recruit-load']) el(id).disabled = !member;
  if (!member) { el('member-list').replaceChildren(); el('recruit-cloud-status').textContent = ''; }
  window.dispatchEvent(new Event('authorization-changed'));
  if(member)repairLegacyLeaves();else{el('leave-privacy-status').hidden=true;el('leave-privacy-status').textContent='';}
}
function errorMessage(error) {
  return ({'auth/unauthorized-domain':'請在 Firebase 驗證設定加入 happytim31426-code.github.io 授權網域。',
    'auth/operation-not-allowed':'請先在 Firebase 啟用 Google 登入。',
    'auth/popup-blocked':'請允許瀏覽器開啟登入視窗。',
    'auth/popup-closed-by-user':'登入視窗已關閉，可再試一次。',
    'permission-denied':'無存取權限：請檢查授權名單及 Firestore 規則是否已發布。',
    'unavailable':'資料庫暫時無法連線，請稍後再試。'})[error.code] || `操作未完成：${error.code || error.message}`;
}
function memberList(snapshot) {
  el('member-list').replaceChildren();
  for (const record of snapshot.docs) {
    const item = record.data(), button = document.createElement('button');
    button.type = 'button'; button.className = 'person-button';
    button.textContent = `${item.name}｜${record.id}｜${item.role === 'admin' ? '管理員' : '授權教師'}｜${item.active ? '啟用' : '停用'}`;
    button.disabled = record.id === user.email;
    button.addEventListener('click', () => {
      el('member-email').value = record.id; el('member-name').value = item.name;
      el('member-role').value = item.role; el('member-active').value = String(item.active);
    });
    el('member-list').append(button);
  }
}
async function initialize() {
  if (!window.FIREBASE_CONFIG?.projectId) return;
  const [appSDK, authSDK, dbSDK] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')
  ]);
  const app = appSDK.initializeApp(window.FIREBASE_CONFIG);
  api = {...authSDK,...dbSDK,auth:authSDK.getAuth(app),db:dbSDK.getFirestore(app)};
  window.CLOUD_RECORDS={save:async(kind,id,payload,projection,revision)=>{
    if(!user||!window.AUTH_MEMBER)throw Error('請先以授權帳號登入。');
    if(!privateCollection(kind))throw Error('不支援的紀錄類型');
    const ref=api.doc(api.db,privateCollection(kind),id);
    const pub=api.doc(api.db,publicCollection(kind),id);
    try{await api.runTransaction(api.db,async transaction=>{
      const old=await transaction.get(ref),actual=old.exists()?old.data().revision:0;
      if(actual!==revision)throw Error('其他同仁已更新此筆資料，請重新載入後再修正。');
      const existing=old.exists()?old.data():null;
      transaction.set(ref,{...payload,revision:actual+1,updatedAt:api.serverTimestamp(),updatedBy:user.uid,updatedName:window.AUTH_MEMBER.name,createdName:existing?(existing.createdName||'舊紀錄未記名'):window.AUTH_MEMBER.name,createdBy:existing?.createdBy||existing?.updatedBy||user.uid,createdAt:existing?.createdAt||existing?.updatedAt||api.serverTimestamp()});
      if(projection)transaction.set(pub,projection);else transaction.delete(pub);
    });}catch(error){throw Error(error.code?errorMessage(error):error.message);}
  }};
  window.CLOUD_RECORDS.remove=async(kind,id,revision)=>{
    if(!user||!window.AUTH_MEMBER)throw Error('請先以授權帳號登入。');
    if(!privateCollection(kind))throw Error('不支援的紀錄類型');
    const ref=api.doc(api.db,privateCollection(kind),id),pub=api.doc(api.db,publicCollection(kind),id);
    try{await api.runTransaction(api.db,async transaction=>{
      const old=await transaction.get(ref);if(!old.exists())throw Error('此筆紀錄已不存在，請重新整理。');
      const item=old.data();if(item.revision!==revision)throw Error('其他同仁已更新此筆資料，請重新整理後再操作。');
      const patch={status:'deleted',revision:revision+1,updatedAt:api.serverTimestamp(),updatedBy:user.uid,updatedName:window.AUTH_MEMBER.name};
      if(!Object.hasOwn(item,'createdName'))patch.createdName='舊紀錄未記名';if(!Object.hasOwn(item,'createdBy'))patch.createdBy=item.updatedBy||user.uid;if(!Object.hasOwn(item,'createdAt'))patch.createdAt=item.updatedAt||api.serverTimestamp();
      // Do not synthesize new course/leave fields while deleting a legacy record.
      transaction.update(ref,patch);transaction.delete(pub);
    });}catch(error){throw Error(error.code?errorMessage(error):error.message);}
  };
  let publicCourses=[],publicRecruitments=[],publicEvents=[],loaded=new Set();
  let repairing=false;
  repairLegacyLeaves=async()=>{
    if(repairing||!user||!window.AUTH_MEMBER)return;
    const legacy=publicCourses.filter(r=>['公','差'].includes(r.leaveCode));if(!legacy.length)return;
    repairing=true;const uid=user.uid,note=el('leave-privacy-status');note.hidden=false;note.textContent='正在將舊公開假別轉為「假」，不更動行政假別…';
    try{
      for(const record of legacy){
        if(user?.uid!==uid||!window.AUTH_MEMBER)break;
        await api.runTransaction(api.db,async transaction=>{
          const ref=api.doc(api.db,'publicCourseRecords',record.id),privateRef=api.doc(api.db,'courseRecords',record.id);
          const [pub,priv]=await Promise.all([transaction.get(ref),transaction.get(privateRef)]);
          if(pub.exists()&&['公','差'].includes(pub.data().leaveCode)){
            if(!priv.exists()||priv.data().status!=='submitted')throw Error('有舊公開紀錄無法對上有效行政資料，請聯絡管理員核對。');
            transaction.update(ref,{leaveCode:'假'});
          }
        });
      }
      if(user?.uid===uid&&window.AUTH_MEMBER)note.textContent='舊公開假別已統一為「假」，行政端詳細假別保留。';
    }catch(error){if(user?.uid===uid&&window.AUTH_MEMBER)note.textContent=`舊公開假別轉換尚未完成：${error.code?errorMessage(error):error.message}。請重新登入重試。`;}finally{repairing=false;}
  };
  window.WEEKLY.setPublished([],false,'正在讀取雲端最新課務與招生安排…');
  const syncPublic=()=>{window.WEEKLY.setRecruitments(publicRecruitments);window.WEEKLY.setEvents(publicEvents);window.WEEKLY.setPublished(publicCourses,loaded.size===3,loaded.size===3?'已同步雲端最新課務、招生及重要活動。':'正在讀取雲端最新課務、招生及重要活動…');};
  for(const kind of ['course','recruit','event'])api.onSnapshot(api.collection(api.db,publicCollection(kind)),{includeMetadataChanges:true},snapshot=>{
    if(snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
    const list=snapshot.docs.map(d=>({...d.data(),id:d.id}));if(kind==='course')publicCourses=list;else if(kind==='recruit')publicRecruitments=list;else publicEvents=list;loaded.add(kind);syncPublic();if(kind==='course')repairLegacyLeaves();
  },error=>{loaded.delete(kind);window.WEEKLY.setPublished(publicCourses,false,`雲端同步未完成：${errorMessage(error)}`);});
  el('google-login').disabled = false;
  api.onAuthStateChanged(api.auth, current => {
    stopMember(); stopList(); access(null); user = current;
    el('google-login').classList.toggle('is-hidden',!!user);
    el('google-logout').classList.toggle('is-hidden',!user);
    if (!user) { el('account-status').textContent = '尚未登入，公開課表可照常查詢。'; return; }
    el('account-status').textContent = '正在核對授權…';
    if (!user.emailVerified) { el('account-status').textContent = '請使用已驗證 Email 的 Google 帳號。'; return; }
    stopMember = api.onSnapshot(api.doc(api.db,'members',user.email),{includeMetadataChanges:true}, snapshot => {
      stopList();
      const item = snapshot.exists() && !snapshot.metadata.fromCache ? snapshot.data() : null;
      const member = item?.active === true && ['admin','teacher'].includes(item.role) ? item : null;
      access(member);
      el('account-status').textContent = `${user.email}｜${member ? (member.role === 'admin' ? '管理員' : '授權教師') : '尚無有效授權，請聯絡管理員。'}`;
      if (member?.role === 'admin') stopList = api.onSnapshot(api.collection(api.db,'members'),memberList,error => { el('member-message').textContent = errorMessage(error); });
    }, error => { stopList(); access(null); el('account-status').textContent = errorMessage(error); });
  });
}
el('google-login').addEventListener('click',async () => {
  if (!api) return;
  try { const provider = new api.GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'}); await api.signInWithPopup(api.auth,provider); }
  catch (error) { el('account-status').textContent = errorMessage(error); }
});
el('google-logout').addEventListener('click',async () => { try { await api.signOut(api.auth); } catch(error) { el('account-status').textContent = errorMessage(error); } });
el('member-form').addEventListener('submit',async event => {
  event.preventDefault(); if (!api || window.AUTH_MEMBER?.role !== 'admin') return;
  const email = el('member-email').value.trim().toLowerCase();
  if (email === user.email) { el('member-message').textContent = '不能修改自己的權限，請由另一位管理員操作。'; return; }
  const name = el('member-name').value.trim(); if (!name) return;
  try {
    await api.setDoc(api.doc(api.db,'members',email),{name,role:el('member-role').value,active:el('member-active').value === 'true',updatedAt:api.serverTimestamp(),updatedBy:user.uid});
    el('member-message').textContent = '權限已儲存。';
  } catch(error) { el('member-message').textContent = errorMessage(error); }
});
el('recruit-save').addEventListener('click',async () => {
  if (!api || !window.AUTH_MEMBER || !window.RECRUIT_PLANNER) return;
  const state = window.RECRUIT_PLANNER.snapshot();
  try {
    await api.setDoc(api.doc(api.db,'recruitmentPlans',`${user.uid}_${state.week}_${state.day}`),{...state,updatedAt:api.serverTimestamp(),updatedBy:user.uid});
    el('recruit-cloud-status').textContent = '已儲存此週、此星期的個人草稿（尚未送出至公開課表）。';
  } catch(error) { el('recruit-cloud-status').textContent = errorMessage(error); }
});
el('recruit-load').addEventListener('click',async () => {
  if (!api || !window.AUTH_MEMBER || !window.RECRUIT_PLANNER) return;
  try {
    const day = Number(el('recruit-day').value);
    const week=Number(el('recruit-week').value);
    const record = await api.getDocFromServer(api.doc(api.db,'recruitmentPlans',`${user.uid}_${week}_${day}`));
    if (!record.exists()) { el('recruit-cloud-status').textContent = '此帳號尚未儲存這個星期的安排。'; return; }
    if (!confirm('載入雲端安排將取代畫面中未儲存的安排，是否繼續？')) return;
    window.RECRUIT_PLANNER.restore(record.data()); el('recruit-cloud-status').textContent = '已載入並依目前課表重新檢查人員。';
  } catch(error) { el('recruit-cloud-status').textContent = errorMessage(error); }
});
access(null);
initialize().catch(error => { access(null); el('account-status').textContent = errorMessage(error); });
