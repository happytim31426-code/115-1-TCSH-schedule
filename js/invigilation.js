(() => {
  'use strict';
  const $=id=>document.getElementById(id),W=window.WEEKLY,E=W.esc,D=window.SCHEDULE_DATA;
  // Literal PDF row order, not derived from the ordinary timetable's roster.
  const roster=`101 張善治|102 莊淑珺|103 顏雨詩|104 莊仁傑|106 張瀛鐸|110 林詩怡|111 鄭沛文|113 黃育樺|125 陳平瑋|126 李曉蘭|129 周成蓉|130 林旻璇|131 潘宜潔|132 蘇治維|201 Chris|202 寧凱婕|204 許蘭馨|205 曾郁佳|207 郭修佑|209 陳立祺|210 黃琮瑄|212 蔡維佳|213 蔡宜珊|214 黃喩苹|215 翟垣皓|216 蔡錦鳳|223 Aydar|230 翁子喬|231 盧鈺縈|232 簡丞楨|302 蔡文隆|303 陳文婷|304 吳念祖|305 王斐亭|306 林書淵|307 吳威德|309 陳泓緻|312 陳怡婷|313 王婉真|314 王聖賢|315 王美雅|316 張齡之|318 歐宗頴|319 郭盈瑜|401 呂金玲|402 陳柏伶|403 李嘉祥|404 林季英|405 許文婕|407 游棋竹|408 賈旻曄|409 林昱汝|410 劉姿伶|411 吳宗原|412 謝岱霖|414 周怡君|422 盧佩君|426 黃逸寧|427 李榮洲|501 吳淑敏|502 余志誠|503 林怡君|504 林家琪|505 張宏州|506 黃瀞瑩|507 王威程|508 鄭博仁|510 宋佩盈|511 韋尚賢|512 黃丞皞|517 陳冠廷|523 林宏鋕|524 王湘屏|603 賴碩伶|604 簡志雄|607 黃秀玲|608 楊淑青|609 林承勳|610 吳巧伶|611 張育綺|614 陳泰璋|617 薛靜儀|620 李柏毅|625 洪嘉穗|632 吳秋宏|634 鄭莞柔|637 楊芳玲|638 黃荷雯|640 張簡景鈴|641 賴昀締|642 黃逸欣|643 胡鳳玲|645 周淑娟|646 洪婉晴|647 楊順宇|648 許家銘|649 陳奕霖`.split('|').map(v=>{const [id,name]=v.split(' ');return {id,name,original:D.teachers.find(t=>t.id===id)};});
  const times=window.EXAM_PROGRAM_MODEL.times;
  const rooms=D.classes.filter(c=>/^[JS][123]0[1-8]$/.test(c.publicCode)).map(c=>({...c,code:`${c.publicCode[0]==='J'?1:2}${c.publicCode[1]}${Number(c.publicCode.slice(2))}`}));
  const roomMap=new Map(rooms.map(c=>[c.code,c])),teacherMap=new Map(roster.map(t=>[t.id,t]));
  const allowed=()=>['admin','exam'].includes(window.AUTH_MEMBER?.role),clone=v=>JSON.parse(JSON.stringify(v));
  let drafts=new Map(),importGeneration=0;
  const category=()=>window.EXAM_CONTEXT.get().category;
  function source(){
    const settings=window.EXAM_CONTEXT.saved(),cat=category();
    const junior=window.EXAM_PROGRAM_SAVED(cat,'junior',1),senior=window.EXAM_PROGRAM_SAVED(cat,'senior',1);
    const date=settings?.dates?.[0]||'';
    return {category:cat,date,junior,senior,ready:W.inTerm(date)&&!!junior&&!!senior,
      signature:JSON.stringify([cat,date,settings?.revision||0,junior?.revision||0,senior?.revision||0])};
  }
  function blank(s){return {source:s.signature,assignments:Object.fromEntries(roster.map(t=>[t.id,Array(5).fill('')])),constraints:Object.fromEntries(roster.map(t=>[t.id,{duty:['214','511'].includes(t.id),blocked:Array(5).fill(false),children:[]}])),reviewed:false};}
  const state=()=>{const cat=category();if(!drafts.has(cat))drafts.set(cat,blank(source()));return drafts.get(cat);};
  function info(s,room,period){
    if(!room)return null;
    const grade=room.publicCode[0]==='J'?`J${room.publicCode[1]}`:`S${room.publicCode[1]}${room.publicCode[1]==='1'?(Number(room.publicCode.slice(2))<=3?'A':'B'):(Number(room.publicCode.slice(2))<=3?'S':'N')}`;
    return (room.publicCode[0]==='J'?s.junior:s.senior)?.cells.find(c=>c.grade===grade&&c.period===period+1)||null;
  }
  function family(subject){
    const value=String(subject||'').replace(/[\s()（）-]/g,'');
    const groups=[['國文',/國文|國語文|寫作測驗/],['英文',/英文|英語|英會/],['數學',/數學/],['公民',/公民/],['歷史',/歷史/],['地理',/地理/],['地科',/地科|地球科學/],['理化',/理化/],['生物',/生物/],['物理',/物理/],['化學',/化學/]];
    return groups.find(([,pattern])=>pattern.test(value))?.[0]||value;
  }
  function taught(t,room,subject=null){return (t.original?.sessions||[]).some(c=>(c.classId===room.id||c.className===room.name)&&(!subject||family(c.subject)===family(subject)));}
  function reasons(d,s,id,period,code,{duplicate=true}={}){
    if(!code)return [];
    const room=roomMap.get(code),teacher=teacherMap.get(id),config=d.constraints[id],errors=[];
    if(!room||!teacher||!config)return ['班級碼或教師不存在'];
    if(!s.ready)return ['請先儲存第一天日期與國高中考試日程'];
    if(config.duty)errors.push('試務工作人員不排監考');
    if(config.blocked[period])errors.push('該教師此節不得監考（命題巡堂／請假／招生等）');
    if(config.children.includes(code))errors.push('不可監考子女就讀班級');
    const exam=info(s,room,period),homeroom=room.homeroomTeacher===teacher.original?.name||room.homeroomTeacher===teacher.name;
    if(!exam?.subject)errors.push('該班此節考科尚未設定');
    else if(exam.subject.trim()!=='自習'){
      if(homeroom)errors.push('正式考試不得監考自己的導師班');
      if(taught(teacher,room,exam.subject))errors.push('該科任課教師不得監考自己的任教班');
    }
    if(duplicate&&roster.some(t=>t.id!==id&&d.assignments[t.id][period]===code))errors.push('此班此節已安排其他教師');
    return errors;
  }
  const minutes=(d,id)=>d.assignments[id].reduce((sum,code,i)=>sum+(code?times[i][2]:0),0);
  function report(d,s){
    const missing=Array.from({length:5},()=>[]),errors=[],warnings=[];
    if(!s.ready)errors.push('第一天日期及國高中日程須先儲存完成。');
    if(d.source!==s.signature)errors.push('日程來源已變更，請套用最新已儲存日程並重新檢查。');
    if(!d.reviewed)errors.push('尚未勾選人工核對監考限制。');
    for(let p=0;p<5;p++){
      for(const room of rooms){const assigned=roster.filter(t=>d.assignments[t.id][p]===room.code);if(!assigned.length)missing[p].push(room.code);if(assigned.length>1)errors.push(`第${p+1}節 ${room.code} 重複安排。`);if(!info(s,room,p)?.subject)errors.push(`第${p+1}節 ${room.code} 未設定考科。`);}
      for(const t of roster){const code=d.assignments[t.id][p];if(!code)continue;
        for(const reason of reasons(d,s,t.id,p,code,{duplicate:false}))errors.push(`${t.id} ${t.name} 第${p+1}節 ${code}：${reason}`);
        if(info(s,roomMap.get(code),p)?.subject==='自習'&&!taught(t,roomMap.get(code))&&roomMap.get(code).homeroomTeacher!==t.original?.name)warnings.push(`${t.name} 第${p+1}節 ${code} 自習：建議優先安排該班導師／任課教師。`);
      }
    }
    return {missing,errors,warnings,complete:s.ready&&d.source===s.signature&&!missing.some(x=>x.length)&&!errors.length};
  }
  function validateBackup(p){
    if(!p||p.format!=='tcsh-invigilation-day1-v1'||p.category!==category()||typeof p.source!=='string'||!p.assignments||!p.constraints)throw Error('不是目前考查類別的第一天試排備份。');
    for(const obj of [p.assignments,p.constraints])if(Object.keys(obj).length!==roster.length||Object.keys(obj).some(id=>!teacherMap.has(id)))throw Error('備份的教師名單與原檔不一致。');
    for(const t of roster){const a=p.assignments[t.id],c=p.constraints[t.id];
      if(!Array.isArray(a)||a.length!==5||a.some(code=>typeof code!=='string'||(code&&!roomMap.has(code))))throw Error('班級碼或節次格式不符。');
      if(!c||Object.keys(c).sort().join(',')!=='blocked,children,duty'||typeof c.duty!=='boolean'||!Array.isArray(c.blocked)||c.blocked.length!==5||c.blocked.some(x=>typeof x!=='boolean')||!Array.isArray(c.children)||c.children.length>rooms.length||c.children.some(code=>!roomMap.has(code)))throw Error('教師限制格式不符。');
    }
    for(let i=0;i<5;i++){const codes=roster.map(t=>p.assignments[t.id][i]).filter(Boolean);if(new Set(codes).size!==codes.length)throw Error('備份中有同節重複班級，請先修正來源。');}
    return {source:p.source,assignments:clone(p.assignments),constraints:clone(p.constraints),reviewed:false};
  }
  window.INVIGILATION_MODEL={roster,rooms,info,family,taught,reasons,minutes,report,blank,validateBackup};
  function headerHtml(s){
    const labels={S3S:'高三（知～善）',S3N:'高三（包～和）',S2S:'高二（知～善）',S2N:'高二（包～和）',S1A:'高一（知～善）',S1B:'高一（包～和）'};
    const grades=[...window.EXAM_PROGRAM_MODEL.divisions.senior.grades.map(([id,label])=>['senior',[id,labels[id]||label]]),...window.EXAM_PROGRAM_MODEL.divisions.junior.grades.map(g=>['junior',g])];
    return `<thead><tr><th colspan="2">節數／時間</th>${times.map((t,i)=>`<th scope="col">第${'一二三四五'[i]}節<br><small>${t[0]}～${t[1]}</small></th>`).join('')}<th scope="col">本日累計<br>分鐘</th></tr><tr class="inv-duration"><th colspan="2">完整節長（分鐘）</th>${times.map(t=>`<th>${t[2]}</th>`).join('')}<th>350</th></tr>${grades.map(([division,[grade,label]])=>`<tr class="inv-grade-row ${division}"><th colspan="2">${E(label)}</th>${Array.from({length:5},(_,i)=>{const c=s[division]?.cells.find(c=>c.grade===grade&&c.period===i+1);return `<td>${E(c?.subject||'未設定')}<small>${c?.subject?`施測 ${c.minutes} 分鐘`:''}</small></td>`;}).join('')}<td></td></tr>`).join('')}<tr><th scope="col">編號</th><th scope="col">教師姓名</th>${times.map((_,i)=>`<th scope="col">第${'一二三四五'[i]}節班級</th>`).join('')}<th scope="col">分鐘</th></tr></thead>`;
  }
  function render(){
    if(!allowed())return;
    const s=source(),d=state();
    if(s.ready&&d.source!==s.signature&&!roster.some(t=>d.assignments[t.id].some(Boolean))){d.source=s.signature;d.reviewed=false;}
    $('inv-title').textContent=`${window.EXAM_CONTEXT.get().label}｜第一天${s.date?` ${W.formatDate(s.date)}`:''}監考編排表`;
    $('inv-grid').innerHTML=`<table class="inv-table"><caption class="sr-only">第一天考試日程與教師監考編排</caption><colgroup><col class="inv-col-id"><col class="inv-col-name">${'<col>'.repeat(5)}<col class="inv-col-minutes"></colgroup>${headerHtml(s)}<tbody>${roster.map(t=>`<tr data-inv-row="${t.id}"><th scope="row">${t.id}</th><th scope="row">${E(t.name)}</th>${Array.from({length:5},(_,i)=>`<td><input type="text" inputmode="numeric" maxlength="3" list="inv-class-options" autocomplete="off" data-inv-teacher="${t.id}" data-inv-period="${i}" aria-label="${E(t.name)}第一天第${i+1}節班級"><small data-inv-cell-note></small></td>`).join('')}<td data-inv-minutes></td></tr>`).join('')}</tbody></table>`;
    $('inv-constraints').innerHTML=`<table class="inv-config-table"><thead><tr><th>編號／教師</th><th>試務<br>不排監考</th><th>本日不得監考節次</th><th>子女班級碼（多班用逗號）</th></tr></thead><tbody>${roster.map(t=>`<tr data-inv-config="${t.id}"><th>${t.id} ${E(t.name)}</th><td><input type="checkbox" data-inv-duty aria-label="${E(t.name)}為試務人員" ${d.constraints[t.id].duty?'checked':''}></td><td>${Array.from({length:5},(_,i)=>`<label><input type="checkbox" data-inv-block="${i}" aria-label="${E(t.name)}第${i+1}節不得監考" ${d.constraints[t.id].blocked[i]?'checked':''}>${i+1}</label>`).join('')}</td><td><input type="text" data-inv-children aria-label="${E(t.name)}子女班級碼" value="${E(d.constraints[t.id].children.join(','))}" placeholder="例如111,236"></td></tr>`).join('')}</tbody></table>`;
    refresh();
  }
  function refresh(){
    if(!allowed())return;
    const d=state(),s=source(),r=report(d,s);
    $('inv-source-status').textContent=!s.ready?'請先儲存第一天日期、國中及高中第一天日程，尚不能排班。':d.source!==s.signature?'已儲存日程已變更。現有試排保留，請按「套用最新已儲存日程並重檢」。':`日程來源：${s.date}｜國中版次${s.junior.revision}／高中版次${s.senior.revision}｜${rooms.length}個一般班級，每節各須一位教師。`;
    $('inv-reviewed').checked=d.reviewed;
    $('inv-coverage').innerHTML=r.missing.map((codes,i)=>`<details class="${codes.length?'inv-incomplete':'inv-complete'}"><summary>第${i+1}節 ${rooms.length-codes.length}／${rooms.length} 班${codes.length?`・缺 ${codes.length}`:'・已齊'}</summary><p>${codes.map(c=>`${c} ${E(roomMap.get(c).name)}`).join('、')||'全部班級已安排'}</p></details>`).join('');
    for(const t of roster){const tr=$('inv-grid').querySelector(`[data-inv-row="${t.id}"]`);if(!tr)continue;
      tr.querySelector('[data-inv-minutes]').textContent=minutes(d,t.id);
      for(const input of tr.querySelectorAll('[data-inv-period]')){
        const p=Number(input.dataset.invPeriod),code=d.assignments[t.id][p],errors=reasons(d,s,t.id,p,code);
        input.value=code;input.disabled=!s.ready;input.setAttribute('aria-invalid',String(!!errors.length));input.title=errors.join('；');
        const note=input.parentElement.querySelector('[data-inv-cell-note]');
        note.textContent=errors.length?errors.join('；'):code?`${roomMap.get(code).name}・${info(s,roomMap.get(code),p)?.subject||'未設定'}`:'';
        input.parentElement.classList.toggle('inv-invalid',!!errors.length);
      }
    }
    $('inv-check').disabled=!s.ready;$('inv-rebase').disabled=!s.ready;
    $('inv-minute-totals').innerHTML=`<table><caption>${E(window.EXAM_CONTEXT.get().label)}第一天試排分鐘（本機、未上傳）</caption><thead><tr><th>教師編號</th><th>教師姓名</th><th>第一天已排分鐘</th><th>正式監考係數</th></tr></thead><tbody>${roster.map(t=>`<tr><td>${t.id}</td><th>${E(t.name)}</th><td>${minutes(d,t.id)}</td><td>待規則確認</td></tr>`).join('')}</tbody></table>`;
  }
  $('inv-grid').addEventListener('focusin',event=>{
    const input=event.target.closest('[data-inv-period]');if(!input||!allowed())return;
    const id=input.dataset.invTeacher,p=Number(input.dataset.invPeriod),d=state(),s=source();
    $('inv-class-options').innerHTML=rooms.filter(c=>!reasons(d,s,id,p,c.code).length).map(c=>`<option value="${c.code}">${E(c.name)}・${E(info(s,c,p)?.subject||'')}</option>`).join('');
  });
  $('inv-grid').addEventListener('change',event=>{
    const input=event.target.closest('[data-inv-period]');if(!input||!allowed())return;
    const id=input.dataset.invTeacher,p=Number(input.dataset.invPeriod),code=input.value.trim(),d=state(),errors=reasons(d,source(),id,p,code);
    if(errors.length){$('inv-message').textContent=`未安排：${errors.join('；')}。`;input.value=d.assignments[id][p];return;}
    d.assignments[id][p]=code;$('inv-message').textContent=code?`已試排 ${id} ${teacherMap.get(id).name} 第${p+1}節 ${code}，累計${minutes(d,id)}分鐘（未上傳）。`:'已移除該格試排。';refresh();
  });
  $('inv-constraints').addEventListener('change',event=>{
    const tr=event.target.closest('[data-inv-config]');if(!tr||!allowed())return;
    const d=state(),id=tr.dataset.invConfig,c=d.constraints[id],input=event.target;
    if(input.hasAttribute('data-inv-duty'))c.duty=input.checked;
    if(input.hasAttribute('data-inv-block'))c.blocked[Number(input.dataset.invBlock)]=input.checked;
    if(input.hasAttribute('data-inv-children')){
      const codes=[...new Set(input.value.trim().split(/[,，\s]+/).filter(Boolean))];
      if(codes.some(code=>!roomMap.has(code))){$('inv-message').textContent='子女班級碼無效，請填本校一般班級三碼，例如111。';input.value=c.children.join(',');return;}
      c.children=codes;
    }
    d.reviewed=false;$('inv-message').textContent='限制已更新；已排內容保留，衝突以框線提示，請修正後重新檢查。';refresh();
  });
  $('inv-reviewed').addEventListener('change',()=>{if(allowed()){state().reviewed=$('inv-reviewed').checked;refresh();}});
  $('inv-rebase').addEventListener('click',()=>{if(!allowed()||!source().ready)return;state().source=source().signature;state().reviewed=false;render();$('inv-message').textContent='已套用已儲存日程；現有排班保留，請檢查衝突並重新人工核對。';});
  $('inv-check').addEventListener('click',()=>{if(!allowed())return;const r=report(state(),source()),missing=r.missing.reduce((n,a)=>n+a.length,0);$('inv-message').textContent=r.complete?`一般班級排班檢查通過。${r.warnings.length?`另有${r.warnings.length}筆自習優先安排提示：${r.warnings.slice(0,5).join('；')}`:''} 此為本機試排，尚未上傳或發布。`:`尚未完成：缺${missing}個班級節次；${r.errors.slice(0,6).join('；')}${r.errors.length>6?`（共${r.errors.length}項）`:''}`;});
  $('inv-export').addEventListener('click',()=>{
    if(!allowed())return;const s=source(),d=state(),r=report(d,s),value={format:'tcsh-invigilation-day1-v1',category:category(),day:1,date:s.date,...clone(d),complete:r.complete,exportedAt:new Date().toISOString()};
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${category()}-第一天監考試排.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    $('inv-message').textContent='已產生本機備份（含教師限制與子女班級碼，請妥善保管）。未上傳雲端。';
  });
  $('inv-import').addEventListener('change',async event=>{
    const file=event.target.files[0],generation=++importGeneration,cat=category();if(!file||!allowed())return;
    try{if(file.size>300000)throw Error('備份檔過大。');const raw=JSON.parse(await file.text());if(!allowed()||generation!==importGeneration||category()!==cat)return;
      const next=validateBackup(raw);if(!confirm('還原會取代目前這次考查的第一天本機試排，確定？'))return;
      drafts.set(cat,next);render();$('inv-message').textContent='已還原備份；請核對日程來源及教師限制，再檢查完整排班。';
    }catch(e){if(allowed())$('inv-message').textContent=`未還原：${e.message}`;}finally{event.target.value='';}
  });
  for(const name of ['exam-context-changed','cloud-exam-programs','exam-program-sync-error','exam-program-sync-loading','exam-sync-loading','exam-sync-error'])window.addEventListener(name,()=>{if(allowed())render();});
  window.addEventListener('exam-tab-changed',event=>{if(allowed()&&['day1','coefficient'].includes(event.detail))render();});
  window.addEventListener('authorization-changed',()=>{
    if(!allowed()){drafts.clear();importGeneration++;for(const id of ['inv-grid','inv-constraints','inv-minute-totals','inv-coverage','inv-class-options'])$(id).replaceChildren();$('inv-message').textContent='';$('inv-source-status').textContent='';$('inv-import').value='';$('inv-reviewed').checked=false;}
    else render();
  });
})();
