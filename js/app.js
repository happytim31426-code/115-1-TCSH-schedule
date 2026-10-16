const data = window.SCHEDULE_DATA;
const viewType = document.querySelector("#view-type");
const picker = document.querySelector("#schedule-select");
const pickerLabel = document.querySelector("#schedule-select-label");
const tableBody = document.querySelector("#schedule-table tbody");
const title = document.querySelector("#schedule-title");
const kind = document.querySelector("#schedule-kind");
const meta = document.querySelector("#schedule-meta");

function byId(id) { return data.classes.find(item => item.id === id); }
function teacher(name) { return data.teachers.find(item => item.name === name); }
function entryHtml(entry) {
  if (!entry.subject) return "";
  const teacherButtons = entry.teachers.map(item => `<button class="schedule-link" data-teacher="${item.name}">${item.name}</button>`).join("");
  const note = entry.runningClass ? '<span class="badge">跑班</span>' : "";
  const pending = entry.teachers.length ? "" : '<span class="pending">待確認</span>';
  return `<div class="course">${entry.subject}</div>${note}<div class="teacher">${teacherButtons || pending}</div>`;
}
function classView(schedule) {
  kind.textContent = "班級課表";
  title.textContent = schedule.name;
  meta.textContent = `班級編碼：${schedule.publicCode}｜導師：${schedule.homeroomTeacher}`;
  tableBody.innerHTML = schedule.rows.map(row => `<tr><td>${row.period.name}\n${row.period.time}</td>${row.cells.map(cell => `<td>${entryHtml(cell)}</td>`).join("")}</tr>`).join("");
}
function teacherView(record) {
  kind.textContent = "教師課表";
  title.textContent = `${record.id} ${record.name}`;
  meta.textContent = "點選班級可返回班級課表";
  const reference = data.classes[0].rows;
  const slots = new Map();
  record.sessions.forEach(item => { const key = `${item.day}-${item.row}`; slots.set(key, [...(slots.get(key) || []), item]); });
  tableBody.innerHTML = reference.map((row, rowIndex) => {
    const cells = data.meta.days.map((_, dayIndex) => {
      const items = slots.get(`${dayIndex}-${rowIndex}`) || [];
      if (!items.length) return "<td></td>";
      return `<td>${items.map(item => { const run = data.classes.find(c => c.id === item.classId)?.rows[rowIndex]?.cells[dayIndex]?.runningClass; const place = item.linkable === false ? `<span class="location">${item.className}</span>` : `<button class="schedule-link" data-class="${item.classId}">${item.className}</button>`; return `<div class="course">${item.subject}</div>${run ? '<span class="badge">跑班</span>' : ""}${item.note ? `<div class="note">${item.note}</div>` : ""}<div class="teacher">${place}</div>`; }).join('<hr class="cell-divider">')}</td>`;
    }).join("");
    return `<tr><td>${row.period.name}\n${row.period.time}</td>${cells}</tr>`;
  }).join("");
}
function render() {
  if (viewType.value === "class") classView(byId(picker.value));
  else teacherView(teacher(picker.value));
}
function populate(preferred) {
  const classes = viewType.value === "class";
  const records = classes ? data.classes : data.teachers;
  pickerLabel.textContent = classes ? "選擇班級" : "選擇教師";
  picker.innerHTML = records.map(item => `<option value="${classes ? item.id : item.name}">${classes ? `${item.name} ${item.publicCode}` : `${item.id} ${item.name}`}</option>`).join("");
  if (preferred) picker.value = preferred;
  render();
}
viewType.addEventListener("change", () => populate());
picker.addEventListener("change", render);
document.addEventListener("click", event => {
  const target = event.target.closest(".schedule-link");
  if (!target) return;
  if (target.dataset.teacher) { viewType.value = "teacher"; populate(target.dataset.teacher); }
  if (target.dataset.class) { viewType.value = "class"; populate(target.dataset.class); }
});
document.querySelector("#theme-toggle").addEventListener("click", () => {
  const isDark = document.documentElement.dataset.theme === "dark";
  document.documentElement.dataset.theme = isDark ? "" : "dark";
  document.querySelector("#theme-toggle").textContent = isDark ? "夜間閱讀" : "日間閱讀";
});
populate();
