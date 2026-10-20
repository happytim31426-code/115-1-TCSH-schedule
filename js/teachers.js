(() => {
  const W=window.WEEKLY,$=id=>document.getElementById(id),query=$('teacher-name-query');
  const resultButton=t=>`<button type="button" class="person-button" data-choice-teacher="${W.esc(t.name)}">${W.esc(t.id)} ${W.esc(t.name)}</button>`;
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
})();
