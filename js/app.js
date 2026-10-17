const data = window.SCHEDULE_DATA;
const viewType = document.querySelector("#view-type");
const picker = document.querySelector("#schedule-select");
const pickerLabel = document.querySelector("#schedule-select-label");
const pickerGroup = document.querySelector("#schedule-picker-group");
const scheduleCard = document.querySelector("#schedule-card");
const swapTool = document.querySelector("#swap-tool");
const recruitTool = document.querySelector("#recruit-tool");
const tableBody = document.querySelector("#schedule-table tbody");
const title = document.querySelector("#schedule-title");
const kind = document.querySelector("#schedule-kind");
const meta = document.querySelector("#schedule-meta");
const rows = data.classes[0].rows;
const periods = rows.map((row, index) => ({ ...row.period, row: index })).filter(item => /^第[一二三四五六七八]節$/.test(item.name));
const blockedSubjects = ["慈濟學與全球公民", "晨光時間", "班會", "團體活動時間", "彈性學習A", "彈性學習B"];

function byId(id) { return data.classes.find(item => item.id === id); }
function teacher(name) { return data.teachers.find(item => item.name === name); }
function blocked(cell) { return cell.runningClass || blockedSubjects.some(subject => cell.subject.includes(subject)); }
function busy(name, day, row) { return (teacher(name)?.sessions || []).some(item => item.day === day && item.row === row); }
function optionList(records, value, label) { return records.map(item => `<option value="${value(item)}">${label(item)}</option>`).join(""); }
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
    return `<td>${items.map(item => { const run = byId(item.classId)?.rows[rowIndex]?.cells[day]?.runningClass; const place = item.linkable === false ? `<span class="location">${item.className}</span>` : `<button class="schedule-link" data-class="${item.classId}">${item.className}</button>`; return `<div class="course">${item.subject}</div>${run ? '<span class="badge">跑班</span>' : ""}${item.note ? `<div class="note">${item.note}</div>` : ""}<div class="teacher">${place}</div>`; }).join('<hr class="cell-divider">')}</td>`;
  }).join("")}</tr>`).join("");
}
function populateLookup(preferred) {
  const classes = viewType.value === "class";
  const records = classes ? data.classes : data.teachers;
  pickerLabel.textContent = classes ? "選擇班級" : "選擇教師";
  picker.innerHTML = optionList(records, item => classes ? item.id : item.name, item => classes ? `${item.name} ${item.publicCode}` : `${item.id} ${item.name}`);
  if (preferred) picker.value = preferred;
  if (classes) classView(byId(picker.value)); else teacherView(teacher(picker.value));
}
function showMode() {
  const lookup = ["class", "teacher"].includes(viewType.value);
  pickerGroup.classList.toggle("is-hidden", !lookup); scheduleCard.classList.toggle("is-hidden", !lookup);
  swapTool.classList.toggle("is-hidden", viewType.value !== "swap"); recruitTool.classList.toggle("is-hidden", viewType.value !== "recruit");
  if (lookup) populateLookup();
}
function setupTools() {
  const days = optionList(data.meta.days, (_, index) => index, day => `星期${day}`);
  document.querySelector("#swap-day").innerHTML = days; document.querySelector("#recruit-day").innerHTML = days;
  document.querySelector("#swap-teacher").innerHTML = optionList(data.teachers, item => item.name, item => `${item.id} ${item.name}`);
  document.querySelector("#swap-class").innerHTML = optionList(data.classes, item => item.id, item => `${item.name} ${item.publicCode}`);
  document.querySelector("#swap-period").innerHTML = optionList(periods, item => item.row, item => `${item.name} ${item.time}`);
}
function swapSearch() {
  const teacherName = document.querySelector("#swap-teacher").value;
  const day = Number(document.querySelector("#swap-day").value); const row = Number(document.querySelector("#swap-period").value);
  const schedule = byId(document.querySelector("#swap-class").value); const target = schedule.rows[row].cells[day]; const output = document.querySelector("#swap-results");
  if (!target.teachers.some(item => item.name === teacherName)) { output.innerHTML = '<p class="warning">此教師不是該班此時段的授課教師，無法作為調課起點。</p>'; return; }
  if (blocked(target)) { output.innerHTML = `<p class="warning">「${target.subject}」屬於不可調課程。</p>`; return; }
  const eighth = row === 8; const candidates = [];
  schedule.rows.forEach((sourceRow, sourceRowIndex) => sourceRow.cells.forEach((cell, sourceDay) => {
    if (sourceRowIndex === row && sourceDay === day || sourceRowIndex === 0 || blocked(cell) || (eighth ? sourceRowIndex !== 8 : sourceRowIndex < 1 || sourceRowIndex > 7)) return;
    cell.teachers.forEach(item => {
      if (item.name === teacherName || busy(item.name, day, row) || busy(teacherName, sourceDay, sourceRowIndex)) return;
      candidates.push({ teacher: item.name, subject: cell.subject, day: sourceDay, row: sourceRowIndex });
    });
  }));
  const unique = candidates.filter((item, index, all) => index === all.findIndex(other => `${other.teacher}-${other.day}-${other.row}` === `${item.teacher}-${item.day}-${item.row}`));
  output.innerHTML = unique.length ? `<h3>可代調教師</h3><ul class="result-list">${unique.map(item => `<li><strong>${teacher(item.teacher)?.id || ""} ${item.teacher}</strong>：可交換「${item.subject}」－星期${data.meta.days[item.day]} ${rows[item.row].period.name}</li>`).join("")}</ul>` : '<p class="result-note">沒有符合所有時段與課程限制的教師。</p>';
}
function recruitSearch() {
  const day = Number(document.querySelector("#recruit-day").value); const homerooms = new Set(data.classes.map(item => item.homeroomTeacher));
  const freeFirst = data.teachers.filter(item => !busy(item.name, day, 1));
  const bothFree = freeFirst.filter(item => !busy(item.name, day, 2)); const secondBusy = freeFirst.filter(item => busy(item.name, day, 2));
  const list = items => items.map(item => `<li>${item.id} ${item.name}${homerooms.has(item.name) ? "（導師）" : ""}</li>`).join("");
  const nonHomeroom = bothFree.filter(item => !homerooms.has(item.name)); const homeroom = bothFree.filter(item => homerooms.has(item.name));
  document.querySelector("#recruit-results").innerHTML = `<h3>星期${data.meta.days[day]} 可招生教師</h3><p class="result-note">第一、二節皆無課</p><h4>非導師</h4><ul class="result-list">${list(nonHomeroom) || "<li>無</li>"}</ul><h4>導師</h4><ul class="result-list">${list(homeroom) || "<li>無</li>"}</ul><h4>第一節無課、第二節有課</h4><ul class="result-list">${list(secondBusy) || "<li>無</li>"}</ul>`;
}
viewType.addEventListener("change", showMode); picker.addEventListener("change", () => populateLookup(picker.value));
document.querySelector("#swap-search").addEventListener("click", swapSearch); document.querySelector("#recruit-search").addEventListener("click", recruitSearch);
document.addEventListener("click", event => { const target = event.target.closest(".schedule-link"); if (!target) return; if (target.dataset.teacher) { viewType.value = "teacher"; populateLookup(target.dataset.teacher); } if (target.dataset.class) { viewType.value = "class"; populateLookup(target.dataset.class); } });
document.querySelector("#theme-toggle").addEventListener("click", () => { const dark = document.documentElement.dataset.theme === "dark"; document.documentElement.dataset.theme = dark ? "" : "dark"; document.querySelector("#theme-toggle").textContent = dark ? "夜間閱讀" : "日間閱讀"; });
setupTools(); showMode();
