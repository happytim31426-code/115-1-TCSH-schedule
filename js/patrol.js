(() => {
  const W=window.WEEKLY,D=window.SCHEDULE_DATA,$=id=>document.getElementById(id),E=W.esc;
  const grades=['國一','國二','國三','高一','高二','高三'],issues=['師生音量需控管','學生趴睡需提醒','3C使用管理待提升','老師遲到/缺課','師生互動待提升','桌椅未靠攏','外堂課門窗未關','電燈、電扇未關','外堂課電視未關'];
  let drafts=new Map(),records=[],editing=null,loaded=false,saving=false,confirmDelete=null;
  const option=(v,t)=>`<option value="${E(v)}">${E(t)}</option>`;
  $('patrol-period').innerHTML=Array.from({length:8},(_,i)=>option(String(i+1),D.classes[0].rows[i+1].period.name+' '+D.classes[0].rows[i+1].period.time)).join('');
  $('patrol-grade').innerHTML=grades.map(g=>option(g,g)).join('');
  $('patrol-filter-grade').innerHTML=option('','全部年級')+grades.map(g=>option(g,g)).join('');
  $('patrol-filter-week').innerHTML=option('','全部週次')+W.weekOptions();
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
  $('patrol-date').value=W.inTerm(today)&&W.dayOf(today)<5?today:W.start;
  function snapshot(c){return [...new Map(W.classLessons(c.id,$('patrol-date').value,Number($('patrol-period').value),'public').map(s=>[`${s.teacher}|${s.subject}`,{teacher:s.teacher||'待確認',subject:s.subject||'待確認'}])).values()];}
  function render(){
    const date=$('patrol-date').value,row=Number($('patrol-period').value),valid=W.inTerm(date)&&W.dayOf(date)>=0&&W.dayOf(date)<5;
    $('patrol-context').textContent=valid?`第${W.weekOf(date)}週｜星期${D.meta.days[W.dayOf(date)]}｜第${row}節｜巡堂人員：${window.AUTH_MEMBER?.name||'請登入'}${editing?'｜修正紀錄：保留當時課務快照':''}`:'請選擇學期內星期一至五。';
    $('patrol-sync').textContent=W.message;
    $('patrol-submit').disabled=saving||!valid||!W.ready||!loaded||!window.AUTH_MEMBER;
    for(const id of ['patrol-date','patrol-period','patrol-grade'])$(id).disabled=saving||!!editing;
    $('patrol-reset').disabled=saving;
    const classes=D.classes.filter(c=>editing?c.id===editing.classId:c.name.startsWith($('patrol-grade').value));
    $('patrol-classes').innerHTML=valid?classes.map(c=>{
      const d=drafts.get(c.id)||{result:'unvisited',issues:[],note:''},lessons=editing?editing.lessons:snapshot(c);
      return `<section class="patrol-class" data-patrol-class="${E(c.id)}"><h3>${E(c.name)} ${E(c.publicCode)}</h3><p>${lessons.map(s=>`${E(s.subject)}｜${E(s.teacher)}`).join('<br>')||'無課／停課，或任課資訊待確認'}</p><label>巡查結果<select data-patrol-result ${saving?'disabled':''}>${[['unvisited','未巡查'],['normal','已巡正常'],['issue','需處理']].map(([v,t])=>`<option value="${v}" ${v===d.result?'selected':''}>${t}</option>`).join('')}</select></label><div class="patrol-issues" ${d.result==='issue'?'':'hidden'}>${issues.map((s,i)=>`<label><input type="checkbox" data-patrol-issue="${i}" ${d.issues.includes(s)?'checked':''} ${saving?'disabled':''}>${E(s)}</label>`).join('')}</div><label ${d.result==='unvisited'?'hidden':''}>其他問題／說明（勿填學生姓名、病情等敏感資料）<textarea data-patrol-note maxlength="500" rows="2" ${saving?'disabled':''}>${E(d.note)}</textarea></label></section>`;
    }).join(''):'';
  }
  $('patrol-reset').onclick=()=>{if(drafts.size&&!confirm('清除未送出的內容？'))return;drafts.clear();editing=null;render();};
  for(const id of ['patrol-date','patrol-period'])$(id).addEventListener('change',()=>{if(drafts.size&&!confirm('切換日期或節次將清除未送出內容，確定？')){const first=[...drafts.values()][0];$(id).value=first?.[id==='patrol-date'?'date':'period']||$(id).value;return;}drafts.clear();render();});
  $('patrol-grade').addEventListener('change',render);
  function capture(e){const card=e.target.closest('[data-patrol-class]');if(!card)return;drafts.set(card.dataset.patrolClass,{date:$('patrol-date').value,period:$('patrol-period').value,result:card.querySelector('select').value,issues:[...card.querySelectorAll('[data-patrol-issue]:checked')].map(i=>issues[Number(i.dataset.patrolIssue)]),note:card.querySelector('textarea').value});if(e.target.matches('select'))render();}
  $('patrol-classes').addEventListener('change',capture);$('patrol-classes').addEventListener('input',e=>{if(e.target.matches('textarea'))capture(e);});
  function payload(r){return Object.fromEntries(['date','week','period','classId','className','grade','lessons','result','issues','note','status'].map(k=>[k,r[k]]));}
  $('patrol-form').addEventListener('submit',async e=>{
    e.preventDefault();if(saving||!window.AUTH_MEMBER||!W.ready||!loaded)return;
    const date=$('patrol-date').value,period=Number($('patrol-period').value),selected=[...drafts].filter(([id,d])=>d.result!=='unvisited'&&(editing||D.classes.find(c=>c.id===id)?.name.startsWith($('patrol-grade').value)));
    if(!W.inTerm(date)||W.dayOf(date)<0||W.dayOf(date)>4)return;
    if(!selected.length){$('patrol-status').textContent='請至少登錄一個已巡查班級。';return;}
    if(selected.some(([,d])=>d.result==='issue'&&!d.issues.length&&!d.note.trim())){$('patrol-status').textContent='需處理的班級請勾選項目或填寫說明。';return;}
    const entries=selected.map(([id,d])=>{const c=D.classes.find(c=>c.id===id);return {id:editing?.id||crypto.randomUUID(),revision:editing?.revision||0,data:{date,week:W.weekOf(date),period,classId:id,className:c.name,grade:c.name.slice(0,2),lessons:editing?editing.lessons:snapshot(c),result:d.result,issues:d.result==='issue'?d.issues:[],note:d.note.trim(),status:'submitted'}};});
    saving=true;render();$('patrol-status').textContent='正在儲存…';
    try{await window.PATROL_API.save(entries);for(const [id] of selected)drafts.delete(id);editing=null;$('patrol-status').textContent=`已送出${entries.length}個班級的紀錄，分析同步更新。其他年級未送出內容仍保留。`;}
    catch(error){$('patrol-status').textContent=`未送出，內容保留：${error.message}`;}finally{saving=false;render();}
  });
  function analysis(){
    const week=$('patrol-filter-week').value,grade=$('patrol-filter-grade').value,t=$('patrol-filter-teacher').value.trim(),n=$('patrol-filter-recorder').value.trim();
    const filtered=records.filter(r=>(!week||r.week===Number(week))&&(!grade||r.grade===grade)&&(!t||r.lessons.some(s=>s.teacher.includes(t)))&&(!n||(r.createdName||'').includes(n))),live=filtered.filter(r=>r.status!=='deleted'),normal=live.filter(r=>r.result==='normal').length;
    $('patrol-analysis-status').textContent=loaded?'已同步。統計以班級巡查筆數計算，未巡查不視為正常。':'尚未同步巡堂資料；請確認登入與新版資料庫規則。';
    $('patrol-summary').innerHTML=`<p>已巡查${live.length}筆｜正常${normal}筆｜需處理${live.length-normal}筆｜巡堂人員${new Set(live.map(r=>r.createdBy)).size}人</p><ul>${issues.map(s=>`<li>${E(s)}：${live.filter(r=>r.issues.includes(s)).length}筆</li>`).join('')}</ul><p>同一筆可有多項；雙師／跑班保留多位教師，不自動歸責單一教師。</p>`;
    $('patrol-records').innerHTML=window.RECORD_PAGES.sort(filtered).map(r=>`<article class="teaching-record"><h3>${E(r.date)} 第${r.period}節 ${E(r.className)}｜${r.status==='deleted'?'已刪除':r.result==='normal'?'已巡正常':'需處理'}</h3><p>當時課務：${r.lessons.map(s=>`${E(s.subject)}／${E(s.teacher)}`).join('、')||'無課或待確認'}</p><p>${r.issues.map(E).join('、')}</p><p>${E(r.note)}</p><p class="record-meta">${E(W.auditText(r))}</p>${r.status!=='deleted'?`<button type="button" class="person-button" data-patrol-edit="${E(r.id)}">修正</button><button type="button" class="person-button" data-patrol-delete="${E(r.id)}">${confirmDelete===r.id?'確認刪除':'刪除'}</button>`:''}</article>`).join('')||'<p>沒有符合條件的紀錄。</p>';
    window.RECORD_PAGES.render('patrol-records');
  }
  for(const id of ['patrol-filter-week','patrol-filter-grade','patrol-filter-teacher','patrol-filter-recorder'])$(id).addEventListener('input',analysis);
  $('patrol-records').addEventListener('click',async e=>{
    const edit=e.target.closest('[data-patrol-edit]'),del=e.target.closest('[data-patrol-delete]');if(!edit&&!del)return;
    const r=records.find(r=>r.id===(edit?edit.dataset.patrolEdit:del.dataset.patrolDelete));if(!r)return;
    if(edit){if(drafts.size&&!confirm('取代未送出的內容？'))return;editing=r;drafts=new Map([[r.classId,{...r}]]);$('patrol-date').value=r.date;$('patrol-period').value=r.period;$('patrol-grade').value=r.grade;$('patrol-open').click();render();return;}
    if(confirmDelete!==r.id){confirmDelete=r.id;analysis();return;}
    del.disabled=true;try{await window.PATROL_API.save([{id:r.id,revision:r.revision,data:{...payload(r),status:'deleted'}}]);confirmDelete=null;}catch(error){$('patrol-analysis-status').textContent=`刪除未完成：${error.message}`;del.disabled=false;}
  });
  window.addEventListener('cloud-patrol-records',e=>{records=e.detail;loaded=true;analysis();render();});
  window.addEventListener('patrol-sync-error',e=>{loaded=false;analysis();$('patrol-analysis-status').textContent=e.detail;$('patrol-status').textContent=e.detail;render();});
  window.addEventListener('authorization-changed',()=>{if(!window.AUTH_MEMBER){drafts.clear();records=[];editing=null;loaded=false;$('patrol-status').textContent='';}render();analysis();});
  window.addEventListener('weekly-changed',render);render();analysis();
})();
