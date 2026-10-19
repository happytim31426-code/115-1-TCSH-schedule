const el = id => document.getElementById(id);
let api, user = null, stopMember = () => {}, stopList = () => {};
function access(member) {
  window.AUTH_MEMBER = member;
  const adminMode = el('view-type').value === 'admin';
  el('member-admin').classList.toggle('is-hidden', !adminMode || member?.role !== 'admin');
  el('admin-access-note').classList.toggle('is-hidden', !adminMode || member?.role === 'admin');
  el('recruit-tool').hidden = !member;
  el('recruit-gate').classList.toggle('is-hidden', el('view-type').value !== 'recruit' || !!member);
  for (const id of ['recruit-save','recruit-load']) el(id).disabled = !member;
  if (!member) { el('member-list').replaceChildren(); el('recruit-cloud-status').textContent = ''; }
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
    await api.setDoc(api.doc(api.db,'recruitmentPlans',`${user.uid}_${state.day}`),{...state,updatedAt:api.serverTimestamp(),updatedBy:user.uid});
    el('recruit-cloud-status').textContent = '已儲存此星期的安排，同帳號同星期再次儲存會覆蓋草稿。';
  } catch(error) { el('recruit-cloud-status').textContent = errorMessage(error); }
});
el('recruit-load').addEventListener('click',async () => {
  if (!api || !window.AUTH_MEMBER || !window.RECRUIT_PLANNER) return;
  try {
    const day = Number(el('recruit-day').value);
    const record = await api.getDocFromServer(api.doc(api.db,'recruitmentPlans',`${user.uid}_${day}`));
    if (!record.exists()) { el('recruit-cloud-status').textContent = '此帳號尚未儲存這個星期的安排。'; return; }
    if (!confirm('載入雲端安排將取代畫面中未儲存的安排，是否繼續？')) return;
    window.RECRUIT_PLANNER.restore(record.data()); el('recruit-cloud-status').textContent = '已載入並依目前課表重新檢查人員。';
  } catch(error) { el('recruit-cloud-status').textContent = errorMessage(error); }
});
access(null);
initialize().catch(error => { access(null); el('account-status').textContent = errorMessage(error); });
