(() => {
  'use strict';
  const $=id=>document.getElementById(id),E=window.WEEKLY.esc,roster=window.INVIGILATION_MODEL.roster;
  const categories=['first','second','third'],poolKeys=['totalInvig','totalPaper','dutyWork','teaching','count'],rowKeys=['share','carry','paper'];
  const allowed=()=>['admin','exam'].includes(window.AUTH_MEMBER?.role),current=()=>window.EXAM_CONTEXT.get().category;
  let book=new Map(),rendered=null;
  const blank=()=>({pool:Object.fromEntries(poolKeys.map(k=>[k,''])),rows:Object.fromEntries(roster.map(t=>[t.id,{share:'',carry:'',paper:'0'}])),final:null});
  const state=cat=>{if(!book.has(cat))book.set(cat,blank());return book.get(cat);};
  const number=(raw,{signed=false,integer=false}={})=>{
    if(typeof raw!=='string'||!raw.trim()||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim()))return null;
    const value=Number(raw);return Number.isFinite(value)&&Math.abs(value)<=1e9&&(signed||value>=0)&&(!integer||Number.isInteger(value))?value:null;
  };
  const format=n=>n===null?'待設定':new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(Math.abs(n)<1e-9?0:n);
  function poolResult(pool){
    const values=poolKeys.map(k=>number(pool[k],{integer:k==='count'}));
    if(values.some(x=>x===null))return {value:null,error:'請填妥五項數字；分鐘不可為負數，老師人數須為正整數。'};
    const [invig,paper,duty,teaching,count]=values;
    if(count<=0)return {value:null,error:'分攤老師人數必須大於0，不能除以0。'};
    return {value:(invig+paper+duty-teaching)/count,error:''};
  }
  function results(cat){
    const d=state(cat),pool=poolResult(d.pool),settings=window.EXAM_CONTEXT.saved(cat);
    const bases=new Map(settings?window.EXAM_CALCULATOR.totals(settings.dates).map(t=>[t.id,t.minutes]):[]);
    const actual=window.INVIGILATION_STATE.actual(cat),previous=categories[categories.indexOf(cat)-1];
    let carryBalances=null;
    if(previous){const previousState=state(previous);if(previousState.final){const previousResult=results(previous);if(previousResult.canFinalize&&previousState.final.signature===previousResult.signature&&previousResult.rows.every(r=>previousState.final.balances[r.id]===r.balance))carryBalances=previousState.final.balances;}}
    const rows=roster.map(t=>{
      const raw=d.rows[t.id],base=bases.get(t.id)??null;
      const share=raw.share.trim()?number(raw.share,{signed:true}):pool.value;
      const carry=raw.carry.trim()?number(raw.carry,{signed:true}):previous?(carryBalances?.[t.id]??null):0;
      const paper=number(raw.paper),due=[base,share,carry,paper].some(v=>v===null)?null:base+share+carry-paper;
      const real=actual.minutes[t.id]||0,balance=due===null?null:due-real;
      return {id:t.id,name:t.name,base,share,carry,paper,due,actual:real,balance};
    });
    const signature=JSON.stringify([d.pool,d.rows,settings?.revision||0,settings?.dates||null,rows.map(r=>[r.base,r.share,r.carry,r.actual]),actual.days,!!actual.complete]);
    return {rows,pool,signature,previous,actual,canFinalize:!!settings&&actual.days.length===3&&actual.days.every(Boolean)&&!!actual.complete&&rows.every(r=>r.balance!==null)};
  }
  function validateBackup(value){
    if(!value||value.format!=='tcsh-coefficient-v1'||!value.categories||Object.keys(value.categories).some(c=>!categories.includes(c)))throw Error('係數備份格式不符。');
    const string=v=>typeof v==='string'&&v.length<=40;
    for(const d of Object.values(value.categories)){
      if(!d||Object.keys(d).sort().join(',')!=='final,pool,rows'||!d.pool||Object.keys(d.pool).sort().join(',')!==[...poolKeys].sort().join(',')||poolKeys.some(k=>!string(d.pool[k])))throw Error('共同分攤資料格式不符。');
      if(!d.rows||Object.keys(d.rows).length!==roster.length||Object.keys(d.rows).some(id=>!roster.some(t=>t.id===id)))throw Error('係數教師名單不符。');
      for(const t of roster){const row=d.rows[t.id];if(!row||Object.keys(row).sort().join(',')!=='carry,paper,share'||rowKeys.some(k=>!string(row[k])))throw Error('教師係數格式不符。');}
      if(d.final!==null){const f=d.final;if(!f||Object.keys(f).sort().join(',')!=='at,balances,signature'||typeof f.signature!=='string'||f.signature.length>100000||typeof f.at!=='string'||!f.balances||Object.keys(f.balances).length!==roster.length||roster.some(t=>!Number.isFinite(f.balances[t.id])))throw Error('結餘確認資料格式不符。');}
    }
    return JSON.parse(JSON.stringify(value));
  }
  window.EXAM_COEFFICIENT={number,poolResult,results,validateBackup,backup:()=>({format:'tcsh-coefficient-v1',categories:Object.fromEntries([...book].map(([cat,d])=>[cat,JSON.parse(JSON.stringify(d))]))}),restore:value=>{const checked=validateBackup(value);book=new Map(Object.entries(checked.categories));rendered=null;if(allowed())render();}};
  function render(){
    if(!allowed())return;
    rendered=current();const d=state(rendered);
    for(const k of poolKeys)$(`coef-${k}`).value=d.pool[k];
    $('inv-minute-totals').innerHTML=`<table class="coefficient-table"><caption>${E(window.EXAM_CONTEXT.get().label)}監考分鐘結算（本機草稿）</caption><thead><tr><th>教師編號</th><th>教師姓名</th><th>監考基數</th><th>本次分攤時數</th><th>上次結餘時數</th><th>本次命題時數</th><th>本次應監考時數</th><th>本次實際監考時數</th><th>本次結餘時數</th></tr></thead><tbody>${roster.map(t=>`<tr data-coef-teacher="${t.id}"><td>${t.id}</td><th>${E(t.name)}</th><td data-coef-value="base"></td>${rowKeys.map(k=>`<td><input type="text" inputmode="decimal" maxlength="40" data-coef-field="${k}" aria-label="${E(t.name)}${{share:'本次分攤',carry:'上次結餘',paper:'本次命題'}[k]}分鐘" value="${E(d.rows[t.id][k])}"><small data-coef-note="${k}"></small></td>`).join('')}<td data-coef-value="due"></td><td data-coef-value="actual"></td><td data-coef-value="balance"></td></tr>`).join('')}</tbody></table>`;
    refresh();
  }
  function refresh(){
    if(!allowed())return;if(rendered!==current())return render();
    const d=state(current()),r=results(current());
    $('coef-pool-result').textContent=r.pool.value===null?r.pool.error:`每位共同分攤：${format(r.pool.value)}分鐘（顯示至小數2位，內部保留完整精度；可為負數）。`;
    for(const row of r.rows){const tr=$('inv-minute-totals').querySelector(`[data-coef-teacher="${row.id}"]`),raw=d.rows[row.id];
      for(const k of ['base','due','actual','balance']){const cell=tr.querySelector(`[data-coef-value="${k}"]`);cell.textContent=format(row[k]);cell.title=row[k]===null?'資料尚未齊全':String(row[k]);}
      for(const k of rowKeys){const input=tr.querySelector(`[data-coef-field="${k}"]`),note=tr.querySelector(`[data-coef-note="${k}"]`);const invalid=raw[k].trim()&&number(raw[k],{signed:k!=='paper'})===null;input.setAttribute('aria-invalid',String(!!invalid));input.placeholder=k==='paper'?'0':format(row[k]);note.textContent=invalid?'請填有效數字':k==='paper'?'手動輸入':raw[k].trim()?'手動覆寫':row[k]===null?(k==='carry'?'上次未確認，可手動輸入':'等待共同分攤結果'):`自動 ${format(row[k])} 分鐘`;}
    }
    $('coef-finalize').disabled=!r.canFinalize;
    const confirmed=d.final?.signature===r.signature;
    $('coef-status').textContent=confirmed?'本次結餘已確認；下次可自動帶入。任何計算來源變動均須重新確認。':!r.actual.days.every(Boolean)?'目前實際分鐘只含第一天；第二、三天尚未編排，不能確認三天最終結餘。上次結餘可先手動輸入。':'請完成三天排班與所有數值後，確認本次結餘。';
  }
  for(const k of poolKeys)$(`coef-${k}`).addEventListener('input',()=>{if(!allowed())return;state(current()).pool[k]=$(`coef-${k}`).value;state(current()).final=null;refresh();});
  $('inv-minute-totals').addEventListener('input',event=>{const input=event.target.closest('[data-coef-field]');if(!input||!allowed())return;const id=input.closest('[data-coef-teacher]').dataset.coefTeacher;state(current()).rows[id][input.dataset.coefField]=input.value;state(current()).final=null;refresh();});
  $('coef-finalize').addEventListener('click',()=>{if(!allowed())return;const r=results(current());if(!r.canFinalize)return;if(!confirm('確認本次結餘，作為下次考查預設帶入？'))return;state(current()).final={signature:r.signature,balances:Object.fromEntries(r.rows.map(t=>[t.id,t.balance])),at:new Date().toISOString()};refresh();});
  $('coef-export').addEventListener('click',()=>{if(allowed())$('inv-export').click();});$('coef-import').addEventListener('click',()=>{if(allowed())$('inv-import').click();});
  for(const name of ['exam-context-changed','invigilation-changed'])window.addEventListener(name,()=>{if(allowed())refresh();});
  window.addEventListener('exam-tab-changed',event=>{if(allowed()&&event.detail==='coefficient')render();});
  window.addEventListener('authorization-changed',()=>{if(!allowed()){book.clear();rendered=null;for(const k of poolKeys)$(`coef-${k}`).value='';$('coef-pool-result').textContent='';$('coef-status').textContent='';$('inv-minute-totals').replaceChildren();}else render();});
})();
