(() => {
  const directors = ['張齡之','游棋竹','林昱汝','薛靜儀','林曉瑩','陳雲亮','陳柏伶','張玉蓉','謝淑惠'];
  const homerooms = new Set(data.classes.map(item => item.homeroomTeacher));
  const people = [...data.teachers.map(item => ({name:item.name, known:true})), ...directors.filter(name => !teacher(name)).map(name => ({name,known:false}))];
  if (!people.some(item => item.name === '鍾芬芳')) people.push({name:'鍾芬芳',known:true,staff:true});
  const createSchool = () => ({need:1,long:false,leader:null,members:[]});
  let plans = [createSchool()], active = 0;
  const daySelect = document.querySelector('#recruit-day');
  const roster = document.querySelector('#recruit-roster');
  const schoolArea = document.querySelector('#school-plans');
  const message = document.querySelector('#recruit-message');
  const assigned = name => plans.some(plan => plan.leader === name || plan.members.includes(name));
  const available = (person, second = false) => person.known && !busy(person.name,Number(daySelect.value),1) && (!second || !busy(person.name,Number(daySelect.value),2));
  const findPerson = name => people.find(item => item.name === name);
  const say = text => { message.textContent = text; };
  function personButton(person, role) {
    const permitted = available(person,plans[active].long);
    const note = !person.known ? '（無課表，待確認）' : busy(person.name,Number(daySelect.value),2) ? '（第二節有課）' : '';
    return `<button type="button" class="person-button" data-person="${person.name}" data-role="${role}" ${permitted ? '' : 'disabled'}>${person.name}${note}</button>`;
  }
  function render() {
    const pool = people.filter(person => !assigned(person.name) && (!person.known || available(person)));
    const group = (heading,items,role) => `<h4>${heading}</h4><div class="person-list">${items.map(person => personButton(person,role)).join('') || '<p>無可用人員</p>'}</div>`;
    const leaders = pool.filter(person => directors.includes(person.name));
    roster.innerHTML = `<p>目前安排：第 ${active+1} 間學校${plans[active].long ? '（限第一、二節皆無課）' : ''}</p><div class="recruit-columns"><section>${group('帶隊老師推薦清單',leaders,'leader')}</section><section><h3>入班老師推薦清單</h3>${group('非導師',pool.filter(person => !directors.includes(person.name) && !homerooms.has(person.name) && !person.staff),'member')}${group('導師',pool.filter(person => !directors.includes(person.name) && homerooms.has(person.name)),'member')}${group('職員',pool.filter(person => person.staff),'member')}${group('主任亦可擔任入班老師',leaders,'member')}</section></div>`;
    schoolArea.style.gridTemplateColumns = `repeat(${plans.length}, minmax(260px, 1fr))`;
    schoolArea.innerHTML = plans.map((plan,index) => `<section class="school-plan ${index === active ? 'active-school' : ''}"><button type="button" class="action-button" data-school="${index}" aria-pressed="${index === active}">安排第 ${index+1} 間學校</button><label>需求入班人數<select data-need="${index}">${Array.from({length:20},(_,n) => `<option value="${n+1}" ${plan.need === n+1 ? 'selected' : ''}>${n+1}</option>`).join('')}</select></label><label>返校車程是否超過30分鐘<select data-long="${index}"><option value="no" ${!plan.long ? 'selected' : ''}>否</option><option value="yes" ${plan.long ? 'selected' : ''}>是</option></select></label><h4>帶隊老師（${plan.leader ? 1 : 0}/1）</h4><div class="assigned-list">${plan.leader ? `<button type="button" class="person-button" data-remove="${plan.leader}" data-plan="${index}">${plan.leader} ×</button>` : '尚未選擇'}</div><h4>入班宣導老師（${plan.members.length}/${plan.need-1}）</h4><div class="assigned-list">${plan.members.map(name => `<button type="button" class="person-button" data-remove="${name}" data-plan="${index}">${name} ×</button>`).join('') || '尚未選擇'}</div><p>${plan.leader && plan.members.length === plan.need-1 ? '✓ 人數已滿足' : '待安排'}</p></section>`).join('');
  }
  roster.addEventListener('click',event => {
    const button = event.target.closest('[data-person]'); if (!button) return;
    const name = button.dataset.person, plan = plans[active];
    if (assigned(name) || !available(findPerson(name),plan.long)) return;
    if (button.dataset.role === 'leader') {
      if (plan.leader) return say('此校已有帶隊老師，請先點姓名移回推薦清單。');
      plan.leader = name;
    } else {
      if (plan.members.length >= plan.need-1) return say('入班人數已滿，請調整需求人數或先移回人員。');
      plan.members.push(name);
    }
    say(''); render();
  });
  schoolArea.addEventListener('click',event => {
    const select = event.target.closest('[data-school]');
    if (select) { active = Number(select.dataset.school); say(''); render(); return; }
    const remove = event.target.closest('[data-remove]');
    if (remove) { const plan = plans[Number(remove.dataset.plan)]; if (plan.leader === remove.dataset.remove) plan.leader = null; plan.members = plan.members.filter(name => name !== remove.dataset.remove); say('人員已移回推薦清單。'); render(); }
  });
  schoolArea.addEventListener('change',event => {
    const element = event.target;
    if (element.dataset.need !== undefined) {
      const plan = plans[Number(element.dataset.need)]; plan.need = Number(element.value);
      const removed = plan.members.splice(plan.need-1); say(removed.length ? `超出名額的人員已移回：${removed.join('、')}` : '');
    }
    if (element.dataset.long !== undefined) {
      const plan = plans[Number(element.dataset.long)]; plan.long = element.value === 'yes';
      const removed = [];
      if (plan.leader && !available(findPerson(plan.leader),plan.long)) { removed.push(plan.leader); plan.leader = null; }
      plan.members = plan.members.filter(name => { if (available(findPerson(name),plan.long)) return true; removed.push(name); return false; });
      say(removed.length ? `不符合車程條件的人員已移回：${removed.join('、')}` : '');
    }
    render();
  });
  document.querySelector('#school-count').addEventListener('change',event => {
    const count = Number(event.target.value); plans = plans.slice(0,count); while (plans.length < count) plans.push(createSchool()); active = Math.min(active,count-1); say(''); render();
  });
  daySelect.addEventListener('change',() => { plans = plans.map(plan => ({...plan,leader:null,members:[]})); say('已切換星期，原人員安排已清空，請重新選擇。'); render(); });
  render();
})();
