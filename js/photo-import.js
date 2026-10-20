// Local OCR only: image pixels are passed to a same-origin Web Worker, never uploaded.
(() => {
  const W=window.WEEKLY,$=id=>document.getElementById(id),canvas=$('photo-canvas'),ctx=canvas.getContext('2d');
  const names=data.teachers.map(t=>t.name),classes=W.orderedClasses;
  let image=null,rotation=0,region=null,anchor=null,worker=null,rows=[],working=false,generation=0,imported=null;
  const status=text=>{$('photo-status').textContent=text;};
  const allowed=()=>!!window.AUTH_MEMBER;
  $('photo-teachers').innerHTML=data.teachers.map(t=>`<option value="${W.esc(t.name)}">${W.esc(t.id)}</option>`).join('');
  function render(){
    $('photo-review').innerHTML=rows.map((r,i)=>`<section class="teaching-record"><h4>第${i+1}筆（${r.published?'已送出':'待核對，未送出'}）</h4><div class="tool-grid">
      <label>處理方式<select data-photo-field="kind" data-index="${i}"><option value="swap" ${r.kind==='swap'?'selected':''}>調課</option><option value="sub" ${r.kind==='sub'?'selected':''}>代課</option></select></label>
      <label>原課日期<input type="date" data-photo-field="date" data-index="${i}" value="${W.esc(r.date)}" min="${W.start}" max="${W.end}"></label>
      <label>原課節次<input type="number" min="1" max="8" data-photo-field="row" data-index="${i}" value="${W.esc(r.row)}"></label>
      <label>原課班級<select data-photo-field="classId" data-index="${i}"><option value="">請人工確認班級</option>${classes.map(c=>`<option value="${W.esc(c.id)}" ${r.classId===c.id?'selected':''}>${W.esc(c.name)} ${c.publicCode}</option>`).join('')}</select></label>
      <label>交換日期（代課免填）<input type="date" data-photo-field="otherDate" data-index="${i}" value="${W.esc(r.otherDate)}" min="${W.start}" max="${W.end}"></label>
      <label>交換節次（代課免填）<input type="number" min="1" max="8" data-photo-field="otherRow" data-index="${i}" value="${W.esc(r.otherRow)}"></label>
      <label>調／代課教師<input list="photo-teachers" data-photo-field="partner" data-index="${i}" value="${W.esc(r.partner)}" placeholder="請確認完整姓名"></label>
      <label>交換科目（供核對）<input data-photo-field="subject" data-index="${i}" value="${W.esc(r.subject)}" maxlength="160"></label></div>
      <button type="button" class="action-button" data-photo-apply="${i}" ${r.published?'disabled':''}>${r.published?'已送出至公開課表':'已核對，帶入表單'}</button> <button type="button" class="person-button" data-photo-remove="${i}">移除此筆待核對資料</button><p data-photo-warning="${i}">${r.published?'已完成送出；後續請至課務紀錄修正或刪除。':r.applied?'已帶入表單，仍須按下方送出。':'所有欄位均須人工核對，空白表示未辨識。'}</p></section>`).join('');
    for(const field of $('photo-review').querySelectorAll('[data-photo-field]'))if(rows[Number(field.dataset.index)]?.published)field.disabled=true;
  }
  const emptyRow=()=>({kind:'swap',date:'',row:'',classId:'',otherDate:'',otherRow:'',partner:'',subject:''});
  const compact=value=>value.replace(/\s/g,'').replace(/臺/g,'台');
  function parse(text){
    const lines=text.replace(/[／]/g,'/').split(/\r?\n/),result=[];
    const years=[...new Set([W.start.slice(0,4),W.end.slice(0,4)])];
    const fullDate=(month,day)=>{const matches=years.map(year=>`${year}-${String(Number(month)).padStart(2,'0')}-${String(Number(day)).padStart(2,'0')}`).filter(W.inTerm);return matches.length===1?matches[0]:'';};
    let applicant='';const nameLines=lines.filter(line=>/姓名/.test(line));
    const found=names.filter(name=>nameLines.some(line=>compact(line).includes(compact(name))));if(found.length===1)applicant=found[0];
    for(const line of lines){
      if(!/[調代]/.test(line))continue;
      const dates=[...line.matchAll(/\b(\d{1,2})(?:\s*[/月.-]\s*|\s+)(\d{1,2})(?:日)?\s*(?:(?:星期|週)?[一二三四五六日天]\s*)?(?:第\s*)?([1-8一二三四五六七八])(?:\s*節)?/g)];
      if(!dates.length)continue;
      const r=emptyRow(),first=dates[0],second=dates[1],number=v=>String('一二三四五六七八'.includes(v)?'一二三四五六七八'.indexOf(v)+1:Number(v));
      r.date=fullDate(first[1],first[2]);r.row=number(first[3]);r.kind=/代/.test(line)&&!/調/.test(line)?'sub':'swap';
      const cls=classes.filter(c=>compact(line).includes(compact(c.name)));if(cls.length===1)r.classId=cls[0].id;
      if(second){r.otherDate=fullDate(second[1],second[2]);r.otherRow=number(second[3]);}
      const partners=names.filter(n=>n!==applicant&&compact(line).includes(compact(n)));if(partners.length===1)r.partner=partners[0];
      if(second){const rest=line.slice(second.index+second[0].length);r.subject=rest.split(/[調代]/)[0].trim().replace(/[|｜]/g,'').slice(0,160);}
      result.push(r);
    }
    return {applicant,rows:result};
  }
  function draw(){
    if(!image)return;
    const swap=rotation%180!==0;canvas.width=swap?image.height:image.width;canvas.height=swap?image.width:image.height;
    ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(image,-image.width/2,-image.height/2);ctx.restore();
    if(region){ctx.strokeStyle='#e16614';ctx.lineWidth=Math.max(3,canvas.width/350);ctx.strokeRect(region.x,region.y,region.w,region.h);}
  }
  function clean(){generation++;if(worker){worker.terminate().catch(()=>{});worker=null;}image=null;region=null;anchor=null;imported=null;rotation=0;rows=[];working=false;$('photo-file').value='';$('photo-text').value='';$('photo-applicant').value='';$('photo-workspace').hidden=true;canvas.width=0;canvas.height=0;render();status('');$('photo-recognize').disabled=false;}
  $('photo-file').addEventListener('change',async()=>{
    if(!allowed())return clean();if(working){status('正在辨識，請先等待完成或按清除，再更換照片。');return;}const file=$('photo-file').files[0];if(!file)return;if(file.size>15*1024*1024){status('照片上限15MB，請先縮小或重新拍攝。');return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){status('請使用 JPG、PNG 或 WebP 圖片。');return;}
    const token=++generation,url=URL.createObjectURL(file),next=new Image();
    try{next.src=url;await next.decode();if(token!==generation)return;if(next.width*next.height>25000000)throw Error('照片尺寸過大，請先縮小至2500萬畫素內。');image=next;rotation=0;region=null;rows=[];$('photo-text').value='';$('photo-applicant').value='';render();draw();$('photo-workspace').hidden=false;status('照片已在本機載入。可框選姓名或課務表後辨識。');}catch(error){status(error.message||'無法讀取照片。');}finally{URL.revokeObjectURL(url);}
  });
  const point=event=>{const rect=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(canvas.width,(event.clientX-rect.left)*canvas.width/rect.width)),y:Math.max(0,Math.min(canvas.height,(event.clientY-rect.top)*canvas.height/rect.height))};};
  canvas.addEventListener('pointerdown',event=>{if(!image||working)return;anchor=point(event);canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!anchor)return;const p=point(event);region={x:Math.min(p.x,anchor.x),y:Math.min(p.y,anchor.y),w:Math.abs(p.x-anchor.x),h:Math.abs(p.y-anchor.y)};draw();});
  canvas.addEventListener('pointerup',()=>{anchor=null;if(region&&(region.w<20||region.h<20))region=null;draw();});
  canvas.addEventListener('pointercancel',()=>{anchor=null;});
  $('photo-rotate').addEventListener('click',()=>{if(working)return;rotation=(rotation+90)%360;region=null;draw();});
  $('photo-reset-crop').addEventListener('click',()=>{if(working)return;region=null;draw();});
  $('photo-clear').addEventListener('click',clean);
  async function loadOCR(){if(window.Tesseract)return;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='js/vendor/tesseract/tesseract.min.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('辨識程式載入失敗，請確認網路後重試。'));};document.head.append(script);});}
  $('photo-recognize').addEventListener('click',async()=>{
    if(!allowed()||!image||working)return;working=true;$('photo-recognize').disabled=true;const token=generation;
    let localWorker=null;
    try{
      status('載入本機辨識程式及繁體中文語言檔，首次使用可能需要一段時間…');await loadOCR();if(token!==generation)return;
      localWorker=await Tesseract.createWorker(['chi_tra','eng'],1,{workerPath:new URL('js/vendor/tesseract/worker.min.js',document.baseURI).href,corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',langPath:'https://tessdata.projectnaptha.com/4.0.0',workerBlobURL:false,logger:progress=>{if(token===generation)status(`本機辨識：${progress.status} ${Math.round((progress.progress||0)*100)}%`);}});
      if(token!==generation)return;worker=localWorker;
      const crop=region||{x:0,y:0,w:canvas.width,h:canvas.height},input=document.createElement('canvas');input.width=Math.round(crop.w);input.height=Math.round(crop.h);
      // Redraw without the orange selection border before passing local pixels to OCR.
      const saved=region;region=null;draw();input.getContext('2d').drawImage(canvas,crop.x,crop.y,crop.w,crop.h,0,0,input.width,input.height);region=saved;draw();
      const result=await localWorker.recognize(input);if(token!==generation)return;
      $('photo-text').value=[$('photo-text').value,result.data.text].filter(Boolean).join('\n').slice(0,30000);
      status(`已完成本機辨識（引擎信心值 ${Math.round(result.data.confidence||0)}%，不代表手寫欄位正確）。請先修正文字，再整理成待核對課務。`);
    }catch(error){if(token===generation)status(`辨識未完成：${error.message}。可改用下方手動新增待核對課務。`);}finally{if(localWorker)await localWorker.terminate().catch(()=>{});if(worker===localWorker)worker=null;if(token===generation){working=false;$('photo-recognize').disabled=false;}}
  });
  $('photo-parse').addEventListener('click',()=>{if(!allowed())return;if(rows.length&&!confirm('重新整理文字會取代目前待核對資料，是否繼續？'))return;const result=parse($('photo-text').value);rows=result.rows;if(result.applicant)$('photo-applicant').value=result.applicant;render();status(rows.length?`已整理${rows.length}筆待核對課務，尚未送出。`:'未能可靠地拆出課務，請修正文字或手動新增；不會猜測姓名、班級或日期。');});
  $('photo-add-row').addEventListener('click',()=>{if(!allowed())return;rows.push(emptyRow());render();});
  $('photo-review').addEventListener('input',event=>{const field=event.target.dataset.photoField,index=Number(event.target.dataset.index);if(field&&rows[index]){rows[index][field]=event.target.value;rows[index].applied=false;}});
  $('photo-review').addEventListener('click',event=>{
    const remove=event.target.closest('[data-photo-remove]');if(remove){rows.splice(Number(remove.dataset.photoRemove),1);render();return;}
    const apply=event.target.closest('[data-photo-apply]');if(!apply||!allowed())return;const index=Number(apply.dataset.photoApply),r=rows[index];
    try{const teacher=$('photo-applicant').value.trim();window.TEACHING_IMPORT_PHOTO({...r,teacher});r.applied=true;imported={row:r,teacher};render();status(`第${index+1}筆已帶入下方表單，請最後核對後按「送出至公開課表」。`);}catch(error){status(error.message);}
  });
  window.addEventListener('teaching-published',event=>{if(!imported||!rows.includes(imported.row))return;const r=imported.row,s=event.detail;if(s.kind===r.kind&&s.a.teacher===imported.teacher&&s.a.date===r.date&&s.a.row===Number(r.row)&&s.a.classId===r.classId&&s.b?.teacher===r.partner&&(r.kind==='sub'||(s.b.date===r.otherDate&&s.b.row===Number(r.otherRow)))){r.published=true;render();status('已核對的這筆課務已送出；其餘待核對資料尚未送出。');imported=null;}});
  window.addEventListener('authorization-changed',()=>{if(!allowed())clean();});
  window.PHOTO_IMPORT={parse};
})();
