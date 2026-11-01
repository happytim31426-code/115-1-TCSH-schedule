import {attachPayrollStats,clearPayrollStats} from './payroll-stats.js?v=20261101a';
// No upload endpoints, storage APIs, analytics or public timetable mutations.
const $=id=>document.getElementById(id);
const allowed=()=>window.AUTH_MEMBER?.role==='admin';
const active=()=>allowed()&&document.body.dataset.workspace==='office'&&document.body.dataset.officeFeature==='payroll';
let libraryPromise=null,sequence=0,renderSequence=0,loading=null,pdf=null,renderTask=null,pageNumber=1,busy=false;
const assets=new URL('./vendor/pdfjs/',import.meta.url);
async function library(){
  if(!libraryPromise)libraryPromise=import(new URL('pdf.mjs',assets).href).then(lib=>{lib.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.mjs',assets).href;return lib;}).catch(error=>{libraryPromise=null;throw error;});
  return libraryPromise;
}
function controls(){
  $('payroll-pdf').disabled=!active()||busy;
  $('payroll-clear').disabled=!allowed()||(!pdf&&!loading&&!busy);
  $('payroll-prev').disabled=!active()||busy||!pdf||pageNumber<=1;
  $('payroll-next').disabled=!active()||busy||!pdf||pageNumber>=pdf.numPages;
  $('payroll-page').disabled=!active()||busy||!pdf;
}
function dispose(doc){try{const task=doc?.loadingTask||doc;if(task?.destroy)Promise.resolve(task.destroy()).catch(()=>{});}catch{/* Cleanup must never prevent the private UI from being cleared. */}}
function clear(message='尚未選擇檔案。檔案只會在本頁本機預覽，不會上傳。'){
  clearPayrollStats();
  sequence++;renderSequence++;renderTask?.cancel();renderTask=null;
  const task=loading;loading=null;dispose(task);const old=pdf;pdf=null;dispose(old);
  busy=false;pageNumber=1;$('payroll-pdf').value='';$('payroll-page').value='1';
  $('payroll-file-meta').replaceChildren();$('payroll-file-meta').hidden=true;$('payroll-preview').hidden=true;
  const canvas=$('payroll-canvas');canvas.width=0;canvas.height=0;
  $('payroll-page-count').textContent='';$('payroll-render-status').textContent='';$('payroll-upload-status').textContent=message;controls();
}
function metadata(file,count,hash){
  const list=$('payroll-file-meta');list.replaceChildren();
  for(const [label,value]of [['檔名',file.name],['檔案大小',`${(file.size/1024/1024).toFixed(2)} MB`],['頁數',String(count)],['檔案指紋 SHA-256',hash||'此瀏覽器未提供指紋功能'],['狀態','已載入本機預覽；尚未辨識、未核對、未登錄鐘點資料']]){const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=value;list.append(term,description);}
  list.hidden=false;
}
async function showPage(number){
  if(!active()||!pdf)return;
  if(!Number.isInteger(number)||number<1||number>pdf.numPages){$('payroll-page').value=String(pageNumber);$('payroll-render-status').textContent='請輸入範圍內的整數頁碼。';return;}
  const ticket=++renderSequence,doc=pdf,previous=renderTask;renderTask=null;
  previous?.cancel();if(previous)await previous.promise.catch(()=>{});
  if(!active()||ticket!==renderSequence||doc!==pdf)return;
  pageNumber=number;$('payroll-page').value=String(number);$('payroll-render-status').textContent=`正在繪製第${number}頁…`;controls();
  try{
    const page=await doc.getPage(number);if(!active()||ticket!==renderSequence||doc!==pdf)return;
    const base=page.getViewport({scale:1}),width=Math.min(1100,Math.max(280,$('payroll-preview').clientWidth-16));
    const viewport=page.getViewport({scale:Math.min(1.8,width/base.width)}),canvas=$('payroll-canvas');
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;
    if(active()&&ticket===renderSequence&&doc===pdf)$('payroll-render-status').textContent=`第${number}／${doc.numPages}頁（僅本機預覽）`;
  }catch(error){if(active()&&ticket===renderSequence&&error.name!=='RenderingCancelledException')$('payroll-render-status').textContent='此頁無法繪製，請換頁或重新選取檔案；未產生任何鐘點計算。';}
  finally{if(ticket===renderSequence)renderTask=null;}
}
$('payroll-pdf').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file||!active()){event.target.value='';return;}
  const token=++sequence;busy=true;controls();$('payroll-upload-status').textContent='正在本機檢查 PDF…不會上傳檔案。';
  let task=null,candidate=null;
  try{
    if(!/\.pdf$/i.test(file.name)||file.size===0||file.size>30*1024*1024)throw Error('請選擇非空白且小於等於30MB的PDF檔案。');
    const header=new TextDecoder('latin1').decode(await file.slice(0,1024).arrayBuffer());
    if(!header.includes('%PDF-'))throw Error('檔案內容不是PDF，不能只更改副檔名。');
    const bytes=await file.arrayBuffer();if(!active()||token!==sequence)return;
    const hash=crypto.subtle?[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join(''):'';
    const lib=await library();if(!active()||token!==sequence)return;
    task=lib.getDocument({data:new Uint8Array(bytes),cMapUrl:new URL('cmaps/',assets).href,cMapPacked:true,standardFontDataUrl:new URL('standard_fonts/',assets).href,wasmUrl:new URL('wasm/',assets).href,isEvalSupported:false,enableXfa:false,useSystemFonts:true,maxImageSize:16000000});
    loading=task;task.onPassword=()=>{if(token===sequence&&active())$('payroll-upload-status').textContent='此PDF需要密碼，請改用未加密的行政課表檔；沒有上傳檔案。';dispose(task);};
    candidate=await task.promise;
    if(!active()||token!==sequence){dispose(candidate);return;}
    if(candidate.numPages<1||candidate.numPages>300)throw Error('只接受1～300頁的PDF。');
    renderSequence++;renderTask?.cancel();if(renderTask)await renderTask.promise.catch(()=>{});renderTask=null;
    if(!active()||token!==sequence){dispose(candidate);return;}
    clearPayrollStats();dispose(pdf);pdf=candidate;candidate=null;loading=null;pageNumber=1;
    metadata(file,pdf.numPages,hash);$('payroll-page').max=String(pdf.numPages);$('payroll-page-count').textContent=`／${pdf.numPages}頁`;$('payroll-preview').hidden=false;
    $('payroll-upload-status').textContent='已載入本機預覽。尚未辨識黑點／實／基，也沒有儲存或更新核發鐘點。';
    busy=false;controls();await showPage(1);
    if(active()&&token===sequence)attachPayrollStats(pdf,async number=>{await showPage(number);$('payroll-preview').scrollIntoView({block:'start'});});
  }catch(error){dispose(candidate);if(task&&task!==pdf)dispose(task);if(active()&&token===sequence)$('payroll-upload-status').textContent=`新檔未採用：${error.name==='PasswordException'?'PDF需要密碼。':error.message||'PDF無法讀取。'}${pdf?' 原先載入的檔案保留。':''}沒有上傳檔案。`;}
  finally{if(token===sequence){loading=null;busy=false;event.target.value='';controls();}}
});
$('payroll-clear').addEventListener('click',()=>{if(allowed())clear();});
$('payroll-prev').addEventListener('click',()=>showPage(pageNumber-1));$('payroll-next').addEventListener('click',()=>showPage(pageNumber+1));
$('payroll-page').addEventListener('change',()=>showPage(Number($('payroll-page').value)));
window.addEventListener('authorization-changed',()=>clear(allowed()?'尚未選擇檔案。僅供管理員於本機行政作業。':'檔案與預覽已清除，僅管理員可使用。'));
window.addEventListener('workspace-changed',()=>{if(!active())clear();else controls();});
window.addEventListener('pagehide',()=>clear());
controls();
