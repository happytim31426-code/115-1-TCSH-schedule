(() => {
  const W=window.WEEKLY,$=id=>document.getElementById(id),E=W.esc;
  const directors=['張齡之','游棋竹','林昱汝','薛靜儀','林曉瑩','陳雲亮','陳柏伶','張玉蓉','謝淑惠'];
  const names=new Set([...window.SCHEDULE_DATA.teachers.map(t=>t.name),...directors,'鍾芬芳','李宛真']);
  let records=new Map(),loaded=false,groups=[],review=[],done=new Set(),busy=false;
  const admin=()=>window.AUTH_MEMBER?.role==='admin';
  function extract(text){
    const rows=window.PATROL_CSV.parse(text),head=(rows.shift()||[]).map(s=>s.trim()),dates=new Map(),notes=[];
    for(const h of ['日期','星期','學校','宣導形式','入班時間','帶隊老師','入班宣導老師'])if(!head.includes(h))throw Error(`缺少欄位：${h}`);
    rows.forEach((row,i)=>{
      const get=h=>(row[head.indexOf(h)]||'').trim(),school=get('學校');if(!school)return;
      const raw=get('日期'),m=raw.match(/^(?:(\d{4})[\/-])?(\d{1,2})[\/-](\d{1,2})$/);
      const year=m?.[1]||W.start.slice(0,4),date=m?`${year}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';
      const reasons=[],day=date?W.dayOf(date):-1;
      if(!date||!W.inTerm(date)||day<0||day>4||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)reasons.push('非本學期平日有效日期');
      if(date&&get('星期')!=='一二三四五'[day])reasons.push('日期與星期不符');
      if(get('宣導形式')!=='入班'&&get('宣導形式')!=='集合宣導')reasons.push('非早上入班／集合宣導');
      if(!/^(?:0?8[:：]|0800|0?7[:：]55)/.test(get('入班時間')))reasons.push('時間需確認');
      const leader=get('帶隊老師'),members=get('入班宣導老師').split(/[、,，\n]+/).map(s=>s.trim()).filter(Boolean);
      const people=[leader,...members];
      if(!leader||!members.length)reasons.push('帶隊或入班名單未完整');
      const unknown=people.filter(n=>!names.has(n));if(unknown.length)reasons.push(`姓名待確認：${unknown.join('、')}`);
      if(!directors.includes(leader))reasons.push('帶隊身分需確認');
      if(new Set(people).size!==people.length)reasons.push('同校重複姓名');
      if(people.length>20)reasons.push('超過20人');
      if(!dates.has(date))dates.set(date,{date,week:date?W.weekOf(date):0,day,plans:[],people:new Set(),errors:[]});
      const group=dates.get(date);
      for(const name of people){if(group.people.has(name))reasons.push(`同日跨校重複：${name}`);group.people.add(name);}
      group.plans.push({need:people.length,long:false,leader,members,schoolName:school});
      if(reasons.length){group.errors.push(`第${i+2}列 ${school}：${[...new Set(reasons)].join('；')}`);}
    });
    const valid=[];
    for(const group of dates.values()){
      if(group.plans.length>5)group.errors.push('同日超過5間學校');
      if(group.errors.length)notes.push(`${group.date||'日期未填'}：整日暫不匯入。${group.errors.join('／')}`);
      else valid.push({date:group.date,week:group.week,day:group.day,plans:group.plans,status:'submitted'});
    }
    return {groups:valid.sort((a,b)=>a.date.localeCompare(b.date)),review:notes};
  }
  function gate(){
    $('recruit-import-tool').hidden=!admin();$('recruit-import-file').disabled=!admin()||busy;
    const boxes=[...$('recruit-import-preview').querySelectorAll('[data-recruit-import]')];
    for(const box of boxes){const date=box.dataset.recruitImport,skip=records.has(date)||done.has(date);box.disabled=!admin()||busy||skip;if(skip)box.checked=false;}
    const available=boxes.filter(b=>!b.disabled),checked=available.filter(b=>b.checked);
    $('recruit-import-all').disabled=!available.length||checked.length===available.length;
    $('recruit-import-none').disabled=!checked.length;
    $('recruit-import-submit').disabled=!admin()||!loaded||busy||!checked.length;
  }
  function render(){
    $('recruit-import-preview').innerHTML=groups.map(g=>`<article class="teaching-record"><label><input type="checkbox" data-recruit-import="${E(g.date)}">${E(g.date)}｜${records.has(g.date)||done.has(g.date)?'已有紀錄／已匯入，整日略過':'核對完成，選取此日'}</label>${g.plans.map(p=>`<p>${E(p.schoolName)}｜帶隊：${E(p.leader)}｜入班：${p.members.map(E).join('、')}｜共${p.need}人，車程30分鐘內</p>`).join('')}</article>`).join('');
    $('recruit-import-review').innerHTML=review.map(s=>`<p>${E(s)}</p>`).join('')||'<p>無待確認項目。</p>';gate();
  }
  $('recruit-import-file').onchange=async()=>{
    if(!admin()||busy)return;groups=[];review=[];done.clear();render();
    try{const file=$('recruit-import-file').files[0];if(!file)return;if(file.size>8e6)throw Error('CSV超過8MB。');const text=await file.text();if(!admin())return;({groups,review}=extract(text));render();$('recruit-import-status').textContent=`已讀取：${groups.length}個日期可核對，${review.length}個日期待確認。${loaded?'':'尚未同步雲端紀錄，不能送出。'}選檔與全選不會自動上傳。`;}
    catch(error){$('recruit-import-status').textContent=error.message;}gate();
  };
  for(const [id,value] of [['recruit-import-all',true],['recruit-import-none',false]])$(id).onclick=()=>{if(!admin()||busy)return;for(const box of $('recruit-import-preview').querySelectorAll('[data-recruit-import]'))if(!box.disabled)box.checked=value;gate();};
  $('recruit-import-preview').onchange=gate;
  $('recruit-import-submit').onclick=async()=>{
    if(!admin()||!loaded||busy)return;
    const selected=[...$('recruit-import-preview').querySelectorAll('[data-recruit-import]:checked')].map(b=>groups.find(g=>g.date===b.dataset.recruitImport)).filter(g=>g&&!records.has(g.date)&&!done.has(g.date));
    if(!selected.length||!confirm(`送出${selected.length}天招生安排至公開課表？已有紀錄的日期不會覆蓋。`))return;
    busy=true;gate();let count=0,skipped=0;const uid=window.AUTH_MEMBER;
    try{if(!window.CLOUD_RECORDS)throw Error('雲端尚未就緒。');for(const group of selected){if(!admin()||window.AUTH_MEMBER!==uid)throw Error('登入狀態已改變，請重新核對。');if(records.has(group.date)){skipped++;continue;}
      try{await window.CLOUD_RECORDS.save('recruit',group.date,group,{date:group.date,people:group.plans.flatMap(p=>[p.leader,...p.members].map(name=>({name,long:false})))},0,true);done.add(group.date);count++;}
      catch(error){if(error.message.includes('此日期已有紀錄')){done.add(group.date);skipped++;}else throw error;}}
      $('recruit-import-status').textContent=`已匯入${count}天，略過既有${skipped}天。公開招生標記與次數統計會同步更新；可在下方紀錄修正／刪除。`;
    }catch(error){$('recruit-import-status').textContent=`已完成${count}天，其餘尚未送出：${error.message}`;}finally{busy=false;render();}
  };
  window.addEventListener('cloud-recruit-records',e=>{records=new Map(e.detail.map(r=>[r.date,r]));loaded=!!window.AUTH_MEMBER;gate();});
  window.addEventListener('authorization-changed',()=>{if(!admin()){groups=[];review=[];records.clear();loaded=false;done.clear();$('recruit-import-file').value='';$('recruit-import-status').textContent='';render();}gate();});
  window.RECRUIT_CSV={extract};gate();
})();
