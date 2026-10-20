(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const start = '2026-08-31', end = '2027-01-20';
  const dateUTC = date => new Date(date + 'T00:00:00Z');
  const plus = (date,n) => { const d = dateUTC(date); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
  const dayOf = date => dateUTC(date).getUTCDay()-1;
  const inTerm = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= start && date <= end && dayOf(date) >= 0 && dayOf(date) <= 4;
  const weekOf = date => Math.floor((dateUTC(date)-dateUTC(start))/604800000)+1;
  const className = id => data.classes.find(c => c.id === id)?.name || '分組';
  const teacherBy = name => data.teachers.find(t => t.name === name);
  const slotText = slot => `${slot.date} 第${slot.row}節 ${className(slot.classId)} ${slot.subject}（${slot.teacher}）`;
  const related = (record,name) => record.a.teacher === name || record.b?.teacher === name;
  const at = (slot,date,row) => slot && slot.date === date && slot.row === row;
  let records = [];
  let editingId=null, editingRevision=0, saving=false;
  const effective=()=>records.filter(r=>!['cancelled','deleted'].includes(r.status));
  function syncPreview(){
    window.WEEKLY.setPreview(effective());
  }
  function base(name,date,row) { return (teacherBy(name)?.sessions || []).filter(s => s.day === dayOf(date) && s.row === row); }
  function effects(name,date,row,items) {
    const outgoing = [], incoming = [];
    for (const record of items) {
      if (record.kind === 'leave') continue;
      const {a,b} = record;
      if (name === a.teacher && at(a,date,row)) outgoing.push(record);
      if (record.kind === 'sub' && name === b.teacher && at(a,date,row)) incoming.push({record,lesson:a,label:'代'});
      if (record.kind === 'swap') {
        if (name === b.teacher && at(b,date,row)) outgoing.push(record);
        if (name === a.teacher && at(b,date,row)) incoming.push({record,lesson:a,label:'調入'});
        if (name === b.teacher && at(a,date,row)) incoming.push({record,lesson:b,label:'調入'});
      }
    }
    return {outgoing,incoming};
  }
  window.COURSE_ENGINE = {plus,dayOf,weekOf,inTerm,effects};
  const teacherOptions = data.teachers.map(t => `<option value="${esc(t.name)}">${esc(t.id)} ${esc(t.name)}</option>`).join('');
  for (const id of ['teaching-teacher','entry-teacher','entry-partner']) $(id).innerHTML = teacherOptions;
  $('teaching-teacher').value = teacherBy('盧佩君') ? '盧佩君' : data.teachers[0].name;
  $('entry-teacher').value = $('teaching-teacher').value;
  $('teaching-week').innerHTML = Array.from({length:21},(_,n) => `<option value="${n+1}">第 ${n+1} 週｜${plus(start,n*7)} ～ ${plus(start,n*7+4) > end ? end : plus(start,n*7+4)}</option>`).join('');
  $('teaching-week').value = '8'; $('entry-date').value = '2026-10-21'; $('entry-other-date').value = '2026-10-20';
  function courses(name,date) { return inTerm(date) ? (teacherBy(name)?.sessions || []).filter(s => s.day === dayOf(date) && s.row >= 1 && s.row <= 8) : []; }
  function fillCourse(selectId,name,date) {
    const previous = $(selectId).value;
    $(selectId).innerHTML = courses(name,date).map((s,index) => `<option value="${index}">第${s.row}節｜${esc(className(s.classId))}｜${esc(s.subject)}</option>`).join('');
    if (!$(selectId).options.length) $(selectId).innerHTML = '<option value="">當天無基本課表課程</option>';
    else if ([...$(selectId).options].some(o => o.value === previous)) $(selectId).value = previous;
  }
  function refreshForm() {
    const kind = $('entry-kind').value;
    $('entry-course-label').hidden = kind === 'leave'; $('entry-partner-label').hidden = kind === 'leave';
    for (const id of ['entry-other-date-label','entry-other-course-label']) $(id).hidden = kind !== 'swap';
    fillCourse('entry-course',$('entry-teacher').value,$('entry-date').value);
    fillCourse('entry-other-course',$('entry-partner').value,$('entry-other-date').value);
  }
  function describe(record) {
    if (record.kind === 'leave') return `${record.a.date} ${record.a.teacher}：${record.leaveType}（整日）`;
    if (record.kind === 'sub') return `${slotText(record.a)} → 由 ${record.b.teacher} 代課`;
    return `${slotText(record.a)} ⇄ ${slotText(record.b)}`;
  }
  function render() {
    const name = $('teaching-teacher').value, week = Number($('teaching-week').value), monday = plus(start,(week-1)*7);
    const dates = Array.from({length:5},(_,d) => plus(monday,d)).filter(d => d <= end);
    const planned = $('teaching-display').value === 'planned';
    $('teaching-calendar').innerHTML = `<table><thead><tr><th>第 ${week} 週<br>${esc(name)}</th>${dates.map((date,day) => {
      const leave = planned ? [...new Set(effective().filter(r => r.a.teacher === name && r.a.date === date && r.leaveType).map(r => r.leaveType))] : [];
      return `<th>星期${data.meta.days[day]}<br>${window.WEEKLY.formatDate(date)}${leave.map(type => `<span class="leave-tag">${esc(type)}</span>`).join('')}</th>`;
    }).join('')}</tr></thead><tbody>${data.classes[0].rows.map((row,index) => `<tr><td>${row.period.name}<br>${row.period.time}</td>${dates.map(date => {
      const lessons = base(name,date,index), change = planned ? effects(name,date,index,effective()) : {outgoing:[],incoming:[]};
      const original = lessons.map(s => `<div>${esc(s.subject)}<br><small>${esc(className(s.classId))}</small></div>`).join('');
      if (!change.outgoing.length && !change.incoming.length) return `<td>${original}</td>`;
      const outgoing = change.outgoing.map(r => { const other = r.a.teacher === name ? r.b : r.a; return `<div class="lesson-change"><b>${r.kind === 'sub' ? '代出' : '調出'}${r.demo ? '・示範' : ''}</b><br>${r.kind === 'sub' ? `由 ${esc(other.teacher)} 代課` : `改於 ${esc(other.date)} 第${other.row}節授課<br>與 ${esc(other.teacher)} 的 ${esc(other.subject)} 交換`}</div>`; }).join('');
      const incoming = change.incoming.map(({record:r,lesson,label}) => `<div class="lesson-change"><b>${label}${r.demo ? '・示範' : ''}</b><br>${esc(lesson.subject)}<br>${esc(className(lesson.classId))}／${label === '代' ? '代' : '調'}<br>${label === '代' ? `原教師：${esc(lesson.teacher)}` : `原課：${lesson.date} 第${lesson.row}節`}</div>`).join('');
      return `<td>${original ? `<div class="lesson-original">${change.outgoing.length ? '原：' : '原有課程：'}${original}</div>` : ''}${outgoing}${incoming}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
    const visible = [...records].sort((a,b)=>b.a.date.localeCompare(a.a.date)||(b.order||0)-(a.order||0));
    $('teaching-records').innerHTML = visible.map(r => {
      const inactive=['cancelled','deleted'].includes(r.status);
      return `<article class="teaching-record"><b>${r.demo?'示範・未核對':r.status==='submitted'?'已送出':r.status==='deleted'?'已刪除':r.status==='cancelled'?'已取消':'未送出草稿'}</b><p>${esc(describe(r))}</p><p class="record-meta">${esc(window.WEEKLY.auditText(r))}</p>${r.note?`<p>${esc(r.note)}</p>`:''}${r.b?`<button class="person-button" type="button" data-compare="${esc(r.id)}">對照 ${esc(r.b.teacher)}</button>`:''}${!r.demo&&!inactive?`<button type="button" class="person-button" data-edit-record="${esc(r.id)}">修正</button><button type="button" class="person-button" data-publish-record="${esc(r.id)}">${r.status==='submitted'?'重新送出':'送出至公開課表'}</button>`:''}${!inactive?`<button class="person-button" type="button" data-remove-record="${esc(r.id)}">${r.revision?'整筆刪除':'移除預覽'}</button>`:''}</article>`;
    }).join('') || '<p>目前尚無登錄紀錄。</p>';
  }
  function slotFrom(name,date,selectId) {
    const value = $(selectId).value;
    const session = value === '' ? null : courses(name,date)[Number(value)];
    if (!session) throw Error('請選擇當天的授課課程。');
    return {teacher:name,date,row:session.row,classId:session.classId || '',subject:session.subject};
  }
  function occupied(name,date,row) { const W=window.WEEKLY,scope=effective().filter(r=>r.id!==editingId);return W.lessons(name,date,row,scope).length>0||W.leaves(name,date,scope).length>0||W.recruitBusy(name,date,row)||W.teacherEventBusy(name,date,row); }
  function validate(record) {
    if (!inTerm(record.a.date) || (record.kind === 'swap' && !inTerm(record.b.date))) throw Error('日期須在本學期週一至週五之內。');
    if (record.kind === 'leave') { if (!record.leaveType) throw Error('請選擇假別。'); return; }
    for(const slot of [record.a,...(record.kind==='swap'?[record.b]:[])])if(window.WEEKLY.recruitBusy(slot.teacher,slot.date,slot.row))throw Error('教師此節已安排招生，不能代調課。');
    for(const slot of [record.a,...(record.kind==='swap'?[record.b]:[])])if(window.WEEKLY.activityBlocked(slot.classId,slot.date,slot.row))throw Error('該班級此節有學校重要活動，不能代調課。');
    if (record.a.teacher === record.b.teacher) throw Error('請選擇不同的代課／交換教師。');
    if (effective().some(r => r.id!==record.id && r.kind !== 'leave' && [r.a,r.b].some(s => s && ((s.teacher === record.a.teacher && at(s,record.a.date,record.a.row)) || (record.kind === 'swap' && s.teacher === record.b.teacher && at(s,record.b.date,record.b.row)))))) throw Error('原課程已有代調課紀錄，請先修正或取消舊紀錄。');
    if (occupied(record.b.teacher,record.a.date,record.a.row)) throw Error('代課／交換教師在原課時段已有課，請核對衝堂。');
    if (record.kind === 'swap') {
      if (record.a.classId !== record.b.classId) throw Error('目前登錄先限同班調課；跨班案例可在示範預覽中核對。');
      if ((record.a.row === 8) !== (record.b.row === 8)) throw Error('第八節只能與第八節交換。');
      if (occupied(record.a.teacher,record.b.date,record.b.row)) throw Error('原教師在交換時段已有課，請核對衝堂。');
      for (const slot of [record.a,record.b]) {
        const schedule = byId(slot.classId), cell = schedule?.rows[slot.row]?.cells[dayOf(slot.date)];
        if (!cell || blocked(cell,schedule,dayOf(slot.date),slot.row)) throw Error(`「${slot.subject}」屬不可調課課程；可改用代課方式處理。`);
      }
    }
  }
  async function publish(record,status='submitted'){
    if(!window.CLOUD_RECORDS)throw Error('雲端尚未就緒，請確認登入、網路與新版 Firestore 規則。');
    const payload={kind:record.kind,a:record.a,b:record.b,leaveType:record.leaveType,note:record.note,order:record.order||Date.now(),status};
    const projection=status==='submitted'?{id:record.id,kind:record.kind,a:record.a,b:record.b,leaveCode:window.WEEKLY.leaveCode(record.leaveType),order:payload.order}:null;
    await window.CLOUD_RECORDS.save('course',record.id,payload,projection,record.revision||0);
  }
  function stopEditing(){editingId=null;editingRevision=0;$('entry-submit').textContent='新增到規劃預覽';$('entry-cancel-edit').hidden=true;}
  $('entry-cancel-edit').addEventListener('click',()=>{stopEditing();$('teaching-status').textContent='已放棄修正，原送出紀錄保持不變。';});
  $('teaching-form').addEventListener('submit',async event => {
    event.preventDefault(); if (!window.AUTH_MEMBER) return;
    if(saving)return;
    try {
      const kind = $('entry-kind').value, name = $('entry-teacher').value, date = $('entry-date').value;
      const a = kind === 'leave' ? {teacher:name,date} : slotFrom(name,date,'entry-course');
      const b = kind === 'swap' ? slotFrom($('entry-partner').value,$('entry-other-date').value,'entry-other-course') : kind === 'sub' ? {teacher:$('entry-partner').value,date,row:a.row} : null;
      const old=records.find(r=>r.id===editingId);
      if(editingId&&(old?.revision||0)!==editingRevision)throw Error('此筆紀錄已被其他同仁更新，請放棄修正後重新開啟。');
      const record = {...old,id:editingId||crypto.randomUUID(),kind,a,b,leaveType:$('entry-leave').value,note:$('entry-note').value.trim(),order:old?.order||Date.now()};
      validate(record);
      if(old?.revision){saving=true;await publish(record);stopEditing();$('teaching-status').textContent='修正已送出，公開課表已更新。';return;}
      records=records.filter(r=>r.id!==record.id);records.push(record);stopEditing(); $('teaching-teacher').value = name; $('teaching-week').value = String(weekOf(date)); $('teaching-display').value = 'planned';
      $('swap-teacher').value=name;$('swap-week').value=String(weekOf(date));syncPreview();
      $('teaching-status').textContent = '已加入此頁預覽；重新整理會清除，尚未儲存至任何雲端服務。'; render();
    } catch(error) { $('teaching-status').textContent = error.message; }finally{saving=false;}
  });
  $('teaching-demo').addEventListener('click',() => {
    if (!window.AUTH_MEMBER) return;
    const id = name => data.classes.find(c => c.name === name)?.id || '';
    const slot = (teacher,date,row,cls,subject) => ({teacher,date,row,classId:id(cls),subject});
    const demo = (n,kind,a,b,note='') => ({id:`demo-${n}`,demo:true,kind,a,b,leaveType:n === 1 ? '公假' : '',note});
    const samples = [
      demo(1,'swap',slot('盧佩君','2026-10-21',7,'國二包容','公民與社會'),slot('翟垣皓','2026-10-20',4,'國二包容','英語文')),
      demo(2,'swap',slot('盧佩君','2026-09-18',2,'國一包容','公民與社會'),slot('Chris','2026-09-30',4,'國一包容','世界關懷行'),'Chris 尚未對應教師編號，僅依提供文字示範。'),
      demo(3,'swap',slot('盧佩君','2026-10-29',6,'高三善解','民主政治與法律'),slot('莊仁傑','2026-10-30',7,'國三善解','國語文'),'依提供案例保留高三／國三不同班級，待核對。'),
      demo(4,'sub',slot('盧佩君','2026-10-20',8,'國二包容','公民與社會'),{teacher:'許蘭馨',date:'2026-10-20',row:8},'示範暫將「蘭馨老師」對應許蘭馨，請核對。'),
    ];
    records = [...records.filter(r => !r.demo),...samples]; $('teaching-teacher').value = '盧佩君'; $('teaching-week').value = '8'; $('teaching-display').value = 'planned';
    $('swap-teacher').value='盧佩君';$('swap-week').value='8';$('swap-class').value=id('國二包容');syncPreview();
    $('teaching-status').textContent = '已載入四筆示範。跨週案例請切換第3／5週；10/29案例在第9週。示範不可存入雲端。'; render();
  });
  $('teaching-records').addEventListener('click',async event => {
    if (!window.AUTH_MEMBER) return;
    if(saving)return;
    const button = event.target.closest('button'); if (!button) return;
    const record = records.find(r => r.id === (button.dataset.compare || button.dataset.removeRecord||button.dataset.editRecord||button.dataset.publishRecord)); if (!record) return;
    try {
      if (button.dataset.compare) {
        const other = record.a.teacher === $('teaching-teacher').value ? record.b.teacher : record.a.teacher;
        if (!teacherBy(other)) throw Error('此示範姓名尚未對應教師名單，請先核對。');
        window.WEEKLY_SHOW_PARTNER(other);
      } else if(button.dataset.editRecord){
        editingId=record.id;editingRevision=record.revision||0;$('entry-kind').value=record.kind;$('entry-teacher').value=record.a.teacher;$('entry-date').value=record.a.date;$('entry-leave').value=record.leaveType;$('entry-note').value=record.note||'';
        $('swap-week').value=String(weekOf(record.a.date));$('swap-teacher').value=record.a.teacher;if(record.a.classId)$('swap-class').value=record.a.classId;refreshSwapOptions();updateComparison();
        if(record.b){$('entry-partner').value=record.b.teacher;$('entry-other-date').value=record.b.date;}
        refreshForm();for(const [slot,id] of [[record.a,'entry-course'],[record.b,'entry-other-course']])if(slot?.subject){const index=courses(slot.teacher,slot.date).findIndex(s=>s.row===slot.row&&s.classId===slot.classId&&s.subject===slot.subject);if(index>=0)$(id).value=String(index);}
        $('entry-submit').textContent=record.revision?'儲存修正並更新公開課表':'儲存草稿修正';$('entry-cancel-edit').hidden=false;$('teaching-form').scrollIntoView({block:'center',behavior:'smooth'});
      } else if(button.dataset.publishRecord){
        const previousEditing=editingId;editingId=record.id;try{validate(record);}finally{editingId=previousEditing;}saving=true;await publish(record);$('teaching-status').textContent='已送出，公開代調課查詢已同步更新。';
      } else if(record.revision){
        if(!confirm('確定整筆刪除？公開課表會撤回此筆異動，行政端保留已刪除狀態。'))return;
        saving=true;await publish(record,'deleted');if(editingId===record.id)stopEditing();$('teaching-status').textContent='此筆已刪除，公開課表已撤回此筆異動。';
      } else {
        records = records.filter(r => r !== record);
        syncPreview();
      }
      render();
    } catch(error) { $('teaching-status').textContent = `未完成：${error.message}`; button.disabled = false; }finally{saving=false;}
  });
  for (const id of ['teaching-teacher','teaching-week','teaching-display']) $(id).addEventListener('change',render);
  for (const id of ['entry-kind','entry-teacher','entry-date','entry-partner','entry-other-date']) $(id).addEventListener('change',refreshForm);
  $('entry-partner').addEventListener('change',()=>{if(workspace==='office')window.WEEKLY_SHOW_PARTNER($('entry-partner').value);});
  window.TEACHING_SELECT=selection=>{
    if(workspace!=='office'||editingId)return;
    $('teaching-teacher').value=selection.teacher;$('teaching-week').value=String(selection.week);
    $('entry-teacher').value=selection.teacher;if(selection.date)$('entry-date').value=selection.date;
    refreshForm();if(selection.row){const index=courses(selection.teacher,selection.date).findIndex(s=>s.row===selection.row&&s.classId===$('swap-class').value);if(index>=0)$('entry-course').value=String(index);}
    render();
  };
  window.TEACHING_CANDIDATE=selection=>{
    if(workspace!=='office')return;
    $('entry-kind').value='swap';$('entry-partner').value=selection.teacher;$('entry-other-date').value=selection.date;refreshForm();
    const index=courses(selection.teacher,selection.date).findIndex(s=>s.row===selection.row&&s.classId===$('swap-class').value);if(index>=0)$('entry-other-course').value=String(index);
  };
  $('teaching-apply-local').addEventListener('click',async()=>{
    if(!window.AUTH_MEMBER)return;
    if(saving)return; saving=true;
    try{for(const record of records.filter(r=>!r.demo&&!r.revision)){const previousEditing=editingId;editingId=record.id;try{validate(record);}finally{editingId=previousEditing;}await publish(record);}$('teaching-status').textContent='草稿已送出至公開課表；示範資料不會送出。';}catch(error){$('teaching-status').textContent=error.message;}finally{saving=false;}
  });
  window.addEventListener('cloud-course-records',event=>{records=[...records.filter(r=>!r.revision&&!event.detail.some(c=>c.id===r.id)),...event.detail];syncPreview();render();});
  window.addEventListener('authorization-changed',() => { if (!window.AUTH_MEMBER) { records=[];stopEditing();$('entry-note').value='';window.WEEKLY.setPreview([]); render(); } });
  refreshForm(); render();
})();
