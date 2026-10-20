(() => {
  const pages=new Map(),size=5;
  const stamp=r=>{const time=r.createdAt;return time?.toMillis?.()||(time?.seconds?time.seconds*1000:0)||Number(r.order)||Date.parse(r.date||r.a?.date||(r.week?WEEKLY.dateFor(r.week,r.startDay||0):''))||0;};
  function sort(items){return [...items].sort((a,b)=>stamp(b)-stamp(a)||String(b.id||b.date||'').localeCompare(String(a.id||a.date||'')));}
  function render(id){
    const container=document.getElementById(id);if(!container)return;
    container.querySelector(':scope > .record-pagination')?.remove();
    const records=[...container.querySelectorAll(':scope > article')],count=Math.max(1,Math.ceil(records.length/size));
    const page=Math.max(1,Math.min(pages.get(id)||1,count));pages.set(id,page);
    records.forEach((record,index)=>{record.hidden=index<(page-1)*size||index>=page*size;});
    if(!records.length)return;
    const nav=document.createElement('nav');nav.className='record-pagination';nav.setAttribute('aria-label','登錄紀錄分頁');
    const numbers=[...new Set([1,...Array.from({length:5},(_,i)=>page+i-2).filter(n=>n>0&&n<=count),count])].sort((a,b)=>a-b);
    nav.innerHTML=`<span>共${records.length}筆，第${page}/${count}頁（每頁5筆）</span><button type="button" class="person-button" data-record-page="${page-1}" ${page===1?'disabled':''}>上一頁</button>${numbers.map((n,i)=>`${i&&n>numbers[i-1]+1?'<span>…</span>':''}<button type="button" class="person-button" data-record-page="${n}" aria-current="${n===page?'page':'false'}">${n}</button>`).join('')}<button type="button" class="person-button" data-record-page="${page+1}" ${page===count?'disabled':''}>下一頁</button>`;
    container.append(nav);
    if(!container.dataset.paged){container.dataset.paged='true';container.addEventListener('click',event=>{const button=event.target.closest('[data-record-page]');if(!button||button.disabled)return;pages.set(id,Number(button.dataset.recordPage));render(id);});}
  }
  window.RECORD_PAGES={sort,render};
})();
