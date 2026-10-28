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
  let records=new Map(),drafts=new Map(),loaded=false,pending=false,current=null,cloudError='';
  const context=()=>window.EXAM_CONTEXT.get();
  function payloadFor(r,category,division,day){
    const base=blank(category,division,day);
    return r?{category:r.category,division:r.division,day:r.day,cells:Array.isArray(r.cells)?r.cells.map((c,i)=>({...base.cells[i],...c})):null}:base;
  }
  function state(category,division,day){
    const id=key({category,division,day});if(drafts.has(id))return drafts.get(id);
    const r=records.get(id);let error='';const payload=payloadFor(r,category,division,day);
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
    return `<h4 data-program-heading="${p.day}">${E(heading(p.day))}</h4><div class="table-wrap"><table class="exam-program-table ${slots===3?'half-day':''}"><caption class="sr-only">${E(context().label)} ${division.label} 第${p.day}天</caption><thead><tr><th scope="col">考試節次</th>${Array.from({length:slots},(_,i)=>`<th scope="col">${i+1}</th>`).join('')}</tr><tr><th scope="row">時段</th>${times.slice(0,slots).map(t=>`<th scope="col">${t[0]}<br>～${t[1]}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div><p data-program-audit>${E(s.conflict?'雲端已有較新版本，請先載入已儲存設定核對。':s.dirty?'尚未儲存':records.has(id)?W.auditText(records.get(id)):'此表尚未儲存，請設定科目與分鐘。')}</p><button type="button" class="action-button" data-program-save="${id}">儲存此表</button> <button type="button" class="person-button" data-program-reload="${id}">載入已儲存設定</button><p data-program-save-gate role="status"></p><p data-program-save-status role="status" aria-live="polite" hidden></p>`;
  }
  function renderGroup(s){const box=document.querySelector(`[data-program-group="${key(s.payload)}"]`);if(box)box.innerHTML=groupHtml(s);}
  function render(){
    if(!allowed()){$('exam-program-tables').replaceChildren();gate();return;}
    const c=context();current=c.category;$('exam-program-heading').textContent=`${c.label} 考試日程表設定`;
    $('exam-program-tables').innerHTML=Object.entries(divisions).map(([division,definition])=>`<section class="exam-program-division"><h3>${E(c.label)} ${definition.label}日程表</h3>${[1,2,3].map(day=>{const s=state(c.category,division,day);return `<section class="exam-program-day" data-program-group="${key(s.payload)}">${groupHtml(s)}</section>`;}).join('')}</section>`).join('');gate();
  }
  function gate(){
    const list=[...drafts.values()].filter(s=>s.payload.category===current);
    const previous=categories[categories.indexOf(current)-1];
    $('exam-program-copy-previous').disabled=!allowed()||!loaded||pending||!previous||![...records.values()].some(r=>r.category===previous);
    $('exam-program-copy-previous').textContent=previous?`帶入第${previous==='first'?'一':'二'}次考查日程`:'帶入前一次考查日程';
    $('exam-program-copy-note').textContent=!previous?'第一次考查沒有前一次資料可帶入。':`僅帶入前一次已儲存的科目與分鐘，不變更本次日期；帶入後可手動調整，再按儲存。前一次未設定的表格會維持本次原狀。`;
    $('exam-program-save-all').disabled=!allowed()||!loaded||pending||!list.some(s=>s.dirty&&!s.error);
    $('exam-program-retry').disabled=!allowed()||pending;
    for(const box of $('exam-program-tables').querySelectorAll('[data-program-group]')){
      const s=drafts.get(box.dataset.programGroup);
      for(const control of box.querySelectorAll('input,select,button'))control.disabled=!allowed()||pending||(control.hasAttribute('data-program-reload')&&!loaded);
      const note=box.querySelector('[data-program-save-gate]');if(note)note.textContent=!allowed()?'需要管理員或試務組長權限。':pending?'處理中，請稍候。':!loaded?`雲端尚未讀取成功，暫不能儲存。${cloudError||'請按上方「重新檢查雲端連線」。'}`:s?.error?`資料格式需核對：${s.error}`:s?.dirty?'有未儲存變更；按「儲存此表」後，結果會顯示在這裡。':'目前沒有新的變更。';
    }
  }
  function localStatus(ids,message){for(const id of ids){const note=document.querySelector(`[data-program-group="${id}"] [data-program-save-status]`);if(note){note.hidden=false;note.textContent=message;}}}
  function syncInputs(ids){
    for(const id of ids){const s=drafts.get(id),box=document.querySelector(`[data-program-group="${id}"]`);if(!s||!box||s.error)continue;
      for(let i=0;i<s.payload.cells.length;i++){const cell=s.payload.cells[i],select=box.querySelector(`[data-program-index="${i}"][data-program-field="subject"]`),input=box.querySelector(`[data-program-index="${i}"][data-program-field="minutes"]`);if(!select||!input)continue;const subject=select.value==='__custom__'?box.querySelector(`[data-program-index="${i}"][data-program-field="custom"]`).value.trim():select.value,minutes=input.value===''?null:Number(input.value);if(cell.subject!==subject||cell.minutes!==minutes){cell.subject=subject;cell.minutes=minutes;s.dirty=true;}}
    }
  }
  const saveError=error=>error.code==='permission-denied'?'資料庫拒絕儲存：請確認帳號為管理員／試務組長，以及最新Firestore規則包含examPrograms。':error.code==='unavailable'?'目前無法連上資料庫，草稿保留；請檢查網路後重試。':error.message;
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
    if(pending)return;
    if(!allowed()){localStatus(ids,'無法儲存：需要管理員或試務組長權限。');return;}
    syncInputs(ids);
    if(!loaded){const message=`尚未儲存：雲端尚未讀取成功。${cloudError||'請按上方「重新檢查雲端連線」。'}草稿仍保留。`;localStatus(ids,message);$('exam-program-status').textContent=message;gate();return;}
    const member=window.AUTH_MEMBER,work=ids.map(id=>drafts.get(id)).filter(s=>s?.dirty);
    if(!work.length){localStatus(ids,'此表沒有新的變更，無須重複儲存。');gate();return;}
    const finished=new Set();let completed=0;try{
      const packets=work.map(s=>{if(s.error)throw Error(s.error);if(s.conflict)throw Error('雲端有較新版本，請先載入已儲存設定。');validate(s.payload);return {payload:clone(s.payload),revision:s.revision};});
      if(!window.EXAM_API?.saveProgram)throw Error('雲端服務尚未就緒，請重新整理。');pending=true;gate();
      for(const packet of packets){
        const packetId=key(packet.payload);localStatus([packetId],'儲存中，正在等待資料庫回覆…');
        if(!allowed()||window.AUTH_MEMBER!==member)throw Error('登入狀態已變更，未完成的表格未送出。');
        await window.EXAM_API.saveProgram(packet.payload,packet.revision);
        if(!allowed()||window.AUTH_MEMBER!==member)return;
        const id=key(packet.payload),latest=records.get(id);
        if(!latest||latest.revision<=packet.revision)records.set(id,{...packet.payload,revision:packet.revision+1,createdName:latest?.createdName||member.name,updatedName:member.name});
        drafts.delete(id);state(packet.payload.category,packet.payload.division,packet.payload.day);renderGroup(drafts.get(id));completed++;finished.add(id);localStatus([id],'此表已儲存成功。');
      }
      $('exam-program-status').textContent=`已儲存${completed}張日程表，僅授權試務人員可查看；尚未執行監考排班。`;
    }catch(error){if(allowed()){const reason=saveError(error);$('exam-program-status').textContent=`已完成${completed}張；其餘未儲存，草稿保留：${reason}`;localStatus(ids.filter(id=>!finished.has(id)),`尚未儲存，草稿保留：${reason}`);}}
    finally{pending=false;gate();}
  }
  $('exam-program-save-all').addEventListener('click',()=>{const ids=[...drafts.entries()].filter(([,s])=>s.payload.category===current).map(([id])=>id).sort();syncInputs(ids);save(ids.filter(id=>drafts.get(id).dirty));});
  $('exam-program-retry').addEventListener('click',async()=>{if(!allowed()||pending)return;pending=true;gate();try{if(!window.EXAM_API?.reloadPrograms)throw Error('登入服務尚未就緒，請先保留草稿，確認新版網頁與管理員登入。');await window.EXAM_API.reloadPrograms();if(allowed())$('exam-program-status').textContent='雲端連線已重新檢查，未儲存草稿保留。';}catch(error){loaded=false;cloudError=saveError(error);if(allowed())$('exam-program-status').textContent=`雲端讀取失敗：${cloudError}`;}finally{pending=false;gate();}});
  $('exam-program-copy-previous').addEventListener('click',()=>{
    if(!allowed()||!loaded||pending)return;
    const previous=categories[categories.indexOf(current)-1];if(!previous)return;
    try{
      const items=[];let missing=0;
      for(const division of Object.keys(divisions))for(const day of [1,2,3]){
        const source=records.get(key({category:previous,division,day}));if(!source){missing++;continue;}
        const payload=payloadFor(source,previous,division,day);validate(payload);
        const target=state(current,division,day);
        if(target.error||target.conflict)throw Error('本次日程有格式或版本衝突，請先載入已儲存設定核對。');
        items.push({target,cells:clone(payload.cells)});
      }
      if(!items.length)throw Error('前一次尚無已儲存日程表，請先儲存前一次資料。');
      if(items.some(({target})=>target.dirty||records.has(key(target.payload)))&&!confirm(`將以前一次已儲存資料取代本次${items.length}張表的科目與分鐘（含未儲存草稿），確定帶入？本次日期不變，尚不會寫入雲端。`))return;
      for(const {target,cells} of items){target.payload.cells=cells;target.dirty=true;}
      render();$('exam-program-status').textContent=`已帶入前一次${items.length}張日程表${missing?`；前一次未設定${missing}張，維持本次原狀`:''}。這是未儲存草稿，可手動調整；本次日期不變，請核對後儲存。`;
    }catch(error){$('exam-program-status').textContent=`未帶入：${error.message}`;}gate();
  });
  $('exam-program-tables').addEventListener('click',event=>{
    const button=event.target.closest('[data-program-save],[data-program-reload]');if(!button||pending)return;
    if(button.dataset.programSave){save([button.dataset.programSave]);return;}
    if(!allowed()||!loaded)return;
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
    records=new Map(event.detail.map(r=>[r.id||key(r),r]));loaded=true;cloudError='';
    for(const [id,s] of [...drafts]){if(!s.dirty){drafts.delete(id);const next=state(s.payload.category,s.payload.division,s.payload.day);renderGroup(next);}else{s.conflict=(records.get(id)?.revision||0)!==s.revision;const note=document.querySelector(`[data-program-group="${id}"] [data-program-audit]`);if(note&&s.conflict)note.textContent='雲端已有較新版本；本地草稿保留，請先載入已儲存設定核對。';}}
    if(current!==context().category||!$('exam-program-tables').children.length)render();else gate();
    if(!pending)$('exam-program-status').textContent='已同步雲端日程表。未儲存草稿不會自動上傳；資料僅供授權試務人員使用。';
  });
  window.addEventListener('exam-program-sync-error',event=>{loaded=false;cloudError=event.detail;if(allowed())$('exam-program-status').textContent=`無法讀取日程表：${event.detail} 請確認新版Firestore規則，並按「重新檢查雲端連線」；未儲存草稿保留。`;gate();});
  window.addEventListener('authorization-changed',()=>{
    if(!allowed()){records.clear();drafts.clear();loaded=false;pending=false;current=null;cloudError='';$('exam-program-tables').replaceChildren();$('exam-program-status').textContent='';$('exam-program').hidden=true;}else render();gate();
  });
  gate();
})();
