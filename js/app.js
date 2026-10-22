const data = window.SCHEDULE_DATA;
const viewType = document.querySelector("#view-type");
const picker = document.querySelector("#schedule-select");
const pickerLabel = document.querySelector("#schedule-select-label");
const pickerGroup = document.querySelector("#schedule-picker-group");
const scheduleCard = document.querySelector("#schedule-card");
const swapTool = document.querySelector("#swap-tool");
const publicSwapAnchor = document.createComment('public swap workspace');
swapTool.before(publicSwapAnchor);
const recruitTool = document.querySelector("#recruit-tool");
const tableBody = document.querySelector("#schedule-table tbody");
const title = document.querySelector("#schedule-title");
const kind = document.querySelector("#schedule-kind");
const meta = document.querySelector("#schedule-meta");
let workspace = 'public';
const rows = data.classes[0].rows;
const periods = rows.map((row, index) => ({ ...row.period, row: index })).filter(item => /^第[一二三四五六七八]節$/.test(item.name));
const blockedSubjects = ["慈濟學與全球公民", "晨光時間", "班會", "團體活動時間", "彈性學習A", "彈性學習B"];

function byId(id) { return data.classes.find(item => item.id === id); }
function teacher(name) { return data.teachers.find(item => item.name === name); }
const withdrawalSlots = [
  {name:"國二包容", day:1, row:3},
  {name:"國一合心", day:1, row:4},
  {name:"國二和氣", day:2, row:4},
  {name:"高一和氣", day:1, row:5},
  {name:"高一知足", day:1, row:5},
  {name:"高一合心", day:1, row:6},
];
function blocked(cell, schedule, day, row) {
  const subject = cell.subject.replace(/\s+/g, "");
  const mathRun = schedule && /^(高二|高三)(知足|感恩|善解)$/.test(schedule.name) && subject.includes("數學");
  const withdrawal = withdrawalSlots.some(slot => slot.name === schedule?.name && slot.day === day && slot.row === row);
  const dualPhysics = subject.replace(/[-－–—]/g, "").includes("物理探究A");
  return cell.runningClass || mathRun || withdrawal || dualPhysics || subject.includes("多元選修") || blockedSubjects.some(item => subject.includes(item));
}
function eligibleOrigin(name, schedule, day, row) {
  const cell = schedule.rows[row]?.cells[day];
  return row >= 1 && row <= 8 && cell?.subject &&
    (cell.teachers.some(item => item.name === name) || teacher(name).sessions.some(item => item.classId === schedule.id && item.day === day && item.row === row));
}
function refreshSwapOptions(onlyPeriods = false) {
  const name = document.querySelector("#swap-teacher").value;
  const schedule = byId(document.querySelector("#swap-class").value);
  const daySelect = document.querySelector("#swap-day");
  const periodSelect = document.querySelector("#swap-period");
  if (!onlyPeriods) {
    const previous = daySelect.value;
    const days = data.meta.days.map((name, day) => ({name, day})).filter(item => periods.some(period => eligibleOrigin(name, schedule, item.day, period.row)));
    daySelect.innerHTML = optionList(days, item => item.day, item => `星期${item.name}`);
    if (days.some(item => String(item.day) === previous)) daySelect.value = previous;
    daySelect.disabled = !days.length;
    if (!days.length) daySelect.innerHTML = '<option value="">無可調課星期</option>';
  }
  const previousPeriod = periodSelect.value;
  const available = daySelect.value === "" ? [] : periods.filter(period => eligibleOrigin(name, schedule, Number(daySelect.value), period.row));
  periodSelect.innerHTML = optionList(available, item => item.row, item => `${item.name} ${item.time}`);
  if (available.some(item => String(item.row) === previousPeriod)) periodSelect.value = previousPeriod;
  periodSelect.disabled = !available.length;
  if (!available.length) periodSelect.innerHTML = '<option value="">無可調課節次</option>';
}
function busy(name, day, row) { return (teacher(name)?.sessions || []).some(item => item.day === day && item.row === row); }
function optionList(records, value, label) { return records.map((item, index) => `<option value="${value(item, index)}">${label(item, index)}</option>`).join(""); }
function entryHtml(entry) {
  if (!entry.subject) return "";
  const buttons = entry.teachers.map(item => `<button class="schedule-link" data-teacher="${item.name}">${item.name}</button>`).join("");
  return `<div class="course">${entry.subject}</div>${entry.runningClass ? '<span class="badge">跑班</span>' : ""}<div class="teacher">${buttons || '<span class="pending">待確認</span>'}</div>`;
}
function classView(schedule) {
  kind.textContent = "班級課表"; title.textContent = schedule.name;
  meta.textContent = `班級編碼：${schedule.publicCode}｜導師：${schedule.homeroomTeacher}`;
  tableBody.innerHTML = schedule.rows.map(row => `<tr><td>${row.period.name}\n${row.period.time}</td>${row.cells.map(cell => `<td>${entryHtml(cell)}</td>`).join("")}</tr>`).join("");
}
function teacherView(record) {
  kind.textContent = "教師課表"; title.textContent = `${record.id} ${record.name}`; meta.textContent = "點選班級可返回班級課表";
  const slots = new Map();
  record.sessions.forEach(item => { const key = `${item.day}-${item.row}`; slots.set(key, [...(slots.get(key) || []), item]); });
  tableBody.innerHTML = rows.map((row, rowIndex) => `<tr><td>${row.period.name}\n${row.period.time}</td>${data.meta.days.map((_, day) => {
    const items = slots.get(`${day}-${rowIndex}`) || [];
    if (!items.length) return "<td></td>";
    return `<td>${items.map(item => { const run = byId(item.classId)?.rows[rowIndex]?.cells[day]?.runningClass; const place = item.linkable === false ? `<span class="location">${item.className || ""}</span>` : `<button class="schedule-link" data-class="${item.classId}">${item.className}</button>`; return `<div class="course">${item.subject}</div>${item.grouped ? '<span class="badge">分組</span>' : run ? '<span class="badge">跑班</span>' : ""}${item.note ? `<div class="note">${item.note}</div>` : ""}<div class="teacher">${place}</div>`; }).join('<hr class="cell-divider">')}</td>`;
  }).join("")}</tr>`).join("");
}
function populateLookup(preferred) {
  const classes = viewType.value === "class";
  const records = classes ? data.classes : data.teachers;
  pickerLabel.textContent = classes ? "選擇班級" : "選擇教師";
  picker.innerHTML = optionList(records, item => classes ? item.id : item.name, item => classes ? `${item.name} ${item.publicCode}` : `${item.id} ${item.name}`);
  if (preferred) picker.value = preferred;
  if (classes) classView(byId(picker.value)); else teacherView(teacher(picker.value));
  window.dispatchEvent(new Event('teacher-lookup-selected'));
}
function showMode() {
  const adminMode = workspace === 'admin';
  const officeMode = workspace === 'office';
  const member = window.AUTH_MEMBER?.role === 'patrol' ? null : window.AUTH_MEMBER;
  const feature = document.querySelector('#office-type').value;
  const patrolBackfill = document.querySelector('#patrol-backfill');
  patrolBackfill.hidden = !officeMode || feature !== 'patrol' || window.AUTH_MEMBER?.role !== 'admin';
  document.querySelector('#patrol-history').before(patrolBackfill);
  document.body.dataset.workspace = workspace;
  document.querySelector('#page-heading').textContent = adminMode ? '管理者功能' : officeMode ? '教務處行政業務' : '115 學年度第 1 學期課表';
  document.querySelector('#term-dates').hidden = workspace !== 'public';
  document.querySelector('#public-controls').hidden = workspace !== 'public';
  document.querySelector('#office-controls').hidden = !officeMode || !member;
  document.querySelector('#office-placeholder').hidden = true;
  document.querySelector('#patrol-entry').hidden = workspace !== 'patrol' || !['admin','patrol'].includes(window.AUTH_MEMBER?.role);
  document.querySelector('#patrol-analysis').hidden = !officeMode || window.AUTH_MEMBER?.role !== 'admin' || feature !== 'patrol';
  document.querySelector('#patrol-history').hidden = document.querySelector('#patrol-analysis').hidden;
  document.querySelector('#patrol-open').setAttribute('aria-pressed', String(workspace === 'patrol'));
  if(workspace === 'patrol') document.querySelector('#page-heading').textContent = '巡堂紀錄登錄';
  document.querySelector('#teaching-tool').hidden = !officeMode || !member || feature !== 'teaching-plan';
  for(const [id,type] of [['teaching-history-tool','teaching-plan'],['recruit-history-tool','recruit'],['events-tool','events'],['events-history-tool','events']]){const panel=document.getElementById(id);panel.hidden=!officeMode||!member||feature!==type;if(!panel.hidden)panel.parentElement.append(panel);}
  const officeComparison = officeMode && !!member && feature === 'teaching-plan';
  if (officeComparison) document.querySelector('#teaching-comparison-host').append(swapTool);
  else publicSwapAnchor.after(swapTool);
  swapTool.classList.toggle('office-comparison', officeComparison);
  document.body.dataset.officeFeature = officeMode ? feature : '';
  document.querySelector('#office-feature-heading').textContent = feature === 'teaching-plan' ? '教學組代調課規劃' : '巡堂紀錄表';
  document.querySelector('#account-panel').hidden = workspace === 'public';
  document.querySelector('#account-heading').textContent = adminMode ? '管理者功能' : '授權登入';
  document.querySelector('#member-admin').classList.toggle('is-hidden', !adminMode || window.AUTH_MEMBER?.role !== 'admin');
  document.querySelector('#admin-access-note').classList.toggle('is-hidden', !adminMode || window.AUTH_MEMBER?.role === 'admin');
  if(workspace==='patrol' && !['admin','patrol'].includes(window.AUTH_MEMBER?.role)){
    document.querySelector('#admin-access-note').textContent='請使用管理員或巡堂登錄人員帳號登入；一般授權教師不自動取得巡堂資料權限。';
    document.querySelector('#admin-access-note').classList.remove('is-hidden');
  }else if(officeMode && feature==='patrol' && window.AUTH_MEMBER?.role!=='admin'){
    document.querySelector('#admin-access-note').textContent='全校巡堂紀錄分析僅供管理員使用。';
    document.querySelector('#admin-access-note').classList.remove('is-hidden');
  }else document.querySelector('#admin-access-note').textContent='此功能僅供管理員使用，請使用管理員 Google 帳號登入。';
  document.querySelector('#admin-open').setAttribute('aria-pressed', String(adminMode));
  document.querySelector('#office-open').setAttribute('aria-pressed', String(officeMode));
  document.querySelector('#public-open').setAttribute('aria-pressed', String(workspace === 'public'));
  const lookup = workspace === 'public' && ["class", "teacher"].includes(viewType.value);
  document.getElementById('teacher-search-tool').hidden=workspace!=='public'||viewType.value!=='teacher';
  pickerGroup.classList.toggle("is-hidden", !lookup); scheduleCard.classList.toggle("is-hidden", !lookup);
  swapTool.classList.toggle("is-hidden", !officeComparison && (workspace !== 'public' || viewType.value !== "swap"));
  recruitTool.classList.toggle("is-hidden", !officeMode || feature !== 'recruit');
  document.querySelector('#recruit-gate').classList.toggle('is-hidden', !officeMode || !!member);
  recruitTool.hidden = !officeMode || !member || feature !== 'recruit';
  if (lookup) populateLookup();
  if (officeComparison || (workspace==='public' && viewType.value==='swap')) { refreshSwapOptions(); updateComparison(); }
}
function setupTools() {
  document.querySelector('#swap-week').innerHTML = window.WEEKLY.weekOptions();
  document.querySelector('#swap-week').value = String(Math.max(1,Math.min(21,window.WEEKLY.weekOf(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'})))));
  document.querySelector('#swap-other-week').innerHTML=window.WEEKLY.weekOptions();document.querySelector('#swap-other-week').value=document.querySelector('#swap-week').value;
  const days = optionList(data.meta.days, (_, index) => index, day => `星期${day}`);
  document.querySelector("#swap-day").innerHTML = days; document.querySelector("#recruit-day").innerHTML = days;
  document.querySelector("#swap-teacher").innerHTML = optionList(data.teachers, item => item.name, item => `${item.id} ${item.name}`);
  document.querySelector("#swap-class").innerHTML = optionList(data.classes, item => item.id, item => `${item.name} ${item.publicCode}`);
  document.querySelector("#swap-period").innerHTML = optionList(periods, item => item.row, item => `${item.name} ${item.time}`);
}
function swapSearch() {
  if (document.querySelector("#swap-period").disabled) {
    document.querySelector("#swap-results").textContent = "該教師在此班沒有可調課的授課時段。";
    return;
  }
  const teacherName = document.querySelector("#swap-teacher").value;
  const day = Number(document.querySelector("#swap-day").value); const row = Number(document.querySelector("#swap-period").value);
  const schedule = byId(document.querySelector("#swap-class").value); const target = schedule.rows[row].cells[day]; const output = document.querySelector("#swap-results");
  if (!busy(teacherName, day, row)) { output.innerHTML = '<p class="warning">本教師該節無課務</p>'; return; }
  if (!teachesClass(teacherName, schedule.id)) { output.textContent = "本教師無任教該班級"; return; }
  if (!eligibleOrigin(teacherName, schedule, day, row)) { output.textContent = "此時段不是該教師在本班可調課的授課時段。"; return; }
  if (blocked(target, schedule, day, row)) { output.textContent = `「${target.subject}」不能調課`; return; }
  const eighth = row === 8; const candidates = [];
  schedule.rows.forEach((sourceRow, sourceRowIndex) => sourceRow.cells.forEach((cell, sourceDay) => {
    if (sourceRowIndex === row && sourceDay === day || sourceRowIndex === 0 || blocked(cell, schedule, sourceDay, sourceRowIndex) || (eighth ? sourceRowIndex !== 8 : sourceRowIndex < 1 || sourceRowIndex > 7)) return;
    cell.teachers.forEach(item => {
      if (item.name === teacherName || busy(item.name, day, row) || busy(teacherName, sourceDay, sourceRowIndex)) return;
      candidates.push({ teacher: item.name, subject: cell.subject, day: sourceDay, row: sourceRowIndex });
    });
  }));
  const unique = candidates.filter((item, index, all) => index === all.findIndex(other => `${other.teacher}-${other.day}-${other.row}` === `${item.teacher}-${item.day}-${item.row}`));
  output.innerHTML = unique.length ? `<h3>可代調清單</h3><p>藍底：原調課時段；橘底：選定候選時段。點選教師姓名比較。</p><ul class="result-list">${unique.map(item => `<li><strong>科目：</strong>${item.subject}　<strong>教師：</strong><button type="button" class="schedule-link" data-candidate="${item.teacher}" data-day="${item.day}" data-row="${item.row}" aria-pressed="false">${item.teacher}</button>　<strong>星期：</strong>${data.meta.days[item.day]}　<strong>節數：</strong>${rows[item.row].period.name}</li>`).join("")}</ul>` : '<p class="result-note">沒有符合所有時段與課程限制的教師。</p>';
}
function teachesClass(name, classId) {
  return teacher(name).sessions.some(item => item.classId === classId) || byId(classId).rows.some(row => row.cells.some(cell => cell.teachers.some(item => item.name === name)));
}
function comparisonTable(heading, cellRenderer) {
  return `<h3>${heading}</h3><div class="table-wrap"><table><thead><tr><th>節次</th>${data.meta.days.map(day => `<th>${day}</th>`).join("")}</tr></thead><tbody>${rows.map((row, index) => `<tr><td>${row.period.name}</td>${data.meta.days.map((_, day) => `<td data-slot-day="${day}" data-slot-row="${index}">${cellRenderer(day, index)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function highlightComparison(candidateDay, candidateRow) {
  const originDay = document.querySelector("#swap-day").value;
  const originRow = document.querySelector("#swap-period").value;
  document.querySelectorAll(".comparison-grid td[data-slot-day]").forEach(cell => {
    const origin = originDay !== "" && originRow !== "" && cell.dataset.slotDay === originDay && cell.dataset.slotRow === originRow;
    const candidate = candidateDay !== undefined && cell.dataset.slotDay === String(candidateDay) && cell.dataset.slotRow === String(candidateRow);
    cell.classList.toggle("swap-origin", origin);
    cell.classList.toggle("swap-candidate", candidate);
    cell.querySelector(".slot-label")?.remove();
    if (workspace !== 'public' && (origin || candidate)) cell.insertAdjacentHTML("afterbegin", `<span class="slot-label">${origin ? "原調課" : "候選調課"}</span>`);
  });
}
function comparisonTeacher(name, panel) {
  const record = teacher(name);
  document.querySelector(panel).innerHTML = comparisonTable(`${record.id} ${record.name}`, (day, row) => record.sessions.filter(item => item.day === day && item.row === row).map(item => `<div class="course">${item.subject}</div>${item.grouped ? '<span class="badge">分組</span>' : ""}${item.linkable !== false && item.classId ? `<small>${item.className || ""}</small>` : ""}`).join("<hr>"));
}
function updateComparison() {
  const name = document.querySelector("#swap-teacher").value;
  const schedule = byId(document.querySelector("#swap-class").value);
  comparisonTeacher(name, "#swap-left");
  document.querySelector("#swap-middle").innerHTML = teachesClass(name, schedule.id) ? comparisonTable(`${schedule.name} ${schedule.publicCode}`, (day, row) => { const cell = schedule.rows[row].cells[day]; return `<div class="course">${cell.subject}</div><small>${cell.teachers.map(item => item.name).join("、")}</small>`; }) : "<p>本教師無任教該班級</p>";
  document.querySelector("#swap-right").textContent = "點選候選教師後，在此顯示課表。";
  swapSearch();
  highlightComparison();
}
function recruitSearch() {
  const day = Number(document.querySelector("#recruit-day").value); const homerooms = new Set(data.classes.map(item => item.homeroomTeacher));
  const freeFirst = data.teachers.filter(item => !busy(item.name, day, 1));
  const bothFree = freeFirst.filter(item => !busy(item.name, day, 2)); const secondBusy = freeFirst.filter(item => busy(item.name, day, 2));
  const list = items => items.map(item => `<li>${item.id} ${item.name}${homerooms.has(item.name) ? "（導師）" : ""}</li>`).join("");
  const nonHomeroom = bothFree.filter(item => !homerooms.has(item.name)); const homeroom = bothFree.filter(item => homerooms.has(item.name));
  document.querySelector("#recruit-results").innerHTML = `<h3>星期${data.meta.days[day]} 可招生教師</h3><p class="result-note">第一、二節皆無課</p><h4>非導師</h4><ul class="result-list">${list(nonHomeroom) || "<li>無</li>"}</ul><h4>導師</h4><ul class="result-list">${list(homeroom) || "<li>無</li>"}</ul><h4>第一節無課、第二節有課</h4><ul class="result-list">${list(secondBusy) || "<li>無</li>"}</ul>`;
}
window.renderWorkspace = showMode;
document.querySelector('#patrol-open').addEventListener('click', () => { workspace = 'patrol'; showMode(); });
document.querySelector('#admin-open').addEventListener('click', () => { workspace = 'admin'; showMode(); });
document.querySelector('#office-open').addEventListener('click', () => { workspace = 'office'; showMode(); });
document.querySelector('#public-open').addEventListener('click', () => { workspace = 'public'; showMode(); });
document.querySelector('#office-type').addEventListener('change', showMode);
viewType.addEventListener("change", showMode); picker.addEventListener("change", () => populateLookup(picker.value));
document.addEventListener("click", event => { const target = event.target.closest(".schedule-link"); if (!target) return; if (target.dataset.teacher) { viewType.value = "teacher"; showMode();populateLookup(target.dataset.teacher); } if (target.dataset.class) { viewType.value = "class"; showMode();populateLookup(target.dataset.class); } });
document.querySelector("#theme-toggle").addEventListener("click", () => { const dark = document.documentElement.dataset.theme === "dark"; document.documentElement.dataset.theme = dark ? "" : "dark"; document.querySelector("#theme-toggle").textContent = dark ? "夜間閱讀" : "日間閱讀"; });
document.querySelectorAll("#swap-tool select").forEach(select => select.addEventListener("change", () => {
  if (select.id === "swap-week") document.querySelector('#swap-other-week').value = select.value;
  if (select.id !== "swap-period") refreshSwapOptions(select.id === "swap-day");
  updateComparison();
}));
document.querySelector("#swap-results").addEventListener("click", event => {
  const button = event.target.closest("[data-candidate]");
  if (!button) return;
  comparisonTeacher(button.dataset.candidate, "#swap-right");
  document.querySelectorAll("[data-candidate]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
  highlightComparison(button.dataset.day, button.dataset.row);
});
setupTools(); showMode(); refreshSwapOptions(); updateComparison();
