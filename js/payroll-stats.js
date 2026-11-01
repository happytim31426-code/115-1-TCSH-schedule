const $=id=>document.getElementById(id),E=window.WEEKLY.esc;
const allowed=()=>window.AUTH_MEMBER?.role==='admin'&&document.body.dataset.workspace==='office'&&document.body.dataset.officeFeature==='payroll';
const fields=[['basic','基本鐘點'],['over','超鐘點●'],['actual','實上實銷'],['wednesdayActual','週三第六節實'],['eighth','第八節'],['saturday','週六授課'],['lunch','週六用餐午休']];
const limits={basic:40,over:35,actual:35,wednesdayActual:1,eighth:5,saturday:8,lunch:1};
let source=null,preview=null,rows=[],generation=0,running=false,painting=false,processingComplete=false;
const normalize=s=>String(s||'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248));
export function clearPayrollStats(){generation++;source=null;preview=null;rows=[];running=false;processingComplete=false;$('payroll-statistics').hidden=true;$('payroll-stats-table').replaceChildren();$('payroll-stats-status').textContent='';$('payroll-analyze').disabled=true;$('payroll-stats-backup').disabled=true;}
export function attachPayrollStats(doc,show){clearPayrollStats();if(!allowed())return;source=doc;preview=show;$('payroll-statistics').hidden=false;$('payroll-analyze').disabled=false;$('payroll-stats-status').textContent='請按「開始辨識並統計」。結果須人工核對，不直接作為核發依據。';}
function parse(items,annotations,viewport,page){
  const pieces=items.filter(i=>typeof i.str==='string').map(i=>({text:normalize(i.str),x:(i.transform[4]+i.width/2)*595.2/viewport.width,y:(viewport.height-i.transform[5]-i.height/2)*841.92/viewport.height}));
  const text=pieces.map(p=>p.text).join(' '),id=normalize(text).match(/編\s*號\s*[:：]?\s*(\d{3})/)?.[1]||'';
  const heading=pieces.filter(p=>p.y>55&&p.y<86).sort((a,b)=>a.x-b.x).map(p=>p.text).join('').replace(/\s/g,'');
  const name=heading.match(/教師[:：](.+)/)?.[1]||window.SCHEDULE_DATA.teachers.find(t=>t.id===id)?.name||'待核對';
  const r={id,name,page,reviewed:false,warnings:[],...Object.fromEntries(fields.map(([k])=>[k,0]))};
  const anchors=['08:00','09:05','10:05','11:05','13:10','14:10','15:15','16:10'];
  if(viewport.rotation!==0||anchors.filter(t=>text.replace(/\s/g,'').includes(t)).length<6||pieces.filter(p=>p.y>90&&p.y<140&&/^[一二三四五六]$/.test(p.text.trim())).length<5){r.warnings.push('版型無法確認，不能自動計數');r.unsupported=true;for(const [k]of fields)r[k]=null;return r;}
  const xs=[153,215,273,330,387,445,509],ys=[201,258,317,374,431,491,547,606,664];
  const cells=Array.from({length:6},()=>Array.from({length:8},()=>({parts:[],marks:new Set()})));
  function add(p,annotation=false){const day=xs.findIndex((x,i)=>i<6&&p.x>=x&&p.x<xs[i+1]),period=ys.findIndex((y,i)=>i<8&&p.y>=y&&p.y<ys[i+1]);if(day<0||period<0)return;const cell=cells[day][period];if(!annotation)cell.parts.push(p.text);if(/[●⬤]/.test(p.text))cell.marks.add('●');if(/[（(]\s*[實实]\s*[)）]/.test(p.text))cell.marks.add('實');if(/[（(]\s*基\s*[)）]/.test(p.text))cell.marks.add('基');}
  pieces.forEach(p=>add(p));
  for(const a of annotations){const content=a.contentsObj?.str||a.contents||'';if(!/[●⬤]|[（(]\s*[實实基]\s*[)）]/.test(content)||!a.rect)continue;add({text:content,x:(a.rect[0]+a.rect[2])/2*595.2/viewport.width,y:(viewport.height-(a.rect[1]+a.rect[3])/2)*841.92/viewport.height},true);}
  for(let day=0;day<6;day++)for(let p=0;p<8;p++){
    const cell=cells[day][p],label=cell.parts.join(' ');
    if(/[（(]\s*[實实]\s*[)）]/.test(label))cell.marks.add('實');if(/[（(]\s*基\s*[)）]/.test(label))cell.marks.add('基');
    const occupied=label.replace(/[●⬤]|[（(]\s*[實实基]\s*[)）]/g,'').trim();
    if(!occupied){if(cell.marks.size)r.warnings.push(`${'一二三四五六'[day]}第${p+1}節有記號但無課程文字`);continue;}
    if(cell.marks.size>1)r.warnings.push(`${'一二三四五六'[day]}第${p+1}節有多種記號，請人工核對`);
    if(day===5){r.saturday++;if(p===3)r.lunch=1;continue;}
    if(cell.marks.has('基'))r.basic++;
    else if(p===7){r.eighth++;if(cell.marks.size)r.warnings.push(`${'一二三四五'[day]}第八節有其他記號，目前先列第八節，請核對`);}
    else if(cell.marks.has('實')){if(day===2&&p===5)r.wednesdayActual++;else r.actual++;}
    else if(cell.marks.has('●'))r.over++;
    else r.basic++;
  }
  if(!id)r.warnings.push('教師編號未辨識，請填寫');return r;
}
function render(){
  if(!allowed())return;
  painting=true;
  rows.sort((a,b)=>(Number(a.id)||9999)-(Number(b.id)||9999)||a.page-b.page);
  $('payroll-stats-table').innerHTML=`<table class="payroll-stat-table"><thead><tr><th>編號</th><th>教師姓名</th>${fields.map(([,label])=>`<th>${label}</th>`).join('')}<th>核對／原頁</th></tr></thead><tbody>${rows.map(r=>`<tr data-payroll-row="${r.page}"><td><input data-payroll-id value="${E(r.id)}" maxlength="3" inputmode="numeric" aria-label="第${r.page}頁教師編號"></td><th><input data-payroll-name value="${E(r.name)}" maxlength="80" aria-label="第${r.page}頁教師姓名"></th>${fields.map(([k,label])=>`<td><input type="number" data-payroll-count="${k}" min="0" max="${limits[k]}" step="1" value="${r[k]??''}" aria-label="${E(r.name)}${label}"></td>`).join('')}<td><label><input type="checkbox" data-payroll-reviewed ${r.reviewed?'checked':''}>已核對</label><button type="button" class="person-button" data-payroll-page="${r.page}">原檔第${r.page}頁</button>${r.warnings.length?`<p>${E(r.warnings.join('；'))}</p>`:''}</td></tr>`).join('')}</tbody></table>`;
  for(const control of $('payroll-stats-table').querySelectorAll('input'))control.disabled=running;
  $('payroll-stats-backup').disabled=!rows.length||running;
  painting=false;
}
$('payroll-analyze').addEventListener('click',async()=>{
  if(!allowed()||!source||running)return;
  if(rows.length&&!confirm('重新辨識會取代目前人工修正，確定？'))return;
  const token=++generation,doc=source;running=true;processingComplete=false;rows=[];$('payroll-analyze').disabled=true;render();
  try{for(let page=1;page<=doc.numPages;page++){
    if(!allowed()||token!==generation||source!==doc)return;
    $('payroll-stats-status').textContent=`本機辨識第${page}／${doc.numPages}頁…尚未完成。`;
    const pdfPage=await doc.getPage(page),[text,annotations]=await Promise.all([pdfPage.getTextContent(),pdfPage.getAnnotations({intent:'display'})]);
    if(!allowed()||token!==generation||source!==doc)return;
    const row=parse(text.items,annotations,pdfPage.getViewport({scale:1}),page);if(rows.some(r=>r.id&&r.id===row.id))row.warnings.push('教師編號重複，請核對');rows.push(row);
    if(page%10===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(token===generation&&allowed()){processingComplete=true;$('payroll-stats-status').textContent=`已產生${rows.length}列待核對統計。數字可修正；請逐列對照原頁後勾選已核對。此表不是核發定案。`;window.dispatchEvent(new Event('payroll-statistics-ready'));}
  }catch(error){if(token===generation&&allowed())$('payroll-stats-status').textContent=`辨識中止，僅完成${rows.length}頁，不能作為完整統計。可重新辨識。`;}
  finally{if(token===generation&&allowed()){running=false;$('payroll-analyze').disabled=false;render();}}
});
$('payroll-stats-table').addEventListener('change',event=>{
  if(!allowed()||running||painting)return;const tr=event.target.closest('[data-payroll-row]');if(!tr)return;
  const row=rows.find(r=>r.page===Number(tr.dataset.payrollRow)),input=event.target;
  if(input.hasAttribute('data-payroll-count')){const k=input.dataset.payrollCount,n=Number(input.value);if(input.value===''||!Number.isInteger(n)||n<0||n>limits[k]){input.value=row[k]??'';return;}row[k]=n;row.reviewed=false;}
  if(input.hasAttribute('data-payroll-id')){if(!/^\d{3}$/.test(input.value)||rows.some(r=>r!==row&&r.id===input.value)){input.value=row.id;return;}row.id=input.value;row.reviewed=false;}
  if(input.hasAttribute('data-payroll-name')){if(!input.value.trim()){input.value=row.name;return;}row.name=input.value.trim();row.reviewed=false;}
  if(input.hasAttribute('data-payroll-reviewed')){if(!/^\d{3}$/.test(row.id)||rows.some(r=>r!==row&&r.id===row.id)||[...tr.querySelectorAll('[data-payroll-count]')].some(i=>i.value==='')||row.basic+row.over+row.actual+row.wednesdayActual+row.eighth>40||(row.lunch&&row.saturday===0)){input.checked=false;$('payroll-stats-status').textContent='尚不能勾選：請核對重複編號、空白數值、平日節數是否超過40，或用餐值勤是否與週六授課一致。';return;}row.reviewed=input.checked;}
  render();
});
$('payroll-stats-table').addEventListener('click',event=>{const button=event.target.closest('[data-payroll-page]');if(button&&allowed()&&preview)preview(Number(button.dataset.payrollPage));});
$('payroll-stats-backup').addEventListener('click',()=>{if(!allowed()||!rows.length||running)return;const url=URL.createObjectURL(new Blob([JSON.stringify({format:'tcsh-payroll-summary-draft-v1',status:'待核對，非核發定案',expectedPages:source?.numPages,parsedPages:rows.length,processingComplete,rows},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='鐘點節數待核對統計.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});
