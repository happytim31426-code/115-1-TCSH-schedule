// The same comparison widget is mounted in either the public or office workspace.
(() => {
  const W=window.WEEKLY,$=id=>document.getElementById(id);
  const scope=()=>workspace==='office'?'admin':'public';
  const week=()=>Number($('swap-week').value);
  let partner=null;
  const selectionKey=()=>`${$('swap-teacher').value}|${week()}|${$('swap-class').value}`;
  window.WEEKLY_SHOW_PARTNER=(name,day,row)=>{partner={name,key:selectionKey(),day,row};comparisonTeacher(name,'#swap-right');highlightComparison(day,row);};
  const date=day=>W.dateFor(week(),day);
  const origins=(name,schedule,day,row)=>W.lessons(name,date(day),row,scope()).filter(s=>s.classId===schedule.id);
  const isBlocked=(lesson,day,row)=>blocked({subject:lesson.subject,runningClass:lesson.grouped||false},byId(lesson.classId),day,row);
  eligibleOrigin=(name,schedule,day,row)=>row>=1&&row<=8&&origins(name,schedule,day,row).length>0;
  teachesClass=(name,classId)=>data.meta.days.some((_,day)=>rows.some((_,row)=>origins(name,byId(classId),day,row).length>0));
  refreshSwapOptions=(onlyPeriods=false)=>{
    const name=$('swap-teacher').value,schedule=byId($('swap-class').value),ds=$('swap-day'),ps=$('swap-period');
    if(!onlyPeriods){const old=ds.value;const days=data.meta.days.map((name,day)=>({name,day})).filter(x=>periods.some(p=>eligibleOrigin(name,schedule,x.day,p.row)));ds.innerHTML=optionList(days,x=>x.day,x=>`星期${x.name} ${date(x.day).slice(5)}`);if(days.some(x=>String(x.day)===old))ds.value=old;ds.disabled=!days.length;if(!days.length)ds.innerHTML='<option value="">無授課星期</option>';}
    const old=ps.value,available=ds.value===''?[]:periods.filter(p=>eligibleOrigin(name,schedule,Number(ds.value),p.row));
    ps.innerHTML=optionList(available,p=>p.row,p=>`${p.name} ${p.time}`);if(available.some(p=>String(p.row)===old))ps.value=old;ps.disabled=!available.length;if(!available.length)ps.innerHTML='<option value="">無授課節次</option>';
  };
  swapSearch=()=>{
    const output=$('swap-results');
    if(scope()==='public'&&!W.ready){output.textContent='最新週課務尚未同步，暫不提供候選名單，避免依舊課表判斷。';return;}
    if($('swap-period').disabled){output.textContent='本週該教師在此班沒有授課時段。';return;}
    const name=$('swap-teacher').value,schedule=byId($('swap-class').value),day=Number($('swap-day').value),row=Number($('swap-period').value),target=origins(name,schedule,day,row)[0];
    if(!target){output.textContent='本教師該節無課務';return;}
    if(isBlocked(target,day,row)){output.textContent=`「${target.subject}」不能調課`;return;}
    if(target.change){output.textContent='這節課已經過教學組代調；再次調整請先由教學組撤銷原紀錄。';return;}
    const result=[];
    for(let d=0;d<5;d++)for(let r=1;r<=8;r++){
      if(d===day&&r===row||(row===8)!==(r===8))continue;
      for(const lesson of W.classLessons(schedule.id,date(d),r,scope())){
        if(!lesson.teacher||lesson.teacher===name||lesson.change||isBlocked(lesson,d,r)||W.busy(lesson.teacher,date(day),row,scope())||W.busy(name,date(d),r,scope()))continue;
        result.push({...lesson,day:d,row:r});
      }
    }
    const unique=result.filter((s,i,a)=>i===a.findIndex(x=>x.teacher===s.teacher&&x.day===s.day&&x.row===s.row));
    output.innerHTML=unique.length?`<h3>可代調清單</h3><p>紅橙黃綠藍紫：已發布的課務配對；藍框：原選取時段；橘框：候選時段。點姓名對照。</p><ul class="result-list">${unique.map(s=>`<li>科目：${W.esc(s.subject)}　教師：<button type="button" class="schedule-link" data-candidate="${W.esc(s.teacher)}" data-day="${s.day}" data-row="${s.row}" aria-pressed="false">${W.esc(s.teacher)}</button>　星期：${data.meta.days[s.day]}　節數：第${s.row}節</li>`).join('')}</ul>`:'<p>沒有符合本週最新課務與課程限制的候選教師。</p>';
  };
  comparisonTeacher=(name,panel)=>{document.querySelector(panel).innerHTML=W.table(name,week(),scope());};
  function classTable(schedule){
    return `<h3>${W.esc(schedule.name)} ${W.esc(schedule.publicCode)}</h3><div class="table-wrap"><table><thead><tr><th>第${week()}週</th>${data.meta.days.map((_,d)=>W.header(date(d),d)).join('')}</tr></thead><tbody>${rows.map((p,row)=>`<tr><td>${p.period.name}</td>${data.meta.days.map((_,d)=>{
      const list=W.classLessons(schedule.id,date(d),row,scope()),latest=list.find(s=>s.change)?.change;
      return `<td class="weekly-cell ${latest?W.tone(latest,week(),scope()):''}" data-slot-day="${d}" data-slot-row="${row}">${list.map(s=>`<div class="weekly-lesson">${s.mark?`<span class="change-circle">${s.mark}</span>`:''}<div class="course">${W.esc(s.subject)}</div><small>${W.esc(s.teacher||'待確認')}</small></div>`).join('<hr>')}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  updateComparison=()=>{
    const name=$('swap-teacher').value,schedule=byId($('swap-class').value);
    comparisonTeacher(name,'#swap-left');
    $('swap-middle').innerHTML=teachesClass(name,schedule.id)?classTable(schedule):'<p>本教師無任教該班級（所選週次）</p>';
    if(partner?.key===selectionKey())comparisonTeacher(partner.name,'#swap-right');
    else {partner=null;$('swap-right').textContent='點選候選教師後，在此顯示課表。';}
    $('swap-sync-status').textContent=scope()==='admin'?`${W.message}；行政畫面另含尚未發布的預覽。`:W.ready?W.message:`${W.message}（目前僅顯示基本課表，不能視為已同步）`;
    swapSearch();highlightComparison(partner?.day,partner?.row);
    window.TEACHING_SELECT?.({teacher:name,week:week(),date:$('swap-day').value===''?null:date(Number($('swap-day').value)),row:$('swap-period').value===''?null:Number($('swap-period').value)});
  };
  window.addEventListener('weekly-changed',()=>{refreshSwapOptions();updateComparison();});
  $('swap-results').addEventListener('click',event=>{
    const b=event.target.closest('[data-candidate]');if(!b)return;
    partner={name:b.dataset.candidate,key:selectionKey(),day:b.dataset.day,row:b.dataset.row};
    window.TEACHING_CANDIDATE?.({teacher:b.dataset.candidate,date:date(Number(b.dataset.day)),row:Number(b.dataset.row)});
  });
  refreshSwapOptions();updateComparison();
})();
