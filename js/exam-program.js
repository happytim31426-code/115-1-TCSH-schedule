(() => {
  const W=window.WEEKLY,$=id=>document.getElementById(id),E=W.esc;
  const subjects=['英會','英文','英文作文','國文','寫作測驗','數學','公民','歷史','地理','地科','生物','理化','物理','化學','自習'];
  const divisions={junior:{label:'國中部',grades:[['J3','國三'],['J2','國二'],['J1','國一']]},senior:{label:'高中部',grades:[['S3S','高三（社）'],['S3N','高三（自）'],['S2S','高二（社）'],['S2N','高二（自）'],['S1A','高一知足～善解'],['S1B','高一包容～和氣']]}};
  const times=[['08:10','09:10',60],['09:20','10:20',60],['10:35','11:55',80],['13:15','14:25',70],['14:40','16:00',80]];
  const categories=['first','second','third'];
  const allowed=()=>['admin','exam'].includes(window.AUTH_MEMBER?.role);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const key=p=>`${p.category}_${p.division}_${p.day}`;
  const count=day=>day===3?3:5;
  function blank(category,division,day){return {category,division,day,cells:divisions[division].grades.flatMap(([grade])=>Array.from({length:count(day)},(_,i)=>({grade,period:i+1,subject:'',minutes:0})))};}
  function validate(p){
    if(!p||!categories.includes(p.category)||!divisions[p.division]||![1,2,3].includes(p.day))throw Error('考查類別、部別或天次無效。');
    const expected=blank(p.category,p.division,p.day).cells;
    if(!Array.isArray(p.cells)||p.cells.length!==expected.length)throw Error('表格年段及節次數量不符。');
    p.cells.forEach((c,i)=>{
      const e=expected[i],label=`${divisions[p.division].grades.find(g=>g[0]===e.grade)[1]}第${e.period}節`;
      if(!c||Object.keys(c).sort().join(',')!=='grade,minutes,period,subject'||c.grade!==e.grade||c.period!==e.period)throw Error(`${label}固定欄位不可變更。`);
      if(typeof c.subject!=='string'||c.subject.length>80||c.subject!==c.subject.trim())throw Error(`${label}科目須在80字內，且前後不可空白。`);
      if(!Number.isInteger(c.minutes)||c.minutes<0||c.minutes>times[e.period-1][2]||(c.subject?c.minutes<1:c.minutes!==0))throw Error(`${label}請填1～${times[e.period-1][2]}分鐘；未安排科目須為0分鐘。`);
    });return true;
  }
  window.EXAM_PROGRAM_MODEL={subjects,divisions,times,blank,validate,key};
  $('exam-program-subject-options').innerHTML=subjects.map(s=>`<option value="${E(s)}"></option>`).join('');
  let records=new Map(),drafts=new Map(),loaded=false,pending=false,current=null;
  const context=()=>window.EXAM_CONTEXT.get();
  function state(category,division,day){
    const id=key({category,division,day});if(drafts.has(id))return drafts.get(id);
    const r=records.get(id);let error='';const base=blank(category,division,day);
    const payload=r?{category:r.category,division:r.division,day:r.day,cells:Array.isArray(r.cells)?r.cells.map((c,i)=>({...base.cells[i],...c})):null}:base;
    try{validate(payload);}catch(e){error=e.message;}
    const s={payload,revision:r?.revision||0,dirty:false,conflict:false,error};drafts.set(id,s);return s;
  }
  function heading(day){const value=context().dates[day-1];return `第${'一二三'[day-1]}天｜${W.inTerm(value)?`${Number(value.slice(0,4))-1911}年${W.formatDate(value)}（星期${'一二三四五'[W.dayOf(value)]}）`:'日期尚未設定'}`;}
  function groupHtml(s){
    const p=s.payload,id=key(p),division=divisions[p.division],slots=count(p.day);
    if(s.error)return `<h4 data-program-heading="${p.day}">${E(heading(p.day))}</h4><p>雲端資料格式需管理員核對：${E(s.error)}</p>`;
    const body=division.grades.map(([grade,label],row)=>`<tr><th scope="row">${E(label)}</th>${Array.from({length:slots},(_,col)=>{
      const i=row*slots+col,c=p.cells[i],custom=!!c.subject&&!subjects.includes(c.subject),description=`${division.label}第${p.day}天${label}第${col+1}節`;
      return `<td><select data-program-index="${i}" data-program-field="subject" aria-label="${E(description)}科目"><option value="">未安排</option>${subjects.map(subject=>`<option value="${E(subject)}" ${c.subject===subject?'selected':''}>${E(subject)}</option>`).join('')}<option value="__custom__" ${custom?'selected':''}>自行輸入科目…</option></select><input type="text" data-program-index="${i}" data-program-field="custom" list="exam-program-subject-options" value="${custom?E(c.subject):''}" maxlength="80" placeholder="輸入科目，可選建議" aria-label="${E(description)}自訂科目" ${custom?'':'hidden'}><label class="exam-program-minutes">分鐘<input type="number" data-program-index="${i}" data-program-field="minutes" min="0" max="${times[col][2]}" step="1" value="${c.minutes??''}" aria-label="${E(description)}分鐘"></label><small>上限${times[col][2]}分鐘</small></td>`;
    }).join('')}</tr>`).join('');
    return `<h4 data-program-heading="${p.day}">${E(heading(p.day))}</h4><div class="table-wrap"><table class="exam-program-table ${slots===3?'half-day':''}"><caption class="sr-only">${E(context().label)} ${division.label} 第${p.day}天</caption><thead><tr><th scope="col">考試節次</th>${Array.from({length:slots},(_,i)=>`<th scope="col">${i+1}</th>`).join('')}</tr><tr><th scope="row">時段</th>${times.slice(0,slots).map(t=>`<th scope="col">${t[0]}<br>～${t[1]}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div><p data-program-audit>${E(s.conflict?'雲端已有較新版本，請先載入已儲存設定核對。':s.dirty?'尚未儲存':records.has(id)?W.auditText(records.get(id)):'此表尚未儲存，請設定科目與分鐘。')}</p><button type="button" class="action-button" data-program-save="${id}">儲存此表</button> <button type="button" class="person-button" data-program-reload="${id}">載入已儲存設定</button>`;
  }
  function renderGroup(s){const box=document.querySelector(`[data-program-group="${key(s.payload)}"]`);if(box)box.innerHTML=groupHtml(s);}
  function render(){
    if(!allowed()){$('exam-program-tables').replaceChildren();gate();return;}
    const c=context();current=c.category;$('exam-program-heading').textContent=`${c.label} 考試日程表設定`;
    $('exam-program-tables').innerHTML=Object.entries(divisions).map(([division,definition])=>`<section class="exam-program-division"><h3>${E(c.label)} ${definition.label}日程表</h3>${[1,2,3].map(day=>{const s=state(c.category,division,day);return `<section class="exam-program-day" data-program-group="${key(s.payload)}">${groupHtml(s)}</section>`;}).join('')}</section>`).join('');gate();
  }
  function gate(){
    const list=[...drafts.values()].filter(s=>s.payload.category===current);
    $('exam-program-save-all').disabled=!allowed()||!loaded||pending||!list.some(s=>s.dirty&&!s.error);
    for(const box of $('exam-program-tables').querySelectorAll('[data-program-group]')){
      const s=drafts.get(box.dataset.programGroup);
      for(const control of box.querySelectorAll('input,select,button'))control.disabled=!allowed()||pending||(control.matches('button')&&!loaded)||(control.hasAttribute('data-program-save')&&(!s?.dirty||!!s.error));
    }
  }
  function edit(event){
    const control=event.target.closest('[data-program-field]');if(!control||!allowed()||pending)return;
    const box=control.closest('[data-program-group]'),s=drafts.get(box.dataset.programGroup),index=Number(control.dataset.programIndex),cell=s.payload.cells[index],field=control.dataset.programField;
    if(field==='subject'){
      const input=box.querySelector(`[data-program-field="custom"][data-program-index="${index}"]`),custom=control.value==='__custom__';input.hidden=!custom;cell.subject=custom?input.value.trim():control.value;
      if(!cell.subject&&!custom)cell.minutes=0;else if(!cell.minutes)cell.minutes=times[cell.period-1][2];
      box.querySelector(`[data-program-field="minutes"][data-program-index="${index}"]`).value=cell.minutes;
      if(custom)input.focus();
    }else if(field==='custom')cell.subject=control.value.trim();
    else cell.minutes=control.value===''?null:Number(control.value);
    s.dirty=true;box.querySelector('[data-program-audit]').textContent=s.conflict?'雲端已有較新版本；本地草稿保留，請載入已儲存設定核對。':'尚未儲存';$('exam-program-status').textContent='科目安排尚未儲存；切換考查次數會保留本頁草稿，重新整理會清除未儲存變更。';gate();
  }
  $('exam-program-tables').addEventListener('change',event=>{if(event.target.matches('select'))edit(event);});
  $('exam-program-tables').addEventListener('input',event=>{if(event.target.matches('input'))edit(event);});
  async function save(ids){
    if(!allowed()||!loaded||pending)return;const member=window.AUTH_MEMBER;
    const work=ids.map(id=>drafts.get(id)).filter(s=>s?.dirty);if(!work.length)return;
    let completed=0;try{
      const packets=work.map(s=>{if(s.conflict)throw Error('雲端有較新版本，請先載入已儲存設定。');validate(s.payload);return {payload:clone(s.payload),revision:s.revision};});
      if(!window.EXAM_API?.saveProgram)throw Error('雲端服務尚未就緒，請重新整理。');pending=true;gate();
      for(const packet of packets){
        if(!allowed()||window.AUTH_MEMBER!==member)throw Error('登入狀態已變更，未完成的表格未送出。');
        await window.EXAM_API.saveProgram(packet.payload,packet.revision);
        if(!allowed()||window.AUTH_MEMBER!==member)return;
        const id=key(packet.payload),latest=records.get(id);
        if(!latest||latest.revision<=packet.revision)records.set(id,{...packet.payload,revision:packet.revision+1,createdName:latest?.createdName||member.name,updatedName:member.name});
        drafts.delete(id);state(packet.payload.category,packet.payload.division,packet.payload.day);renderGroup(drafts.get(id));completed++;
      }
      $('exam-program-status').textContent=`已儲存${completed}張日程表，僅授權試務人員可查看；尚未執行監考排班。`;
    }catch(error){if(allowed())$('exam-program-status').textContent=`已完成${completed}張；其餘未儲存，草稿保留：${error.message}`;}
    finally{pending=false;gate();}
  }
  $('exam-program-save-all').addEventListener('click',()=>save([...drafts.entries()].filter(([,s])=>s.payload.category===current&&s.dirty).map(([id])=>id).sort()));
  $('exam-program-tables').addEventListener('click',event=>{
    const button=event.target.closest('[data-program-save],[data-program-reload]');if(!button||!allowed()||!loaded||pending)return;
    if(button.dataset.programSave){save([button.dataset.programSave]);return;}
    const id=button.dataset.programReload,s=drafts.get(id);
    if(s?.dirty&&!confirm('重新載入會捨棄這張表未儲存的變更，確定繼續？'))return;
    drafts.delete(id);const next=state(s.payload.category,s.payload.division,s.payload.day);renderGroup(next);$('exam-program-status').textContent='已載入雲端目前版本；沒有儲存紀錄則顯示空白表格。';gate();
  });
  window.addEventListener('exam-context-changed',()=>{
    if(!allowed())return;
    if(current!==context().category){render();return;}
    for(const title of $('exam-program-tables').querySelectorAll('[data-program-heading]'))title.textContent=heading(Number(title.dataset.programHeading));
  });
  window.addEventListener('exam-program-sync-loading',()=>{loaded=false;if(allowed())$('exam-program-status').textContent='正在讀取雲端日程表，尚不能儲存。';gate();});
  window.addEventListener('cloud-exam-programs',event=>{
    if(!allowed())return;
    records=new Map(event.detail.map(r=>[r.id||key(r),r]));loaded=true;
    for(const [id,s] of [...drafts]){if(!s.dirty){drafts.delete(id);const next=state(s.payload.category,s.payload.division,s.payload.day);renderGroup(next);}else{s.conflict=(records.get(id)?.revision||0)!==s.revision;const note=document.querySelector(`[data-program-group="${id}"] [data-program-audit]`);if(note&&s.conflict)note.textContent='雲端已有較新版本；本地草稿保留，請先載入已儲存設定核對。';}}
    if(current!==context().category||!$('exam-program-tables').children.length)render();else gate();
    if(!pending)$('exam-program-status').textContent='已同步雲端日程表。未儲存草稿不會自動上傳；資料僅供授權試務人員使用。';
  });
  window.addEventListener('exam-program-sync-error',event=>{loaded=false;if(allowed())$('exam-program-status').textContent=`無法讀取日程表：${event.detail} 請完整發布新版Firestore規則後重新整理。`;gate();});
  window.addEventListener('authorization-changed',()=>{
    if(!allowed()){records.clear();drafts.clear();loaded=false;pending=false;current=null;$('exam-program-tables').replaceChildren();$('exam-program-status').textContent='';$('exam-program').hidden=true;}else render();gate();
  });
  gate();
})();
