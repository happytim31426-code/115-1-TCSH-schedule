(() => {
  const W=window.WEEKLY,$=id=>document.getElementById(id),query=$('teacher-name-query');
  const resultButton=t=>`<button type="button" class="person-button" data-choice-teacher="${W.esc(t.name)}">${W.esc(t.id)} ${W.esc(t.name)}</button>`;
  const swapQuery=$('swap-teacher-query'),swapMatches=$('swap-teacher-matches');
  const filterSwap=filtering=>{$('swap-tool').querySelector('.comparison-grid').hidden=filtering;$('swap-results').hidden=filtering;};
  swapQuery.addEventListener('input',()=>{const value=swapQuery.value.trim();filterSwap(!!value);swapMatches.innerHTML=value?data.teachers.filter(t=>t.name.includes(value)||String(t.id).includes(value)).map(t=>`<button type="button" class="person-button" data-swap-choice="${W.esc(t.name)}">${W.esc(t.id)} ${W.esc(t.name)}</button>`).join('')||'<p>找不到符合的教師，請重新輸入。</p>':'';});
  swapMatches.addEventListener('click',event=>{const b=event.target.closest('[data-swap-choice]');if(!b)return;$('swap-teacher').value=b.dataset.swapChoice;swapQuery.value=b.dataset.swapChoice;swapMatches.replaceChildren();$('swap-teacher').dispatchEvent(new Event('change',{bubbles:true}));});
  $('swap-teacher').addEventListener('change',()=>{swapQuery.value=$('swap-teacher').value;swapMatches.replaceChildren();filterSwap(false);});
  let previewTeacher=null;
  $('teacher-free-period').insertAdjacentHTML('beforeend',Array.from({length:8},(_,i)=>`<option value="${i+1}">第${i+1}節</option>`).join(''));
  function clearPreview(){previewTeacher=null;$('teacher-free-preview').hidden=true;$('teacher-free-preview').replaceChildren();}
  query.addEventListener('input',()=>{
    clearPreview();const value=query.value.trim();
    if(!value){$('teacher-name-results').replaceChildren();return;}
    scheduleCard.classList.add('is-hidden');
    const matches=data.teachers.filter(t=>t.name.includes(value)||String(t.id).includes(value));
    $('teacher-name-results').innerHTML=matches.map(resultButton).join('')||'<p>找不到符合姓名或編號的教師。</p>';
  });
  function freeSearch(){
    const date=$('teacher-free-date').value,row=Number($('teacher-free-period').value),status=$('teacher-free-status');
    $('teacher-free-results').replaceChildren();clearPreview();
    if(!date||!row){status.textContent='選填日期與節次後，會列出該時段無課務的教師。';return;}
    if(!W.inTerm(date)){status.textContent='請選擇本學期週一至週五的日期。';return;}
    if(!W.ready){status.textContent='最新課務尚未同步，暫不提供空堂名單。';return;}
    const list=data.teachers.filter(t=>!W.busy(t.name,date,row));
    status.textContent=`第${W.weekOf(date)}週 ${W.formatDate(date)} 第${row}節：${list.length}位教師無已登錄課務。點姓名查看該週課表。`;
    $('teacher-free-results').innerHTML=list.map(resultButton).join('')||'<p>沒有符合條件的教師。</p>';
  }
  $('teacher-name-results').addEventListener('click',event=>{
    const b=event.target.closest('[data-choice-teacher]');if(!b)return;
    clearPreview();populateLookup(b.dataset.choiceTeacher);scheduleCard.classList.remove('is-hidden');query.value=b.dataset.choiceTeacher;$('teacher-name-results').replaceChildren();
  });
  $('teacher-free-results').addEventListener('click',event=>{
    const b=event.target.closest('[data-choice-teacher]');if(!b)return;
    const name=b.dataset.choiceTeacher;previewTeacher=name;picker.value=name;scheduleCard.classList.add('is-hidden');
    $('teacher-free-preview').hidden=false;$('teacher-free-preview').innerHTML=W.table(name,W.weekOf($('teacher-free-date').value));
    $('teacher-free-preview').querySelector(`td[data-slot-day="${W.dayOf($('teacher-free-date').value)}"][data-slot-row="${$('teacher-free-period').value}"]`)?.classList.add('free-selected');
  });
  for(const id of ['teacher-free-date','teacher-free-period'])$(id).addEventListener('change',freeSearch);
  picker.addEventListener('change',()=>{clearPreview();query.value='';$('teacher-name-results').replaceChildren();});
  window.addEventListener('teacher-lookup-selected',()=>{clearPreview();query.value='';$('teacher-name-results').replaceChildren();});
  viewType.addEventListener('change',()=>{clearPreview();query.value='';$('teacher-name-results').replaceChildren();});
  window.addEventListener('weekly-changed',()=>{const old=previewTeacher;freeSearch();if(old&&W.inTerm($('teacher-free-date').value)&&$('teacher-free-period').value&&!W.busy(old,$('teacher-free-date').value,Number($('teacher-free-period').value)))$('teacher-free-results').querySelector(`[data-choice-teacher="${CSS.escape(old)}"]`)?.click();});
  freeSearch();
  const commonNames=new Set();let commonConfirmed=false;
  $('teacher-common-week').insertAdjacentHTML('beforeend',W.weekOptions());
  function commonMatches(){const value=$('teacher-common-query').value.trim();$('teacher-common-matches').innerHTML=value?data.teachers.filter(t=>!commonNames.has(t.name)&&(t.name.includes(value)||String(t.id).includes(value))).map(t=>`<button type="button" class="person-button" data-common-add="${W.esc(t.name)}">${W.esc(t.id)} ${W.esc(t.name)}</button>`).join('')||'<p>沒有符合或尚未加入的教師。</p>':'';}
  function commonReset(){commonConfirmed=false;$('teacher-common-results').replaceChildren();$('teacher-common-status').textContent=commonNames.size<2?'請選取至少2位教師；不影響原本的教師課表查詢。':'名單／週次已更新，請按確認重新查詢。';$('teacher-common-confirm').disabled=commonNames.size<2;$('teacher-common-selected').innerHTML=[...commonNames].map(name=>`<button type="button" class="person-button" data-common-remove="${W.esc(name)}">${W.esc(teacher(name)?.id||'')} ${W.esc(name)} ×</button>`).join('')||'<span>尚未加入教師</span>';commonMatches();}
  function commonSearch(){
    $('teacher-common-results').replaceChildren();if(commonNames.size<2){commonReset();return;}
    const week=Number($('teacher-common-week').value),status=$('teacher-common-status');commonConfirmed=true;
    if(week&&!W.ready){status.textContent='最新課務尚未同步，暫不提供當週共同空堂。';return;}
    const slots=[];for(let day=0;day<5;day++){const date=week?W.dateFor(week,day):null;if(date&&!W.inTerm(date))continue;const free=[];for(let row=1;row<=8;row++){const available=[...commonNames].every(name=>week?!W.busy(name,date,row):!(teacher(name)?.sessions||[]).some(s=>s.day===day&&s.row===row));if(available)free.push(row);}if(free.length)slots.push({day,date,free});}
    status.textContent=`${week?`第${week}週（依已同步課務）`:'原始課表'}｜${commonNames.size}位教師｜共同空堂${slots.reduce((n,s)=>n+s.free.length,0)}節。`;
    $('teacher-common-results').innerHTML=slots.length?`<ul>${slots.map(s=>`<li><strong>星期${'一二三四五'[s.day]}${s.date?`（${W.formatDate(s.date)}）`:''}</strong>：${s.free.map(row=>`第${row}節`).join('、')}</li>`).join('')}</ul>`:'<p>所選教師沒有共同空堂。</p>';
  }
  $('teacher-common-query').addEventListener('input',commonMatches);
  $('teacher-common-matches').addEventListener('click',event=>{const b=event.target.closest('[data-common-add]');if(!b||!teacher(b.dataset.commonAdd))return;commonNames.add(b.dataset.commonAdd);$('teacher-common-query').value='';commonReset();});
  $('teacher-common-selected').addEventListener('click',event=>{const b=event.target.closest('[data-common-remove]');if(b){commonNames.delete(b.dataset.commonRemove);commonReset();}});
  $('teacher-common-week').addEventListener('change',commonReset);
  $('teacher-common-confirm').addEventListener('click',commonSearch);
  $('teacher-common-clear').addEventListener('click',()=>{commonNames.clear();$('teacher-common-query').value='';commonReset();});
  window.addEventListener('weekly-changed',()=>{if(commonConfirmed&&$('teacher-common-week').value)commonSearch();});
  commonReset();
})();
