// Date-specific overlay shared by the public comparison and office planner.
(() => {
  const data=window.SCHEDULE_DATA,start='2026-08-31',end='2027-01-20';
  const utc=value=>new Date(value+'T00:00:00Z');
  const plus=(value,n)=>{const d=utc(value);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const dayOf=value=>utc(value).getUTCDay()-1;
  const weekOf=value=>Math.floor((utc(value)-utc(start))/604800000)+1;
  const inTerm=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(+utc(value))&&utc(value).toISOString().slice(0,10)===value&&value>=start&&value<=end&&dayOf(value)>=0&&dayOf(value)<5;
  const dateFor=(week,day)=>plus(start,(Number(week)-1)*7+day);
  const className=id=>data.classes.find(c=>c.id===id)?.name||'分組';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let published=[],preview=[],ready=true,message='目前使用基本課表；雲端週次同步尚未啟用。';
  const cache=new Map();
  const leaveCode=value=>({'公假':'公','差假':'差','重大假別':'假','其他':'假'})[value]||(['公','差','假'].includes(value)?value:'');
  function validSlot(s,full=true){return s&&typeof s.teacher==='string'&&s.teacher.length>0&&s.teacher.length<=80&&inTerm(s.date)&&(!full||(Number.isInteger(s.row)&&s.row>=1&&s.row<=8&&typeof s.classId==='string'&&typeof s.subject==='string'&&s.subject.length<=160));}
  function valid(r){return r&&typeof r.id==='string'&&['leave','sub','swap'].includes(r.kind)&&validSlot(r.a,r.kind!=='leave')&&(r.kind==='leave'||(r.kind==='swap'?validSlot(r.b):r.b&&typeof r.b.teacher==='string'&&r.b.teacher.length>0&&r.b.teacher.length<=80));}
  const active=scope=>(Array.isArray(scope)?scope:scope==='admin'?[...published.filter(r=>!preview.some(p=>p.id===r.id)),...preview]:published).filter(valid).sort((a,b)=>(a.order||0)-(b.order||0)||a.id.localeCompare(b.id));
  const notify=()=>{cache.clear();window.dispatchEvent(new Event('weekly-changed'));};
  function setPublished(items,status=true,text='已同步教學組發布的最新課務'){published=items.filter(valid);ready=status;message=text;notify();}
  function setPreview(items){preview=items.filter(valid);notify();}
  // The teacher/date/period is already matched by the caller. Some paper notes
  // abbreviate the subject (e.g. English vs World Care), so remove that class's
  // original lesson rather than leaving a second lesson in the same slot.
  const matches=(lesson,slot)=>lesson.classId===slot.classId;
  function lessons(name,value,row,scope='public'){
    if(!inTerm(value))return [];
    const key=`${scope}|${name}|${value}|${row}`;if(!Array.isArray(scope)&&cache.has(key))return cache.get(key);
    let list=(data.teachers.find(t=>t.name===name)?.sessions||[]).filter(s=>s.day===dayOf(value)&&s.row===row).map(s=>({...s,teacher:name,date:value}));
    for(const r of active(scope)){
      if(r.kind==='leave')continue;const {a,b}=r;
      if(a.teacher===name&&a.date===value&&a.row===row)list=list.filter(s=>!matches(s,a));
      if(r.kind==='swap'&&b.teacher===name&&b.date===value&&b.row===row)list=list.filter(s=>!matches(s,b));
      if(r.kind==='sub'&&b.teacher===name&&a.date===value&&a.row===row)list.push({...a,teacher:name,date:value,row,change:r,mark:'代',className:className(a.classId)});
      if(r.kind==='swap'&&a.teacher===name&&b.date===value&&b.row===row)list.push({...a,date:value,row,change:r,mark:'調',className:className(a.classId)});
      if(r.kind==='swap'&&b.teacher===name&&a.date===value&&a.row===row)list.push({...b,date:value,row,change:r,mark:'調',className:className(b.classId)});
    }if(!Array.isArray(scope))cache.set(key,list);return list;
  }
  function classLessons(classId,value,row,scope='public'){
    const result=data.teachers.flatMap(t=>lessons(t.name,value,row,scope).filter(s=>s.classId===classId));
    if(!result.length&&inTerm(value)){const original=data.classes.find(c=>c.id===classId)?.rows[row]?.cells[dayOf(value)];if(original?.subject&&!original.teachers.length)result.push({classId,subject:original.subject,teacher:'',date:value,row,grouped:original.runningClass});}return result;
  }
  const leaves=(name,value,scope='public')=>[...new Set(active(scope).filter(r=>r.a.teacher===name&&r.a.date===value).map(r=>leaveCode(r.leaveCode||r.leaveType)).filter(Boolean))];
  const busy=(name,value,row,scope='public')=>leaves(name,value,scope).length>0||lessons(name,value,row,scope).length>0;
  const changes=(name,value,row,scope='public')=>active(scope).filter(r=>r.kind!=='leave'&&((r.a.date===value&&r.a.row===row)||(r.kind==='swap'&&r.b.date===value&&r.b.row===row))&&(r.a.teacher===name||r.b?.teacher===name));
  const colors=(week,scope)=>active(scope).filter(r=>r.kind==='swap').map(r=>r.id);
  const tone=(record,week,scope)=>record.kind==='sub'?'change-sub':`change-tone-${Math.max(0,colors(week,scope).indexOf(record.id))%6}`;
  function cell(name,value,row,week,scope='public'){
    const list=lessons(name,value,row,scope),records=changes(name,value,row,scope),latest=records.at(-1);
    const content=list.map(s=>`<div class="weekly-lesson">${s.mark?`<span class="change-circle" title="${s.mark==='代'?'代課':'調課'}">${s.mark}</span>`:''}<div class="course">${esc(s.subject)}</div><small>${esc(className(s.classId))}</small>${s.grouped?'<span class="badge">分組</span>':''}</div>`).join('<hr class="cell-divider">');
    const summary=latest?`${latest.kind==='sub'?'代課':'調課'}：${latest.a.date} 第${latest.a.row}節 ${latest.a.teacher} ${latest.a.subject} ${className(latest.a.classId)}${latest.b?` ↔ ${latest.b.teacher}${latest.kind==='swap'?` ${latest.b.date} 第${latest.b.row}節 ${latest.b.subject}`:''}`:''}`:'';
    return `<td class="weekly-cell ${latest?tone(latest,week,scope):''}" data-slot-day="${dayOf(value)}" data-slot-row="${row}" title="${esc(summary)}">${content}${latest&&!content?'<span class="vacated-slot" aria-label="原課已代調，現在無課">—</span>':''}</td>`;
  }
  function table(name,week,scope='public'){
    const t=data.teachers.find(t=>t.name===name),dates=Array.from({length:5},(_,d)=>dateFor(week,d));
    return `<h3>${esc(t?.id||'')} ${esc(name)}</h3><div class="table-wrap"><table><thead><tr><th>第${week}週</th>${dates.map((value,day)=>header(value,day,leaves(name,value,scope))).join('')}</tr></thead><tbody>${data.classes[0].rows.map((r,row)=>`<tr><td>${r.period.name}</td>${dates.map(value=>cell(name,value,row,week,scope)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function header(value,day,codes=[]){
    const titles={'公':'公假','差':'差假','假':'其他／重大假別'};
    return `<th class="weekly-day"><div class="weekly-heading"><span class="weekday-name">星期${data.meta.days[day]}</span><small class="weekday-date">${value<=end?value.slice(5):'學期結束'}</small><div class="weekly-leave-row">${codes.map(code=>`<span class="leave-circle" title="${titles[code]||code}" aria-label="${titles[code]||code}">${code}</span>`).join('')}</div></div></th>`;
  }
  window.WEEKLY={start,end,plus,dayOf,weekOf,inTerm,dateFor,className,esc,leaveCode,valid,lessons,classLessons,leaves,busy,changes,table,header,tone,active,setPublished,setPreview,get ready(){return ready;},get message(){return message;},weekOptions:()=>Array.from({length:21},(_,i)=>`<option value="${i+1}">第${i+1}週 ${dateFor(i+1,0)}～${dateFor(i+1,4)>end?end:dateFor(i+1,4)}</option>`).join('')};
})();
