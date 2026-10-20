(() => {
  const W=window.WEEKLY,$=id=>document.getElementById(id);
  let records=[],editing=null,pending=false;
  const groups=['國一','國二','國三','高一','高二','高三'];let otherTeachers=[];
  $('event-teacher-groups').innerHTML=groups.map(g=>`<label><input type="checkbox" data-event-group="${g}">${g}導師</label>`).join('');
  const chosenGroups=()=>[...document.querySelectorAll('[data-event-group]:checked')].map(c=>c.dataset.eventGroup);
  const groupTeachers=()=>data.classes.filter(c=>chosenGroups().some(g=>c.name.startsWith(g))).map(c=>c.homeroomTeacher).filter(Boolean);
  const selectedTeachers=()=>[...new Set([...groupTeachers(),...($('event-teachers-other').checked?otherTeachers:[])])];
  function refreshTeachers(){
    $('event-teachers-other-fields').hidden=!$('event-teachers-other').checked;
    const teachers=selectedTeachers();$('event-teacher-summary').textContent=teachers.length?`不在校教師共${teachers.length}位：${teachers.join('、')}。僅在活動起訖節次內禁止接課與招生；名單與活動時段會供公開查詢排除。`:'未選擇不在校教師（仍依原班級活動範圍處理）。';
    $('event-teacher-selected').innerHTML=otherTeachers.map(n=>`<button type="button" class="person-button" data-event-remove-teacher="${W.esc(n)}">${W.esc(n)} ×</button>`).join('');
    const query=$('event-teacher-query').value.trim();$('event-teacher-matches').innerHTML=query?data.teachers.filter(t=>(t.name.includes(query)||String(t.id).includes(query))&&!teachers.includes(t.name)).map(t=>`<button type="button" class="person-button" data-event-add-teacher="${W.esc(t.name)}">${t.id} ${W.esc(t.name)}</button>`).join('')||'<p>沒有尚未選取的符合教師。</p>':'';
  }
  $('event-teacher-groups').addEventListener('change',refreshTeachers);$('event-teachers-other').addEventListener('change',refreshTeachers);$('event-teacher-query').addEventListener('input',refreshTeachers);
  $('event-teacher-matches').addEventListener('click',event=>{const b=event.target.closest('[data-event-add-teacher]');if(!b)return;otherTeachers.push(b.dataset.eventAddTeacher);$('event-teacher-query').value='';refreshTeachers();});
  $('event-teacher-selected').addEventListener('click',event=>{const b=event.target.closest('[data-event-remove-teacher]');if(!b)return;otherTeachers=otherTeachers.filter(n=>n!==b.dataset.eventRemoveTeacher);refreshTeachers();});
  $('event-week').innerHTML=W.weekOptions();$('event-week').value=$('swap-week').value;
  for(const id of ['event-start-day','event-end-day'])$(id).innerHTML=data.meta.days.map((day,i)=>`<option value="${i}">星期${day}</option>`).join('');
  for(const id of ['event-start-row','event-end-row'])$(id).innerHTML=Array.from({length:8},(_,i)=>`<option value="${i+1}">第${i+1}節</option>`).join('');
  for(const id of ['event-start-class','event-end-class'])$(id).innerHTML=W.orderedClasses.map(c=>`<option value="${W.esc(c.id)}">${W.esc(c.name)} ${c.publicCode}</option>`).join('');
  $('event-end-day').value='2';$('event-end-row').value='4';$('event-end-class').value=W.orderedClasses.at(-1).id;
  const fields=['week','name','effect','startDay','startRow','endDay','endRow','startClass','endClass'];
  const element=key=>'event-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
  const payload=r=>({...Object.fromEntries(fields.map(k=>[k,r[k]])),absentTeachers:Array.isArray(r.absentTeachers)?r.absentTeachers:[]});
  const text=r=>`第${r.week}週 ${W.formatDate(W.dateFor(r.week,r.startDay))} 第${r.startRow}節 ～ ${W.formatDate(W.dateFor(r.week,r.endDay))} 第${r.endRow}節｜${W.className(r.startClass)} ～ ${W.className(r.endClass)}｜${r.effect==='no-class'?'無一般課程':'禁止代調課'}`;
  function render(){
    $('event-records').innerHTML=window.RECORD_PAGES.sort(records).map(r=>`<article class="teaching-record"><b>${W.esc(r.name)}｜${r.status==='deleted'?'已刪除':'已送出'}</b><p>${W.esc(text(r))}</p><p>不在校教師：${(r.absentTeachers||[]).map(W.esc).join('、')||'未指定'}</p><p class="record-meta">${W.esc(W.auditText(r))}</p>${r.status!=='deleted'?`<button type="button" class="person-button" data-event-edit="${W.esc(r.id)}">修改</button><button type="button" class="person-button" data-event-delete="${W.esc(r.id)}">整筆刪除</button>`:''}</article>`).join('')||'<p>目前尚無活動紀錄。</p>';
    window.RECORD_PAGES.render('event-records');
  }
  function reset(){editing=null;$('event-submit').textContent='送出重要活動';$('event-cancel-edit').hidden=true;otherTeachers=[];for(const c of document.querySelectorAll('[data-event-group]'))c.checked=false;$('event-teachers-other').checked=false;$('event-teacher-query').value='';refreshTeachers();}
  async function save(r,status){if(!window.CLOUD_RECORDS)throw Error('雲端尚未就緒，請確認登入及新版規則。');if(status==='deleted'&&window.CLOUD_RECORDS.remove)return window.CLOUD_RECORDS.remove('event',r.id,r.revision||0);await window.CLOUD_RECORDS.save('event',r.id,{...payload(r),teacherGroups:r.teacherGroups||[],otherTeachers:r.otherTeachers||[],status},status==='submitted'?payload(r):null,r.revision||0);}
  $('events-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!window.AUTH_MEMBER||pending)return;
    try{
      const r={id:editing?.id||crypto.randomUUID(),revision:editing?.revision||0};for(const k of fields){const value=$(element(k)).value;r[k]=['week','startDay','startRow','endDay','endRow'].includes(k)?Number(value):value.trim();}
      r.teacherGroups=chosenGroups();r.otherTeachers=$('event-teachers-other').checked?[...otherTeachers]:[];r.absentTeachers=selectedTeachers();
      if(!W.validEvent(r))throw Error('請檢查：結束節次不得早於開始節次、班級起訖順序需正確，且日期須在學期內。');
      if(!confirm('送出後，此範圍將禁止代調課。既有安排不會自動刪除，請核對是否需修正。'))return;
      pending=true;$('event-submit').disabled=true;await save(r,'submitted');reset();$('event-status').textContent='活動已送出；每週教師及班級對照課表會同步標註並套用限制。';
    }catch(error){$('event-status').textContent=error.message;}finally{pending=false;$('event-submit').disabled=false;}
  });
  $('event-cancel-edit').addEventListener('click',reset);
  $('event-records').addEventListener('click',async event=>{
    const b=event.target.closest('[data-event-edit],[data-event-delete]');if(!b||!window.AUTH_MEMBER||pending)return;const r=records.find(r=>r.id===(b.dataset.eventEdit||b.dataset.eventDelete));if(!r)return;
    if(b.dataset.eventEdit){editing={...r};for(const k of fields)$(element(k)).value=String(r[k]);for(const c of document.querySelectorAll('[data-event-group]'))c.checked=(r.teacherGroups||[]).includes(c.dataset.eventGroup);otherTeachers=[...(r.otherTeachers||(!r.teacherGroups?r.absentTeachers||[]:[]))];$('event-teachers-other').checked=otherTeachers.length>0;$('event-teacher-query').value='';refreshTeachers();$('event-submit').textContent='儲存修改並更新公開課表';$('event-cancel-edit').hidden=false;$('events-tool').scrollIntoView({behavior:'smooth'});}
    else if(confirm('確定刪除此活動？公開標記與代調課限制會同步移除。')){try{pending=true;await save(r,'deleted');if(editing?.id===r.id)reset();$('event-status').textContent='活動已刪除，公開標記與限制已移除。';}catch(error){$('event-status').textContent=error.message;}finally{pending=false;}}
  });
  window.addEventListener('cloud-event-records',event=>{records=event.detail;render();});
  window.addEventListener('authorization-changed',()=>{if(!window.AUTH_MEMBER){records=[];reset();render();}});
  refreshTeachers();render();
})();
