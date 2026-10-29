(() => {
  const W=window.WEEKLY,$=id=>document.getElementById(id),E=W.esc;
  const labels={first:'第一次定期考查',second:'第二次定期考查',third:'第三次定期考查'};
  const tabs={basic:'日程基本設定',coefficient:'監考係數計算',schedule:'考試日程表設定',day1:'第一天監考試排',day2:'第二天監考試排',day3:'第三天監考試排'};
  const teachers=window.SCHEDULE_DATA.teachers.filter(t=>!['葉梅花','劉柔秀','薛靜儀'].includes(t.name));
  // Confirmed by the teaching office: no teaching assignment this semester.
  teachers.push({id:'617',name:'薛靜儀',sessions:[]});
  teachers.sort((a,b)=>String(a.id).localeCompare(String(b.id),'en',{numeric:true}));
  let records=new Map(),loaded=false,pending=false,dirty=false,current='first',revision=0;
  const allowed=()=>['admin','exam'].includes(window.AUTH_MEMBER?.role);
  function dates(){
    const first=$('exam-date-1').value,last=$('exam-date-3').value,range=[];
    if(W.inTerm(first)&&W.inTerm(last)&&first<=last)for(let date=first;date<=last;date=W.plus(date,1))if(W.inTerm(date))range.push(date);
    const middle=range.length===3?range[1]:'';
    $('exam-date-2').value=middle;
    $('exam-derived-date').textContent=middle?`第二天自動帶入：${W.formatDate(middle)}（星期${'一二三四五'[W.dayOf(middle)]}）。`:'選擇第一天與第三天後，自動帶入第二天；起訖範圍須恰含3個平日（不自動判斷國定假日）。';
    return [first,middle,last];
  }
  function validate(values){
    if(!values[0]||!values[2])return '請選擇第一天與第三天日期。';
    if(!values[1])return '第一天至第三天的範圍須恰含3個平日，才能自動判定第二天。';
    if(!values.every(W.inTerm))return '考試日期須為本學期（115.08.31～116.01.20）週一至週五。';
    if(!(values[0]<values[1]&&values[1]<values[2]))return '第一天須早於第三天，且包含第二天。';
    return '';
  }
  function totals(values){
    return teachers.map(t=>({id:t.id,name:t.name,minutes:t.missingOriginal?null:values.reduce((sum,date,index)=>{
      const day=W.dayOf(date),limit=index===2?4:7;
      const occupied=new Set((t.sessions||[]).filter(s=>s.day===day&&Number.isInteger(s.row)&&s.row>=1&&s.row<=limit).map(s=>s.row));
      return sum+occupied.size*50;
    },0)}));
  }
  function gate(){
    $('exam-save').disabled=!allowed()||!loaded||pending||!!validate(dates());
    $('exam-reload').disabled=!allowed()||!loaded||pending;
    for(const id of ['exam-category','exam-date-1','exam-date-2','exam-date-3'])$(id).disabled=!allowed()||pending;
    for(const b of $('exam-navigation').querySelectorAll('button'))b.disabled=!allowed()||pending;
  }
  function calculate(){
    window.dispatchEvent(new Event('exam-context-changed'));
    $('exam-teacher-totals').replaceChildren();
    if(!allowed()){$('exam-calculation-status').textContent='';gate();return;}
    const values=dates(),error=validate(values);
    if(error){$('exam-calculation-status').textContent=error;gate();return;}
    const list=totals(values);
    $('exam-calculation-status').textContent=`${labels[current]}｜${values.map(d=>`${W.formatDate(d)}（星期${'一二三四五'[W.dayOf(d)]}）`).join('、')}｜${list.length}位教師${dirty?'｜尚未儲存':''}`;
    $('exam-teacher-totals').innerHTML=`<table class="exam-totals"><caption>${E(labels[current])}原始課表授課時長</caption><thead><tr><th scope="col">教師編號</th><th scope="col">教師姓名</th><th scope="col">${E(labels[current])}總授課時長（分鐘）</th></tr></thead><tbody>${list.map(t=>`<tr data-exam-teacher="${E(t.id)}"><td>${E(t.id)}</td><th scope="row">${E(t.name)}</th><td>${t.minutes===null?'原始課表未提供，待確認':t.minutes}</td></tr>`).join('')}</tbody></table>`;gate();
  }
  function loadCurrent(){
    const record=records.get(current);revision=record?.revision||0;dirty=false;
    for(let i=1;i<=3;i++)$(`exam-date-${i}`).value=record?.dates?.[i-1]||'';
    $('exam-sync-status').textContent=!loaded?'尚未讀取雲端設定；登入後請等待同步。':record?`已載入${labels[current]}設定｜${W.auditText(record)}`:'此類別尚無已儲存設定，請選擇第一天與第三天日期後儲存。';calculate();
  }
  $('exam-navigation').addEventListener('click',event=>{
    const button=event.target.closest('[data-exam-tab]');if(!button||!allowed()||pending)return;
    const tab=button.dataset.examTab;if(!tabs[tab])return;
    for(const b of $('exam-navigation').querySelectorAll('[data-exam-tab]'))b.setAttribute('aria-pressed',String(b===button));
    $('exam-basic').hidden=tab!=='basic';$('exam-program').hidden=tab!=='schedule';$('exam-invigilation').hidden=tab!=='day1';$('exam-coefficient-preview').hidden=tab!=='coefficient';$('exam-next').hidden=['basic','schedule','day1','coefficient'].includes(tab);$('exam-next-title').textContent=tabs[tab];
    window.dispatchEvent(new CustomEvent('exam-tab-changed',{detail:tab}));
  });
  for(const i of [1,3])$(`exam-date-${i}`).addEventListener('input',()=>{if(!allowed())return;dirty=true;calculate();});
  $('exam-category').addEventListener('change',()=>{
    if(!allowed()||pending)return;
    if(dirty&&!confirm('日期尚未儲存，切換類別會捨棄未儲存變更，確定切換？')){$('exam-category').value=current;return;}
    current=$('exam-category').value;loadCurrent();
  });
  $('exam-reload').addEventListener('click',()=>{if(!allowed()||pending||!loaded)return;if(dirty&&!confirm('重新載入會捨棄未儲存日期，確定繼續？'))return;loadCurrent();});
  $('exam-settings-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!allowed()||!loaded||pending)return;
    const values=dates(),error=validate(values);if(error){$('exam-sync-status').textContent=error;return;}
    const member=window.AUTH_MEMBER,payload={category:current,dates:values};
    pending=true;gate();
    try{
      if(!window.EXAM_API)throw Error('雲端登入服務尚未就緒，請重新整理。');
      await window.EXAM_API.save(payload,revision);
      if(!allowed()||window.AUTH_MEMBER!==member)return;
      const latest=records.get(current);
      if(!latest||latest.revision<=revision)records.set(current,{...payload,revision:revision+1,createdName:latest?.createdName||member.name,updatedName:member.name});
      dirty=false;revision=records.get(current).revision;
      $('exam-sync-status').textContent=`${labels[current]}日程設定已儲存｜${member.name} 更新。`;calculate();
    }catch(error){if(allowed())$('exam-sync-status').textContent=`尚未儲存，日期保留：${error.message}`;}
    finally{pending=false;gate();}
  });
  window.addEventListener('exam-sync-loading',()=>{loaded=false;gate();});
  window.addEventListener('cloud-exam-settings',event=>{
    if(!allowed())return;
    records=new Map(event.detail.filter(r=>labels[r.category]).map(r=>[r.category,r]));loaded=true;
    if(!dirty&&!pending)loadCurrent();else{
      const changed=(records.get(current)?.revision||0)!==revision;
      $('exam-sync-status').textContent=changed?'雲端設定已更新；未儲存日期仍保留。請按「載入已儲存設定」核對後再修改。':'雲端已同步；目前日期尚未儲存。';gate();
    }
  });
  window.addEventListener('exam-sync-error',event=>{loaded=false;if(allowed())$('exam-sync-status').textContent=`無法讀取試務設定：${event.detail} 請先發布新版Firestore規則，再重新整理。`;gate();});
  window.addEventListener('authorization-changed',()=>{
    if(!allowed()){records.clear();loaded=false;pending=false;dirty=false;current='first';revision=0;$('exam-category').value=current;for(let i=1;i<=3;i++)$(`exam-date-${i}`).value='';$('exam-sync-status').textContent='尚未讀取雲端日程設定。';$('exam-teacher-totals').replaceChildren();$('exam-calculation-status').textContent='';$('exam-basic').hidden=false;$('exam-next').hidden=true;$('exam-invigilation').hidden=true;$('exam-coefficient-preview').hidden=true;for(const b of $('exam-navigation').querySelectorAll('[data-exam-tab]'))b.setAttribute('aria-pressed',String(b.dataset.examTab==='basic'));}
    gate();
  });
  window.EXAM_CONTEXT={get:()=>({category:current,label:labels[current],dates:dates()}),saved:(cat=current)=>loaded&&records.has(cat)?JSON.parse(JSON.stringify(records.get(cat))):null};
  window.EXAM_CALCULATOR={validate,totals};gate();
})();
