import {attachPayrollStats,clearPayrollStats,restorePayrollStats} from './payroll-stats.js?v=20261101d';
import {payrollStore} from './payroll-store.js';
const $=id=>document.getElementById(id),allowed=()=>window.AUTH_MEMBER?.role==='admin';
const active=()=>allowed()&&document.body.dataset.workspace==='office'&&document.body.dataset.officeFeature==='payroll';
const assets=new URL('./vendor/pdfjs/',import.meta.url);
let libraryPromise,sequence=0,pdf=null,loading=null,record=null,busy=false,writeQueue=Promise.resolve();
function library(){return libraryPromise||(libraryPromise=import(new URL('pdf.mjs',assets).href).then(lib=>{lib.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.mjs',assets).href;return lib;}).catch(e=>{libraryPromise=null;throw e;}));}
function dispose(doc){try{Promise.resolve((doc?.loadingTask||doc)?.destroy?.()).catch(()=>{});}catch{}}
function controls(){$('payroll-pdf').disabled=!active()||busy;$('payroll-clear').disabled=!active()||busy;}
function status(text){if(active())$('payroll-upload-status').textContent=text;}
function clearMemory(){sequence++;dispose(loading);dispose(pdf);loading=null;pdf=null;record=null;busy=false;clearPayrollStats();$('payroll-file-meta').hidden=true;$('payroll-file-meta').replaceChildren();$('payroll-preview').hidden=true;$('payroll-pdf').value='';controls();}
function metadata(){const list=$('payroll-file-meta');list.replaceChildren();for(const [label,value]of [['最新版檔名',record.name],['留存時間',new Date(record.updatedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})],['頁數',String(pdf.numPages)],['儲存位置','僅此瀏覽器 IndexedDB；不公開、不上傳']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;list.append(dt,dd);}list.hidden=false;}
function enqueue(operation,value){const job=writeQueue.catch(()=>{}).then(()=>payrollStore(operation,value));writeQueue=job;return job;}
async function load(value,token){
  const lib=await library(),bytes=await value.blob.arrayBuffer();if(!active()||token!==sequence)return false;
  const task=lib.getDocument({data:new Uint8Array(bytes),cMapUrl:new URL('cmaps/',assets).href,cMapPacked:true,standardFontDataUrl:new URL('standard_fonts/',assets).href,wasmUrl:new URL('wasm/',assets).href,isEvalSupported:false,enableXfa:false,useSystemFonts:true,maxImageSize:16000000});loading=task;
  task.onPassword=()=>dispose(task);let candidate;
  try{candidate=await task.promise;if(!active()||token!==sequence){dispose(candidate);return false;}if(candidate.numPages<1||candidate.numPages>300)throw Error('只接受1～300頁的PDF。');}
  catch(e){dispose(task);throw e;}
  dispose(pdf);pdf=candidate;loading=null;record=value;metadata();$('payroll-preview').hidden=true;
  attachPayrollStats(pdf,null);if(value.snapshot?.processingComplete)restorePayrollStats(value.snapshot);return true;
}
async function restore(){if(!active()||pdf||busy)return;busy=true;controls();const token=++sequence;status('正在讀取此瀏覽器留存的最新版…');
  try{await writeQueue.catch(()=>{});const saved=await payrollStore('get');if(!active()||token!==sequence)return;if(saved?.blob){await load(saved,token);status('已讀取本機最新版；不必重傳。統計僅供行政核對。');if(!saved.snapshot?.processingComplete)$('payroll-analyze').click();}else status('尚無本機留存檔案，請首次選擇超鐘點PDF。');}
  catch(e){if(token===sequence)status(`無法讀取本機留存：${e.message}。請重新選檔或確認瀏覽器允許儲存。`);}finally{if(token===sequence){busy=false;controls();}}
}
$('payroll-pdf').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file||!active())return;const token=++sequence;busy=true;controls();status('正在本機檢查新版PDF…');
  try{if(!/\.pdf$/i.test(file.name)||!file.size||file.size>30*1024*1024)throw Error('請選擇非空白、30MB以內的PDF。');if(!new TextDecoder('latin1').decode(await file.slice(0,1024).arrayBuffer()).includes('%PDF-'))throw Error('檔案內容不是PDF。');
    const value={format:2,name:file.name,updatedAt:new Date().toISOString(),blob:file,snapshot:null};
    if(!await load(value,token))return;
    await enqueue('put',value);if(token===sequence){status('最新版已留存在此瀏覽器，開始辨識。');$('payroll-analyze').click();}
  }catch(e){if(token===sequence)status(`新版未能完成留存：${e.message}。未成功儲存時，下次可能仍載入舊版。`);}
  finally{if(token===sequence){busy=false;event.target.value='';controls();}}
});
window.addEventListener('payroll-data',event=>{if(!active()||!record)return;record={...record,snapshot:event.detail};const token=sequence;enqueue('snapshot',record).then(()=>{if(token===sequence)status('最新版課表與統計修正已留存在此瀏覽器。');}).catch(e=>{if(token===sequence)status(`統計尚未留存：${e.message}。請下載備份。`);});});
$('payroll-clear').addEventListener('click',async()=>{if(!active()||!confirm('刪除此瀏覽器留存的超鐘PDF、統計修正及停課設定？刪除後須重新匯入。'))return;busy=true;controls();try{await enqueue('delete');await window.PAYROLL_WEEKLY_CLEAR?.();clearMemory();status('已刪除此瀏覽器留存資料；原始PDF不受影響。');}catch(e){busy=false;controls();status(`刪除失敗：${e.message}`);}});
window.addEventListener('authorization-changed',()=>{clearMemory();if(active())restore();});
window.addEventListener('workspace-changed',()=>{if(!active())clearMemory();else restore();});
window.addEventListener('pagehide',clearMemory);
controls();
