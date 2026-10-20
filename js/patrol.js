(() => {
  const W=window.WEEKLY,D=window.SCHEDULE_DATA,$=id=>document.getElementById(id),E=W.esc;
  const grades=['國一','國二','國三','高一','高二','高三'],issues=['師生音量需控管','學生趴睡需提醒','3C使用管理待提升','老師遲到/缺課','師生互動待提升','桌椅未靠攏','外堂課門窗未關','電燈、電扇未關','外堂課電視未關'];
  let drafts=new Map(),records=[],editing=null,loaded=false,saving=false,confirmDelete=null,submitted=new Set();
  const option=(v,t)=>`<option value="${E(v)}">${E(t)}</option>`;
  const patrolClosed=(c,period)=>['國一數理','國二數理'].includes(c.name)&&Number(period)>=1&&Number(period)<=7;
  $('patrol-period').innerHTML=Array.from({length:8},(_,i)=>option(String(i+1),D.classes[0].rows[i+1].period.name+' '+D.classes[0].rows[i+1].period.time)).join('');
  $('patrol-filter-grade').innerHTML=option('','全部年級')+grades.map(g=>option(g,g)).join('');
  $('patrol-filter-week').innerHTML=option('','全部週次')+W.weekOptions();
  $('patrol-class-select').innerHTML=W.orderedClasses.map(c=>option(c.id,`${c.name} ${c.publicCode}`)).join('');
  for(const id of ['patrol-class-week','patrol-staff-week'])$(id).innerHTML=option('','全部週次')+W.weekOptions();
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
  $('patrol-date').value=W.inTerm(today)&&W.dayOf(today)<5?today:W.start;
  function snapshot(c){return [...new Map(W.classLessons(c.id,$('patrol-date').value,Number($('patrol-period').value),'public').map(s=>[`${s.teacher}|${s.subject}`,{teacher:s.teacher||'待確認',subject:s.subject||'待確認'}])).values()];}
  function render(){
    const date=$('patrol-date').value,row=Number($('patrol-period').value),valid=W.inTerm(date)&&W.dayOf(date)>=0&&W.dayOf(date)<5;
    $('patrol-context').textContent=valid?`第${W.weekOf(date)}週｜星期${D.meta.days[W.dayOf(date)]}｜第${row}節｜巡堂人員：${window.AUTH_MEMBER?.name||'請登入'}${editing?'｜修正紀錄：保留當時課務快照':''}`:'請選擇學期內星期一至五。';
    $('patrol-sync').textContent=W.message;
    $('patrol-submit').disabled=saving||!valid||!W.ready||!loaded||!window.AUTH_MEMBER||!!(editing&&patrolClosed({name:editing.className},row));
    for(const id of ['patrol-date','patrol-period'])$(id).disabled=saving||!!editing;
    $('patrol-reset').disabled=saving;
    const classes=D.classes.filter(c=>!editing||c.id===editing.classId);
    $('patrol-classes').innerHTML=valid?grades.filter(g=>classes.some(c=>c.name.startsWith(g))).map(g=>`<section class="patrol-grade"><h2>${g}</h2><div class="patrol-grid">${classes.filter(c=>c.name.startsWith(g)).map(c=>{
      const d=drafts.get(c.id)||{result:'normal',issues:[],note:''},lessons=editing?editing.lessons:snapshot(c);
      if(patrolClosed(c,row))return `<section class="patrol-class patrol-closed" data-patrol-closed="${E(c.id)}"><h3>${E(c.name)} ${E(c.publicCode)}</h3><p>第1～7節免巡堂登錄，第8節才開放。</p><label>巡查結果<select disabled aria-label="${E(c.name)}本節免登錄"><option>免登錄（本節不送出）</option></select></label></section>`;
      if(!editing&&submitted.has(c.id))return `<section class="patrol-class"><h3>${E(c.name)} ${E(c.publicCode)}</h3><p>✓ 本次已送出，可至下方紀錄修正。</p></section>`;
      return `<section class="patrol-class" data-patrol-class="${E(c.id)}"><h3>${E(c.name)} ${E(c.publicCode)}</h3><p>${lessons.map(s=>`${E(s.subject)}｜${E(s.teacher)}`).join('<br>')||'無課／停課，或任課資訊待確認'}</p><label>巡查結果<select data-patrol-result ${saving?'disabled':''}>${[['unvisited','未巡查'],['normal','已巡正常'],['issue','需處理']].map(([v,t])=>`<option value="${v}" ${v===d.result?'selected':''}>${t}</option>`).join('')}</select></label><div class="patrol-issues" ${d.result==='issue'?'':'hidden'}>${issues.map((s,i)=>`<label><input type="checkbox" data-patrol-issue="${i}" ${d.issues.includes(s)?'checked':''} ${saving?'disabled':''}>${E(s)}</label>`).join('')}</div><label ${d.result==='unvisited'?'hidden':''}>其他問題／說明（勿填學生姓名、病情等敏感資料）<textarea data-patrol-note maxlength="500" rows="2" ${saving?'disabled':''}>${E(d.note)}</textarea></label></section>`;
    }).join('')}</div></section>`).join(''):'';
  }
  $('patrol-reset').onclick=()=>{if(drafts.size&&!confirm('清除未送出的內容？'))return;drafts.clear();editing=null;submitted.clear();render();};
  for(const id of ['patrol-date','patrol-period'])$(id).addEventListener('change',()=>{if(drafts.size&&!confirm('切換日期或節次將清除未送出內容，確定？')){const first=[...drafts.values()][0];$(id).value=first?.[id==='patrol-date'?'date':'period']||$(id).value;return;}drafts.clear();submitted.clear();render();});
  function capture(e){const card=e.target.closest('[data-patrol-class]');if(!card)return;drafts.set(card.dataset.patrolClass,{date:$('patrol-date').value,period:$('patrol-period').value,result:card.querySelector('select').value,issues:[...card.querySelectorAll('[data-patrol-issue]:checked')].map(i=>issues[Number(i.dataset.patrolIssue)]),note:card.querySelector('textarea').value});if(e.target.matches('select'))render();}
  $('patrol-classes').addEventListener('change',capture);$('patrol-classes').addEventListener('input',e=>{if(e.target.matches('textarea'))capture(e);});
  function payload(r){return Object.fromEntries(['date','week','period','classId','className','grade','lessons','result','issues','note','status'].map(k=>[k,r[k]]));}
  $('patrol-form').addEventListener('submit',async e=>{
    e.preventDefault();if(saving||!window.AUTH_MEMBER||!W.ready||!loaded)return;
    const date=$('patrol-date').value,period=Number($('patrol-period').value),selected=(editing?D.classes.filter(c=>c.id===editing.classId):D.classes.filter(c=>!submitted.has(c.id))).filter(c=>!patrolClosed(c,period)).map(c=>[c.id,drafts.get(c.id)||{result:'normal',issues:[],note:''}]).filter(([,d])=>d.result!=='unvisited');
    if(!W.inTerm(date)||W.dayOf(date)<0||W.dayOf(date)>4)return;
    if(!selected.length){$('patrol-status').textContent='請至少登錄一個已巡查班級。';return;}
    if(selected.some(([,d])=>d.result==='issue'&&!d.issues.length&&!d.note.trim())){$('patrol-status').textContent='需處理的班級請勾選項目或填寫說明。';return;}
    const entries=selected.map(([id,d])=>{const c=D.classes.find(c=>c.id===id);return {id:editing?.id||crypto.randomUUID(),revision:editing?.revision||0,data:{date,week:W.weekOf(date),period,classId:id,className:c.name,grade:c.name.slice(0,2),lessons:editing?editing.lessons:snapshot(c),result:d.result,issues:d.result==='issue'?d.issues:[],note:d.note.trim(),status:'submitted'}};});
    saving=true;render();$('patrol-status').textContent='正在儲存…';
    let completed=0;
    try{await window.PATROL_API.save(entries,chunk=>{completed+=chunk.length;for(const entry of chunk){if(!editing)submitted.add(entry.data.classId);drafts.delete(entry.data.classId);}});if(!completed)for(const [id] of selected){if(!editing)submitted.add(id);drafts.delete(id);}editing=null;$('patrol-status').textContent=`已送出${entries.length}個班級的紀錄，分析同步更新。`;}
    catch(error){$('patrol-status').textContent=`${completed?`已送出${completed}筆；其餘`:'未送出，'}內容保留，重試只送剩餘班級：${error.message}`;}finally{saving=false;render();}
  });
  function analysis(){
    const week=$('patrol-filter-week').value,grade=$('patrol-filter-grade').value,t=$('patrol-filter-teacher').value.trim(),n=$('patrol-filter-recorder').value.trim();
    const filtered=records.filter(r=>(!week||r.week===Number(week))&&(!grade||r.grade===grade)&&(!t||r.lessons.some(s=>s.teacher.includes(t)))&&(!n||(r.createdName||'').includes(n))),live=records.filter(r=>r.status!=='deleted'),summary=filtered.filter(r=>r.status!=='deleted'),normal=summary.filter(r=>r.result==='normal').length;
    $('patrol-analysis-status').textContent=loaded?'已同步。統計以班級巡查筆數計算，未巡查不視為正常。':'尚未同步巡堂資料；請確認登入與新版資料庫規則。';
    $('patrol-summary').innerHTML=`<p>已巡查${summary.length}筆｜正常${normal}筆｜需處理${summary.length-normal}筆｜巡堂人員${new Set(summary.map(r=>r.createdBy)).size}人</p><ul>${issues.map(s=>`<li>${E(s)}：${summary.filter(r=>r.issues.includes(s)).length}筆</li>`).join('')}</ul><p>同一筆可有多項；雙師／跑班保留多位教師，不自動歸責單一教師。</p>`;
    const counts=list=>({total:list.length,normal:list.filter(r=>r.result==='normal').length,issue:list.filter(r=>r.result==='issue').length});
    const classWeek=$('patrol-class-week').value,classId=$('patrol-class-select').value,classList=live.filter(r=>r.classId===classId&&(!classWeek||r.week===Number(classWeek))),c=counts(classList),classInfo=D.classes.find(c=>c.id===classId);
    $('patrol-class-summary').innerHTML=`<h4>${E(classInfo?.name||'')}｜${classWeek?`第${Number(classWeek)}週`:'全部週次'}</h4><p>巡查${c.total}筆｜正常${c.normal}筆｜需處理${c.issue}筆</p><ul>${issues.map(s=>`<li>${E(s)}：${classList.filter(r=>r.issues.includes(s)).length}筆</li>`).join('')}</ul><p>其他問題／補充說明：${classList.filter(r=>r.note.trim()).length}筆（可至下方逐筆紀錄查看）。</p>`;
    const staffWeek=$('patrol-staff-week').value,staffList=live.filter(r=>!staffWeek||r.week===Number(staffWeek)),staff=new Map();
    for(const r of staffList){const key=r.createdBy||r.createdName||'unknown';if(!staff.has(key))staff.set(key,{name:r.createdName||'舊紀錄未記名',sessions:new Map(),count:0});const person=staff.get(key);person.count++;const sessionKey=`${r.date}|${r.period}`;if(!person.sessions.has(sessionKey))person.sessions.set(sessionKey,{date:r.date,period:r.period,week:r.week,classes:new Set(),issues:0});const s=person.sessions.get(sessionKey);s.classes.add(r.className);if(r.result==='issue')s.issues++;}
    const recordedNames=new Set([...staff.values()].map(p=>p.name));
    for(const name of new Set([...$('patrol-roster').querySelectorAll('td')].map(cell=>cell.textContent.trim()).filter(n=>n&&n!=='待補'))){if(!recordedNames.has(name))staff.set(`roster:${name}`,{name,sessions:new Map(),count:0});}
    $('patrol-staff-summary').innerHTML=[...staff.values()].sort((a,b)=>b.sessions.size-a.sessions.size||a.name.localeCompare(b.name,'zh-TW')).map(p=>`<details><summary>${E(p.name)}｜巡堂${p.sessions.size}次｜班級巡查${p.count}筆</summary>${p.sessions.size?'':'<p>此查詢範圍尚無巡堂紀錄。</p>'}<ul>${[...p.sessions.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.period-a.period).map(s=>`<li>第${s.week}週｜${E(s.date)} 星期${D.meta.days[W.dayOf(s.date)]} 第${s.period}節｜${s.classes.size}班｜需處理${s.issues}筆<br>${[...s.classes].map(E).join('、')}</li>`).join('')}</ul></details>`).join('')||'<p>目前沒有巡堂人員紀錄。</p>';
    $('patrol-records').innerHTML=window.RECORD_PAGES.sort(filtered).map(r=>`<article class="teaching-record"><h3>${E(r.date)} 第${r.period}節 ${E(r.className)}｜${r.status==='deleted'?'已刪除':r.result==='normal'?'已巡正常':'需處理'}</h3><p>當時課務：${r.lessons.map(s=>`${E(s.subject)}／${E(s.teacher)}`).join('、')||'無課或待確認'}</p><p>${r.issues.map(E).join('、')}</p><p>${E(r.note)}</p><p class="record-meta">${E(W.auditText(r))}</p>${r.status!=='deleted'?`<button type="button" class="person-button" data-patrol-edit="${E(r.id)}">修正</button><button type="button" class="person-button" data-patrol-delete="${E(r.id)}">${confirmDelete===r.id?'確認刪除':'刪除'}</button>`:''}</article>`).join('')||'<p>沒有符合條件的紀錄。</p>';
    window.RECORD_PAGES.render('patrol-records');
  }
  for(const id of ['patrol-filter-week','patrol-filter-grade','patrol-filter-teacher','patrol-filter-recorder','patrol-class-select','patrol-class-week','patrol-staff-week'])$(id).addEventListener('input',analysis);
  $('patrol-records').addEventListener('click',async e=>{
    const edit=e.target.closest('[data-patrol-edit]'),del=e.target.closest('[data-patrol-delete]');if(!edit&&!del)return;
    const r=records.find(r=>r.id===(edit?edit.dataset.patrolEdit:del.dataset.patrolDelete));if(!r)return;
    if(edit){if(drafts.size&&!confirm('取代未送出的內容？'))return;editing=r;drafts=new Map([[r.classId,{...r}]]);$('patrol-date').value=r.date;$('patrol-period').value=r.period;$('patrol-open').click();render();return;}
    if(confirmDelete!==r.id){confirmDelete=r.id;analysis();return;}
    del.disabled=true;try{await window.PATROL_API.save([{id:r.id,revision:r.revision,data:{...payload(r),status:'deleted'}}]);confirmDelete=null;}catch(error){$('patrol-analysis-status').textContent=`刪除未完成：${error.message}`;del.disabled=false;}
  });
  window.addEventListener('cloud-patrol-records',e=>{records=e.detail;loaded=true;analysis();render();});
  window.addEventListener('patrol-sync-error',e=>{loaded=false;analysis();$('patrol-analysis-status').textContent=e.detail;$('patrol-status').textContent=e.detail;render();});
  window.addEventListener('authorization-changed',()=>{if(!window.AUTH_MEMBER){drafts.clear();submitted.clear();records=[];editing=null;loaded=false;$('patrol-status').textContent='';}render();analysis();});
  window.addEventListener('weekly-changed',render);render();analysis();
})();
