(() => {
  const directors = ['張齡之','游棋竹','林昱汝','薛靜儀','林曉瑩','陳雲亮','陳柏伶','張玉蓉','謝淑惠'];
  const excluded = new Set(['李曉蘭','周成蓉','傅克斯','曾愛達','盧鈺縈','李榮洲','張簡景鈴','賴昀締','許家銘','陳奕霖','葉梅花','劉柔秀']);
  const homerooms = new Set(data.classes.map(item => item.homeroomTeacher));
  const people = [...data.teachers.map(item => ({name:item.name, known:true})), ...directors.filter(name => !teacher(name)).map(name => ({name,known:false}))];
  if (!people.some(item => item.name === '鍾芬芳')) people.push({name:'鍾芬芳',known:true,staff:true});
  const createSchool = () => ({need:1,long:false,leader:null,members:[]});
  let plans = [createSchool()], active = 0;
  const daySelect = document.querySelector('#recruit-day');
  const W=window.WEEKLY, weekSelect=document.querySelector('#recruit-week');
  weekSelect.innerHTML=W.weekOptions();weekSelect.value=document.querySelector('#swap-week').value||'8';
  let saved=new Map(), drafts=new Map(), editing=false, pending=false, statisticsLoaded=false;
  const date=()=>W.dateFor(Number(weekSelect.value),Number(daySelect.value));
  let selectedDate=date();
  const periodBusy=(name,row)=>W.lessons(name,date(),row,'admin').length>0||W.onLeave(name,date(),row,'admin')||W.teacherEventBusy(name,date(),row);
  const roster = document.querySelector('#recruit-roster');
  const schoolArea = document.querySelector('#school-plans');
  const message = document.querySelector('#recruit-message');
  const assigned = name => plans.some(plan => plan.leader === name || plan.members.includes(name));
  const available = (person, second = false) => !!person && !excluded.has(person.name) && !periodBusy(person.name,1) && (!second || !periodBusy(person.name,2));
  const findPerson = name => people.find(item => item.name === name);
  const say = text => { message.textContent = text; };
  function personButton(person, role) {
    const permitted = available(person,plans[active].long);
    const note = periodBusy(person.name,2) ? '<sup aria-label="第二節有課">*</sup>' : '';
    return `<button type="button" class="person-button" data-person="${person.name}" data-role="${role}" ${permitted ? '' : 'disabled'}>${person.name}${note}</button>`;
  }
  function renderStatistics(){
    const summary=document.querySelector('#recruit-statistics-summary'),output=document.querySelector('#recruit-statistics-results');
    if(!statisticsLoaded){summary.textContent='尚未讀取雲端招生紀錄，暫不計算。';output.replaceChildren();return;}
    const counts=new Map(),add=name=>{if(typeof name!=='string'||!name.trim())return null;name=name.trim();if(!counts.has(name))counts.set(name,{name,leader:0,member:0,total:0});return counts.get(name);};
    people.filter(p=>!excluded.has(p.name)).forEach(p=>add(p.name));
    const submitted=[...saved.values()].filter(r=>r.status==='submitted');
    for(const record of submitted){const leaders=new Set(),members=new Set();for(const plan of Array.isArray(record.plans)?record.plans:[]){if(typeof plan.leader==='string'&&plan.leader.trim())leaders.add(plan.leader.trim());for(const name of Array.isArray(plan.members)?plan.members:[])if(typeof name==='string'&&name.trim())members.add(name.trim());}for(const name of new Set([...leaders,...members])){const item=add(name);item.total++;if(leaders.has(name))item.leader++;else item.member++;}}
    const list=[...counts.values()].sort((a,b)=>b.total-a.total||(Number(teacher(a.name)?.id)||Infinity)-(Number(teacher(b.name)?.id)||Infinity)||a.name.localeCompare(b.name,'zh-TW'));
    summary.textContent=`有效安排${submitted.length}天｜曾安排${list.filter(p=>p.total>0).length}人｜累計派出${list.reduce((sum,p)=>sum+p.total,0)}人次（全學期，依雲端已同步紀錄計算）`;
    const query=document.querySelector('#recruit-statistics-query').value.trim(),visible=list.filter(p=>!query||p.name.includes(query)||String(teacher(p.name)?.id||'').includes(query));
    output.innerHTML=`<table><thead><tr><th scope="col">教師／職員</th><th scope="col">帶隊</th><th scope="col">入班</th><th scope="col">合計</th></tr></thead><tbody>${visible.map(p=>`<tr data-recruit-stat-name="${W.esc(p.name)}"><th scope="row">${W.esc(teacher(p.name)?.id||'')} ${W.esc(p.name)}</th><td>${p.leader}</td><td>${p.member}</td><td>${p.total}</td></tr>`).join('')}</tbody></table>${visible.length?'':'<p>沒有符合的教師。</p>'}`;
  }
  document.querySelector('#recruit-statistics-query').addEventListener('input',renderStatistics);
  function render() {
    renderStatistics();
    const current=saved.get(date()),locked=pending||(current?.status==='submitted'&&!editing);
    document.querySelector('#recruit-publication-status').textContent=`${W.formatDate(date())}｜${current?.status==='submitted'&&!editing?'已送出':current?.status==='cancelled'?'已取消':current?.status==='deleted'?'已刪除':'草稿／待送出'}${current?`｜${W.auditText(current)}`:''}${pending?'（儲存中…）':''}`;
    document.querySelector('#recruit-records').innerHTML=window.RECORD_PAGES.sort([...saved.values()]).map(r=>`<article class="teaching-record"><b>第${r.week}週 ${W.formatDate(r.date)}｜${({submitted:'已送出',returned:'已退回',cancelled:'已取消',deleted:'已刪除'})[r.status]||'草稿'}</b><p class="record-meta">${W.esc(W.auditText(r))}</p>${r.plans.map((p,i)=>`<p>第${i+1}間｜帶隊：${W.esc(p.leader||'未選')}｜入班：${p.members.map(W.esc).join('、')||'無'}｜需求${p.need}人｜${p.long?'車程超過30分鐘':'車程30分鐘內'}</p>`).join('')}${r.status!=='deleted'?`<button type="button" class="person-button" data-recruit-open="${r.date}">查看／修正</button><button type="button" class="person-button" data-recruit-delete="${r.date}">整筆刪除</button>`:''}</article>`).join('')||'<p>目前尚無已儲存的招生紀錄。</p>';
    window.RECORD_PAGES.render('recruit-records');
    document.querySelector('#recruit-publish').hidden=locked;
    for(const id of ['recruit-recall','recruit-cancel'])document.querySelector('#'+id).hidden=current?.status!=='submitted'||pending;
    document.querySelector('#school-count').disabled=locked;
    const pool = people.filter(person => !assigned(person.name) && available(person));
    const group = (heading,items,role) => `<section><h4>${heading}</h4><div class="person-list">${items.map(person => personButton(person,role)).join('') || '<p>無可用人員</p>'}</div></section>`;
    const leaders = pool.filter(person => directors.includes(person.name));
    roster.innerHTML = `<p>目前安排：第 ${active+1} 間學校${plans[active].long ? '（限第一、二節皆無課）' : ''}</p><div class="recruit-columns"><section class="recommendation-box"><h3>帶隊老師推薦清單</h3><div class="person-list">${leaders.map(person => personButton(person,'leader')).join('') || '<p>無可用人員</p>'}</div></section><section class="recommendation-box"><h3>入班老師推薦清單</h3><div class="recruit-groups">${group('非導師',pool.filter(person => !directors.includes(person.name) && !homerooms.has(person.name) && !person.staff),'member')}${group('導師',pool.filter(person => !directors.includes(person.name) && homerooms.has(person.name)),'member')}${group('職員',pool.filter(person => person.staff),'member')}${group('主任亦可擔任入班老師',leaders,'member')}</div></section></div>`;
    schoolArea.style.gridTemplateColumns = `repeat(${plans.length}, minmax(260px, 1fr))`;
    schoolArea.innerHTML = plans.map((plan,index) => `<section class="school-plan ${index === active ? 'active-school' : ''}"><button type="button" class="action-button" data-school="${index}" aria-pressed="${index === active}">安排第 ${index+1} 間學校</button><label>需求入班人數<select data-need="${index}">${Array.from({length:20},(_,n) => `<option value="${n+1}" ${plan.need === n+1 ? 'selected' : ''}>${n+1}</option>`).join('')}</select></label><label>返校車程是否超過30分鐘<select data-long="${index}"><option value="no" ${!plan.long ? 'selected' : ''}>否</option><option value="yes" ${plan.long ? 'selected' : ''}>是</option></select></label><h4>帶隊老師（${plan.leader ? 1 : 0}/1）</h4><div class="assigned-list">${plan.leader ? `<button type="button" class="person-button" data-remove="${plan.leader}" data-plan="${index}">${plan.leader} ×</button>` : '尚未選擇'}</div><h4>入班宣導老師（${plan.members.length}/${plan.need-1}）</h4><div class="assigned-list">${plan.members.map(name => `<button type="button" class="person-button" data-remove="${name}" data-plan="${index}">${name} ×</button>`).join('') || '尚未選擇'}</div><p>${plan.leader && plan.members.length === plan.need-1 ? '✓ 人數已滿足' : '待安排'}</p></section>`).join('');
    if(locked)for(const control of document.querySelectorAll('#school-plans button,#school-plans select,#recruit-roster button'))control.disabled=true;
  }
  roster.addEventListener('click',event => {
    const button = event.target.closest('[data-person]'); if (!button) return;
    const name = button.dataset.person, plan = plans[active];
    if (assigned(name) || !available(findPerson(name),plan.long)) return;
    if (button.dataset.role === 'leader') {
      if (plan.leader) return say('此校已有帶隊老師，請先點姓名移回推薦清單。');
      plan.leader = name;
    } else {
      if (plan.members.length >= plan.need-1) return say('入班人數已滿，請調整需求人數或先移回人員。');
      plan.members.push(name);
    }
    say(''); render();
  });
  schoolArea.addEventListener('click',event => {
    const select = event.target.closest('[data-school]');
    if (select) { active = Number(select.dataset.school); say(''); render(); return; }
    const remove = event.target.closest('[data-remove]');
    if (remove) { const plan = plans[Number(remove.dataset.plan)]; if (plan.leader === remove.dataset.remove) plan.leader = null; plan.members = plan.members.filter(name => name !== remove.dataset.remove); say('人員已移回推薦清單。'); render(); }
  });
  schoolArea.addEventListener('change',event => {
    const element = event.target;
    if (element.dataset.need !== undefined) {
      const plan = plans[Number(element.dataset.need)]; plan.need = Number(element.value);
      const removed = plan.members.splice(plan.need-1); say(removed.length ? `超出名額的人員已移回：${removed.join('、')}` : '');
    }
    if (element.dataset.long !== undefined) {
      const plan = plans[Number(element.dataset.long)]; plan.long = element.value === 'yes';
      const removed = [];
      if (plan.leader && !available(findPerson(plan.leader),plan.long)) { removed.push(plan.leader); plan.leader = null; }
      plan.members = plan.members.filter(name => { if (available(findPerson(name),plan.long)) return true; removed.push(name); return false; });
      say(removed.length ? `不符合車程條件的人員已移回：${removed.join('、')}` : '');
    }
    render();
  });
  document.querySelector('#school-count').addEventListener('change',event => {
    const count = Number(event.target.value); plans = plans.slice(0,count); while (plans.length < count) plans.push(createSchool()); active = Math.min(active,count-1); say(''); render();
  });
  function switchDate(){drafts.set(selectedDate,JSON.parse(JSON.stringify(plans)));selectedDate=date();editing=false;plans=JSON.parse(JSON.stringify(saved.get(date())?.plans||drafts.get(date())||[createSchool()]));active=0;document.querySelector('#school-count').value=String(plans.length);say('');render();}
  daySelect.addEventListener('change',switchDate);weekSelect.addEventListener('change',switchDate);
  async function transition(status){
    if(!window.AUTH_MEMBER||pending)return;
    try{
      if(!W.inTerm(date()))throw Error('此日期不在學期內。');
      if(status==='submitted')for(const plan of plans){if(!plan.leader||plan.members.length!==plan.need-1)throw Error('請先完成每間學校的帶隊與入班人數。');for(const name of [plan.leader,...plan.members])if(!available(findPerson(name),plan.long))throw Error(`${name} 的課務已變動，請重新安排。`);}
      if(!window.CLOUD_RECORDS)throw Error('雲端尚未就緒，請確認登入、網路及新版 Firestore 規則。');
      const current=saved.get(date()),record={week:Number(weekSelect.value),day:Number(daySelect.value),date:date(),plans:JSON.parse(JSON.stringify(plans)),status};
      const people=plans.flatMap(p=>[p.leader,...p.members].filter(Boolean).map(name=>({name,long:p.long})));
      pending=true;render();await window.CLOUD_RECORDS.save('recruit',date(),record,status==='deleted'?null:{date:date(),people:status==='submitted'?people:[]},current?.revision||0);
      editing=false;say(status==='submitted'?'已送出，公開代調課同步顯示招生標記。':status==='returned'?'已整筆退回，可修正後再次送出；公開標記已移除。':'已取消；公開標記已移除。');
    }catch(error){say(error.message);}finally{pending=false;render();}
  }
  document.querySelector('#recruit-publish').addEventListener('click',()=>transition('submitted'));
  document.querySelector('#recruit-recall').addEventListener('click',()=>transition('returned'));
  document.querySelector('#recruit-cancel').addEventListener('click',()=>{if(confirm('確定取消此日整筆招生安排？'))transition('cancelled');});
  document.querySelector('#recruit-records').addEventListener('click',async event=>{const b=event.target.closest('[data-recruit-open],[data-recruit-delete]');if(!b||!window.AUTH_MEMBER||pending)return;const r=saved.get(b.dataset.recruitOpen||b.dataset.recruitDelete);if(!r)return;weekSelect.value=String(r.week);daySelect.value=String(r.day);switchDate();if(b.dataset.recruitDelete){if(confirm('整筆刪除此日招生安排？公開招生標記會移除，行政端保留刪除狀態。'))await transition('deleted');}else{say(r.status==='submitted'?'請先按「整筆退回修正」，再修改名單並重新送出。':'可直接修正後重新送出。');document.querySelector('#recruit-tool').scrollIntoView({behavior:'smooth'});}});
  window.addEventListener('cloud-recruit-records',event=>{const previous=saved.get(date());saved=new Map(event.detail.map(r=>[r.date,r]));statisticsLoaded=true;const current=saved.get(date());if(current&&current.revision!==previous?.revision){plans=JSON.parse(JSON.stringify(current.plans));document.querySelector('#school-count').value=String(plans.length);active=Math.min(active,plans.length-1);}render();});
  window.addEventListener('authorization-changed',()=>{if(!window.AUTH_MEMBER){saved.clear();drafts.clear();statisticsLoaded=false;document.querySelector('#recruit-statistics-query').value='';plans=[createSchool()];active=0;document.querySelector('#school-count').value='1';render();}});
  window.RECRUIT_PLANNER = {
    snapshot: () => ({week:Number(weekSelect.value),day:Number(daySelect.value),plans:JSON.parse(JSON.stringify(plans))}),
    restore: state => {
      if (!Number.isInteger(state.day) || state.day < 0 || state.day > 4 || !Array.isArray(state.plans) || state.plans.length < 1 || state.plans.length > 5) throw Error('雲端安排格式不正確');
      if(state.week)weekSelect.value=String(state.week);
      if(saved.get(W.dateFor(Number(weekSelect.value),state.day))?.status==='submitted')throw Error('此日已有送出結果，請先整筆退回修正。');
      const used = new Set(); daySelect.value = String(state.day);selectedDate=date();
      plans = state.plans.map(saved => {
        const plan = createSchool(); plan.need = Number.isInteger(saved.need) ? Math.max(1,Math.min(20,saved.need)) : 1; plan.long = saved.long === true;
        const accept = name => { if (used.has(name) || !available(findPerson(name),plan.long)) return false; used.add(name); return true; };
        if (directors.includes(saved.leader) && accept(saved.leader)) plan.leader = saved.leader;
        for (const name of Array.isArray(saved.members) ? saved.members : []) if (plan.members.length < plan.need-1 && accept(name)) plan.members.push(name);
        return plan;
      });
      active = 0; document.querySelector('#school-count').value = String(plans.length); say(''); render();
    },
  };
  window.addEventListener('weekly-changed',render);
  render();
})();
