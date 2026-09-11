/* ---------- stored data ---------- */

/* reads saved data; broken or missing data falls back to an empty list */
function load(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return fallback;

    var value = JSON.parse(raw);
    if (!value) return fallback;

    /* the app expects lists, so anything else is treated as empty */
    if (Array.isArray(fallback) && !Array.isArray(value)) return fallback;

    return value;
  } catch (e) {
    console.error("Study OS ignored broken saved data in " + key, e);
    return fallback;
  }
}

/* throws away saved entries that are not objects (null, numbers, strings) */
function cleanList(list) {
  var clean = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] && typeof list[i] == "object") clean.push(list[i]);
  }
  return clean;
}

var tasks = cleanList(load("studyTasks", []));
var subjects = cleanList(load("studySubjects", []));
var exams = cleanList(load("studyExams", []));
var sessions = cleanList(load("studySessions", []));

function saveTasks() { localStorage.setItem("studyTasks", JSON.stringify(tasks)); }
function saveSubjects() { localStorage.setItem("studySubjects", JSON.stringify(subjects)); }
function saveExams() { localStorage.setItem("studyExams", JSON.stringify(exams)); }
function saveSessions() { localStorage.setItem("studySessions", JSON.stringify(sessions)); }

function uid() {
  return Date.now() + "-" + Math.floor(Math.random() * 100000);
}

/* used before putting user text into innerHTML */
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- dates ---------- */

function pad(n) { return String(n).padStart(2, "0"); }

function toISO(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function todayStr() { return toISO(new Date()); }

function parseDate(s) {
  var p = String(s).split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function daysUntil(dateStr) {
  if (!dateStr) return 0;
  var diff = parseDate(dateStr) - parseDate(todayStr());
  return Math.round(diff / 86400000);
}

function fmtShort(s) {
  return parseDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDuration(sec) {
  var h = Math.floor(sec / 3600);
  var m = Math.round((sec % 3600) / 60);
  if (h && m) return h + "h " + m + "m";
  if (h) return h + "h";
  return m + " min";
}

function fmtClock(sec) {
  var h = Math.floor(sec / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var s = sec % 60;
  return pad(h) + ":" + pad(m) + ":" + pad(s);
}

function toast(msg) {
  var old = document.querySelector(".toast");
  if (old) old.remove();

  var el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 2000);
}

/* ---------- subjects ---------- */

function addSubject(name, color) {
  if (!name) return;
  var lower = String(name).toLowerCase();

  for (var i = 0; i < subjects.length; i++) {
    if (subjects[i].name.toLowerCase() == lower) {
      if (color) subjects[i].color = color;
      saveSubjects();
      refreshSubjectOptions();
      return;
    }
  }

  subjects.push({ id: uid(), name: name, color: color || "#2c6e49" });
  saveSubjects();
  refreshSubjectOptions();
}

function deleteSubject(id) {
  for (var i = 0; i < subjects.length; i++) {
    if (subjects[i].id == id) { subjects.splice(i, 1); break; }
  }
  saveSubjects();
  refreshSubjectOptions();
}

function subjectColor(name) {
  if (!name) return null;
  var lower = String(name).toLowerCase();
  for (var i = 0; i < subjects.length; i++) {
    if (subjects[i].name.toLowerCase() == lower) return subjects[i].color;
  }
  return null;
}

/* fills the datalist used by the subject inputs */
function refreshSubjectOptions() {
  var dl = document.getElementById("subjectOptions");
  if (!dl) return;

  var html = "";
  for (var i = 0; i < subjects.length; i++) {
    html += '<option value="' + esc(subjects[i].name) + '"></option>';
  }
  dl.innerHTML = html;
}

/* ---------- tasks ---------- */

function findTask(id) {
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id == id) return tasks[i];
  }
  return null;
}

function toggleTask(id) {
  var t = findTask(id);
  if (!t) return;
  t.done = !t.done;
  saveTasks();
  renderCurrent();
}

function deleteTask(id) {
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id == id) { tasks.splice(i, 1); break; }
  }
  saveTasks();
  if (editingTaskId == id) editingTaskId = null;
}

/* unfinished first, then by due date */
function sortTasks(list) {
  var sorted = list.slice();
  sorted.sort(function (a, b) {
    if (a.done != b.done) return a.done ? 1 : -1;
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  });
  return sorted;
}

function dueLabel(due) {
  var diff = daysUntil(due);
  if (diff < 0) return "overdue";
  if (diff == 0) return "today";
  if (diff == 1) return "tomorrow";
  return fmtShort(due);
}

/* one task line, used by home, tasks and planner */
function taskRow(t) {
  var color = subjectColor(t.subject);
  var overdue = !t.done && t.due && t.due < todayStr();

  var title = esc(t.title);
  if (color) title = '<span class="dot" style="background:' + color + '"></span>' + title;

  var meta = "";
  if (t.subject) meta += "<span>" + esc(t.subject) + "</span>";
  if (t.due) {
    if (meta) meta += " · ";
    meta += '<span class="' + (overdue ? "overdue" : "") + '">' + dueLabel(t.due) + "</span>";
  }

  return '<div class="row task-row' + (t.done ? " done" : "") + '">' +
    '<input type="checkbox"' + (t.done ? " checked" : "") + ' onchange="toggleTask(\'' + t.id + '\')">' +
    '<div class="grow">' +
      '<div class="task-title">' + title + '</div>' +
      (meta ? '<div class="task-meta">' + meta + '</div>' : "") +
    '</div>' +
    '<div class="task-actions">' +
      '<button type="button" class="text-btn" onclick="startEditTask(\'' + t.id + '\')">edit</button>' +
      '<button type="button" class="text-btn danger" onclick="confirmDeleteTask(\'' + t.id + '\')">delete</button>' +
    '</div>' +
  '</div>';
}

/* ---------- exams ---------- */

function findExam(id) {
  for (var i = 0; i < exams.length; i++) {
    if (exams[i].id == id) return exams[i];
  }
  return null;
}

function nextExam() {
  var upcoming = [];
  for (var i = 0; i < exams.length; i++) {
    if (daysUntil(exams[i].date) >= 0) upcoming.push(exams[i]);
  }
  upcoming.sort(function (a, b) { return a.date.localeCompare(b.date); });
  return upcoming.length ? upcoming[0] : null;
}

/* ---------- study sessions ---------- */

function addSession(subject, seconds) {
  sessions.push({
    id: uid(),
    subject: subject || "",
    seconds: seconds,
    date: todayStr(),
    at: Date.now()
  });
  saveSessions();
}

function sessionsOn(dateStr) {
  var list = [];
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].date == dateStr) list.push(sessions[i]);
  }
  return list;
}

function secondsOn(dateStr) {
  var total = 0;
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].date == dateStr) total += sessions[i].seconds;
  }
  return total;
}

/* ---------- navigation ---------- */

var VIEWS = ["home", "focus", "planner", "tasks", "exams", "subjects"];
var currentView = "home";

function navigate(view) {
  if (VIEWS.indexOf(view) == -1) view = "home";
  currentView = view;

  var links = document.querySelectorAll(".nav-link");
  for (var i = 0; i < links.length; i++) {
    if (links[i].dataset.nav == view) links[i].classList.add("active");
    else links[i].classList.remove("active");
  }

  for (var j = 0; j < VIEWS.length; j++) {
    var page = document.getElementById("view-" + VIEWS[j]);
    if (!page) continue;
    if (VIEWS[j] == view) page.classList.add("active");
    else page.classList.remove("active");
  }

  if (location.hash != "#" + view) location.hash = view;
  renderCurrent();
}

/* drawing a page is wrapped so one broken page cannot blank the whole app */
function renderCurrent() {
  var page = document.getElementById("view-" + currentView);

  try {
    if (currentView == "home") renderHome();
    else if (currentView == "focus") renderFocus();
    else if (currentView == "planner") renderPlanner();
    else if (currentView == "tasks") renderTasks();
    else if (currentView == "exams") renderExams();
    else if (currentView == "subjects") renderSubjects();
  } catch (err) {
    console.error("Study OS could not draw " + currentView, err);
    if (page) {
      page.innerHTML = '<p class="empty-msg">This page could not be drawn. ' +
        "The rest of Study OS still works.</p>";
    }
  }
}

/* ---------- home ---------- */

function renderHome() {
  var el = document.getElementById("view-home");
  if (!el) return;

  var today = todayStr();
  var hour = new Date().getHours();
  var greet = hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";

  var dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });

  var todays = [];
  for (var i = 0; i < tasks.length; i++) {
    if (!tasks[i].done && tasks[i].due && tasks[i].due <= today) todays.push(tasks[i]);
  }
  todays = sortTasks(todays);

  var todayHTML = '<p class="empty-msg">Nothing due today.</p>';
  if (todays.length) {
    todayHTML = "";
    var showCount = Math.min(todays.length, 6);
    for (var i = 0; i < showCount; i++) todayHTML += taskRow(todays[i]);
    if (todays.length > 6) {
      todayHTML += '<p class="muted">…and ' + (todays.length - 6) + " more in Tasks.</p>";
    }
  }

  var leftWord = todays.length
    ? todays.length + " thing" + (todays.length == 1 ? "" : "s") + " left"
    : "all clear";

  var ne = nextExam();
  var examHTML = '<p class="empty-msg">No exams scheduled.</p>';
  if (ne) {
    var diff = daysUntil(ne.date);
    var when = diff == 0 ? "today!"
      : diff == 1 ? "tomorrow"
      : fmtShort(ne.date) + " · in " + diff + " days";

    examHTML = '<div class="row">' +
      '<div class="grow"><span class="task-title">' + esc(ne.name) + "</span>" +
        (ne.subject ? '<span class="tag">' + esc(ne.subject) + "</span>" : "") +
      "</div>" +
      '<span class="exam-when">' + when + "</span>" +
    "</div>";
  }

  var todaySessions = sessionsOn(today);
  var focusHTML = '<p class="empty-msg">No study time yet today.</p>';
  if (todaySessions.length) {
    focusHTML = '<div class="row">' +
      '<div class="grow"><span class="task-title">' + fmtDuration(secondsOn(today)) + " studied</span></div>" +
      '<span class="muted">' + todaySessions.length + " session" + (todaySessions.length == 1 ? "" : "s") + "</span>" +
    "</div>";
  }

  var openCount = 0;
  for (var i = 0; i < tasks.length; i++) {
    if (!tasks[i].done) openCount++;
  }

  var totalStudied = 0;
  for (var i = 0; i < sessions.length; i++) totalStudied += sessions[i].seconds;

  el.innerHTML =
    '<div class="greeting">' +
      "<h1>" + greet + "</h1>" +
      '<p class="date-line">' + dateStr + "</p>" +
    "</div>" +
    '<div class="home-content">' +
      '<section class="section">' +
        '<div class="section-head"><h2>Today</h2><span class="note">' + leftWord + "</span></div>" +
        todayHTML +
      "</section>" +
      '<section class="section">' +
        '<div class="section-head"><h2>Next exam</h2>' +
          '<button type="button" class="text-btn" onclick="navigate(\'exams\')">all exams</button></div>' +
        examHTML +
      "</section>" +
      '<section class="section">' +
        '<div class="section-head"><h2>Focus</h2>' +
          '<button type="button" class="text-btn" onclick="navigate(\'focus\')">open timer</button></div>' +
        focusHTML +
      "</section>" +
      '<section class="section home-sidebar">' +
        '<div class="box">' +
          "<h3>Quick look</h3>" +
          '<div class="quick-row"><span>Open tasks</span><span class="mono">' + openCount + "</span></div>" +
          '<div class="quick-row"><span>Subjects</span><span class="mono">' + subjects.length + "</span></div>" +
          '<div class="quick-row no-border"><span>Total studied</span><span class="mono">' + fmtDuration(totalStudied) + "</span></div>" +
        "</div>" +
      "</section>" +
    "</div>";
}

/* ---------- planner ---------- */

var calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
var selectedDay = todayStr();

function shiftMonth(n) {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1);
  renderPlanner();
}

function pickDay(iso) {
  selectedDay = iso;
  renderPlanner();
}

function calCells() {
  var y = calMonth.getFullYear();
  var m = calMonth.getMonth();
  var firstDay = new Date(y, m, 1).getDay();
  var daysInMonth = new Date(y, m + 1, 0).getDate();
  var today = todayStr();

  var cells = [];
  var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (var i = 0; i < dayNames.length; i++) {
    cells.push('<div class="cal-dow">' + dayNames[i] + "</div>");
  }

  for (var i = 0; i < firstDay; i++) {
    cells.push('<div class="cal-day other"></div>');
  }

  for (var d = 1; d <= daysInMonth; d++) {
    var iso = y + "-" + pad(m + 1) + "-" + pad(d);

    var cls = "cal-day";
    if (iso == today) cls += " today";
    if (iso == selectedDay) cls += " selected";

    var taskCount = 0;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].due == iso && !tasks[i].done) taskCount++;
    }

    var dots = "";
    for (var i = 0; i < Math.min(taskCount, 3); i++) dots += "<i></i>";
    if (dots) dots = '<span class="dots">' + dots + "</span>";

    cells.push('<div class="' + cls + '" onclick="pickDay(\'' + iso + '\')">' +
      '<span class="num">' + d + "</span>" + dots + "</div>");
  }

  return cells.join("");
}

function renderPlanner() {
  var el = document.getElementById("view-planner");
  if (!el) return;

  var dayTasks = [];
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].due == selectedDay) dayTasks.push(tasks[i]);
  }
  dayTasks = sortTasks(dayTasks);

  var dayHTML = dayTasks.length ? "" : '<p class="empty-msg">Nothing scheduled this day.</p>';
  for (var i = 0; i < dayTasks.length; i++) dayHTML += taskRow(dayTasks[i]);

  var monthLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  var weekday = parseDate(selectedDay).toLocaleDateString("en-US", { weekday: "long" });
  var dateLabel = parseDate(selectedDay).toLocaleDateString("en-US", { month: "long", day: "numeric" });

  el.innerHTML =
    '<div class="page-head"><h1>Planner</h1><p>Pick a day to see what is on it.</p></div>' +
    '<div class="planner-content">' +
      '<div class="cal">' +
        '<div class="cal-head">' +
          '<button type="button" class="btn ghost small" onclick="shiftMonth(-1)">&larr;</button>' +
          "<h2>" + monthLabel + "</h2>" +
          '<button type="button" class="btn ghost small" onclick="shiftMonth(1)">&rarr;</button>' +
        "</div>" +
        '<div class="cal-grid">' + calCells() + "</div>" +
      "</div>" +
      '<div class="box day-detail">' +
        "<h3>" + weekday + ", " + dateLabel + "</h3>" +
        dayHTML +
      "</div>" +
    "</div>";
}

/* ---------- tasks page ---------- */

var taskFilter = "all";
var editingTaskId = null;

function setFilter(f) {
  taskFilter = f;
  renderTasks();
}

function getFilteredTasks() {
  var today = todayStr();
  var list = [];

  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    if (taskFilter == "today" && t.due == today) list.push(t);
    else if (taskFilter == "upcoming" && !t.done && t.due && t.due > today) list.push(t);
    else if (taskFilter == "overdue" && !t.done && t.due && t.due < today) list.push(t);
    else if (taskFilter == "done" && t.done) list.push(t);
    else if (taskFilter == "all") list.push(t);
  }

  return sortTasks(list);
}

function renderTasks() {
  var el = document.getElementById("view-tasks");
  if (!el) return;

  var filterNames = ["all", "today", "upcoming", "overdue", "done"];
  var filtersHTML = "";
  for (var i = 0; i < filterNames.length; i++) {
    var f = filterNames[i];
    var cls = "text-btn" + (f == taskFilter ? " active" : "");
    filtersHTML += '<button type="button" class="' + cls + '" onclick="setFilter(\'' + f + '\')">' +
      f.charAt(0).toUpperCase() + f.slice(1) + "</button>";
  }

  var list = getFilteredTasks();
  var emptyMsg = "Nothing here. Try another filter.";
  if (!tasks.length) emptyMsg = "No tasks yet. Add one above.";
  if (taskFilter == "done") emptyMsg = "Nothing completed yet.";

  var rowsHTML = '<p class="empty-msg">' + emptyMsg + "</p>";
  if (list.length) {
    rowsHTML = "";
    for (var i = 0; i < list.length; i++) rowsHTML += taskRow(list[i]);
  }

  el.innerHTML =
    '<div class="page-head"><h1>Tasks</h1><p>All your tasks, right here.</p></div>' +
    '<form class="add-form" onsubmit="submitTaskForm(event)">' +
      '<div class="form-row">' +
        '<div class="form-group grow2">' +
          '<label for="taskTitle">What needs doing?</label>' +
          '<input class="field" id="taskTitle" placeholder="e.g. Finish Biology worksheet" required>' +
        "</div>" +
        '<div class="form-group">' +
          '<label for="taskSubject">Subject</label>' +
          '<input class="field" id="taskSubject" list="subjectOptions" placeholder="optional">' +
        "</div>" +
        '<div class="form-group">' +
          '<label for="taskDue">Due date</label>' +
          '<input class="field" type="date" id="taskDue">' +
        "</div>" +
        '<div class="form-group">' +
          "<label>&nbsp;</label>" +
          '<button class="btn" id="taskSubmitBtn" type="submit">' +
            (editingTaskId ? "Save changes" : "Add task") +
          "</button>" +
        "</div>" +
      "</div>" +
      '<p class="edit-hint' + (editingTaskId ? "" : " hidden") + '" id="taskEditHint">' +
        'Editing a task — <button type="button" class="text-btn" onclick="cancelEditTask()">cancel</button>' +
      "</p>" +
    "</form>" +
    '<div class="filters">' + filtersHTML + "</div>" +
    rowsHTML;

  if (editingTaskId) fillTaskForm(findTask(editingTaskId));
}

function fillTaskForm(t) {
  if (!t) return;
  var titleEl = document.getElementById("taskTitle");
  var subjectEl = document.getElementById("taskSubject");
  var dueEl = document.getElementById("taskDue");
  if (!titleEl || !subjectEl || !dueEl) return;

  titleEl.value = t.title;
  subjectEl.value = t.subject || "";
  dueEl.value = t.due || "";
}

function submitTaskForm(e) {
  e.preventDefault();

  var titleEl = document.getElementById("taskTitle");
  var subjectEl = document.getElementById("taskSubject");
  var dueEl = document.getElementById("taskDue");
  if (!titleEl) return;

  var title = titleEl.value.trim();
  var subject = subjectEl ? subjectEl.value.trim() : "";
  var due = dueEl ? dueEl.value : "";

  if (!title) return;
  if (subject) addSubject(subject);

  if (editingTaskId) {
    var t = findTask(editingTaskId);
    if (t) {
      t.title = title;
      t.subject = subject;
      t.due = due;
    }
    saveTasks();
    editingTaskId = null;
  } else {
    tasks.push({ id: uid(), title: title, subject: subject, due: due, done: false });
    saveTasks();
  }

  renderTasks();
}

function startEditTask(id) {
  var t = findTask(id);
  if (!t) return;

  editingTaskId = id;

  /* the form only exists on the tasks page */
  if (currentView != "tasks") navigate("tasks");
  if (!document.getElementById("taskTitle")) renderTasks();

  fillTaskForm(t);

  var btn = document.getElementById("taskSubmitBtn");
  var hint = document.getElementById("taskEditHint");
  if (btn) btn.textContent = "Save changes";
  if (hint) hint.classList.remove("hidden");

  document.getElementById("taskTitle").focus();
}

function cancelEditTask() {
  editingTaskId = null;

  var titleEl = document.getElementById("taskTitle");
  var subjectEl = document.getElementById("taskSubject");
  var dueEl = document.getElementById("taskDue");
  var btn = document.getElementById("taskSubmitBtn");
  var hint = document.getElementById("taskEditHint");

  if (titleEl) titleEl.value = "";
  if (subjectEl) subjectEl.value = "";
  if (dueEl) dueEl.value = "";
  if (btn) btn.textContent = "Add task";
  if (hint) hint.classList.add("hidden");
}

function confirmDeleteTask(id) {
  if (!confirm("Delete this task?")) return;
  deleteTask(id);
  renderCurrent();
}

/* ---------- exams page ---------- */

var editingExamId = null;

function renderExams() {
  var el = document.getElementById("view-exams");
  if (!el) return;

  var sorted = exams.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });

  var rowsHTML = '<p class="empty-msg">No exams yet. Add one when a test comes up.</p>';
  if (sorted.length) {
    rowsHTML = "";
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i];
      var diff = daysUntil(e.date);

      var badge, cls;
      if (diff < 0) { badge = "passed"; cls = "past"; }
      else if (diff == 0) { badge = "today!"; cls = "soon"; }
      else if (diff == 1) { badge = "tomorrow!"; cls = "soon"; }
      else { badge = diff + " days"; cls = ""; }

      var dateFormatted = parseDate(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric" });
      var meta = e.subject ? esc(e.subject) + " · " + dateFormatted : dateFormatted;
      var notesHTML = e.notes ? '<div class="exam-notes">' + esc(e.notes) + "</div>" : "";

      rowsHTML +=
        '<div class="row">' +
          '<div class="grow">' +
            '<div class="task-title">' + esc(e.name) + "</div>" +
            '<div class="task-meta">' + meta + "</div>" +
            notesHTML +
          "</div>" +
          '<span class="countdown ' + cls + '">' + badge + "</span>" +
          '<div class="task-actions">' +
            '<button type="button" class="text-btn" onclick="startEditExam(\'' + e.id + '\')">edit</button>' +
            '<button type="button" class="text-btn danger" onclick="confirmDeleteExam(\'' + e.id + '\')">delete</button>' +
          "</div>" +
        "</div>";
    }
  }

  el.innerHTML =
    '<div class="page-head"><h1>Exams</h1><p>Tests and their dates.</p></div>' +
    '<form class="add-form" onsubmit="submitExamForm(event)">' +
      '<div class="form-row">' +
        '<div class="form-group grow2">' +
          '<label for="examName">Exam</label>' +
          '<input class="field" id="examName" placeholder="e.g. Biology midterm" required>' +
        "</div>" +
        '<div class="form-group">' +
          '<label for="examSubject">Subject</label>' +
          '<input class="field" id="examSubject" list="subjectOptions" placeholder="optional">' +
        "</div>" +
        '<div class="form-group">' +
          '<label for="examDate">Date</label>' +
          '<input class="field" type="date" id="examDate" required>' +
        "</div>" +
        '<div class="form-group grow2">' +
          '<label for="examNotes">Notes</label>' +
          '<input class="field" id="examNotes" placeholder="what is on it? (optional)">' +
        "</div>" +
        '<div class="form-group">' +
          "<label>&nbsp;</label>" +
          '<button class="btn" id="examSubmitBtn" type="submit">' +
            (editingExamId ? "Save changes" : "Add exam") +
          "</button>" +
        "</div>" +
      "</div>" +
      '<p class="edit-hint' + (editingExamId ? "" : " hidden") + '" id="examEditHint">' +
        'Editing an exam — <button type="button" class="text-btn" onclick="cancelEditExam()">cancel</button>' +
      "</p>" +
    "</form>" +
    rowsHTML;

  if (editingExamId) fillExamForm(findExam(editingExamId));
}

function fillExamForm(e) {
  if (!e) return;
  var nameEl = document.getElementById("examName");
  var subjectEl = document.getElementById("examSubject");
  var dateEl = document.getElementById("examDate");
  var notesEl = document.getElementById("examNotes");
  if (!nameEl || !dateEl) return;

  nameEl.value = e.name;
  if (subjectEl) subjectEl.value = e.subject || "";
  dateEl.value = e.date;
  if (notesEl) notesEl.value = e.notes || "";
}

function submitExamForm(e) {
  e.preventDefault();

  var nameEl = document.getElementById("examName");
  var subjectEl = document.getElementById("examSubject");
  var dateEl = document.getElementById("examDate");
  var notesEl = document.getElementById("examNotes");
  if (!nameEl || !dateEl) return;

  var name = nameEl.value.trim();
  var subject = subjectEl ? subjectEl.value.trim() : "";
  var date = dateEl.value;
  var notes = notesEl ? notesEl.value.trim() : "";

  if (!name || !date) return;
  if (subject) addSubject(subject);

  if (editingExamId) {
    var exam = findExam(editingExamId);
    if (exam) {
      exam.name = name;
      exam.subject = subject;
      exam.date = date;
      exam.notes = notes;
    }
    saveExams();
    editingExamId = null;
  } else {
    exams.push({ id: uid(), name: name, subject: subject, date: date, notes: notes });
    saveExams();
  }

  renderExams();
}

function startEditExam(id) {
  var exam = findExam(id);
  if (!exam) return;

  editingExamId = id;

  if (currentView != "exams") navigate("exams");
  if (!document.getElementById("examName")) renderExams();

  fillExamForm(exam);

  var btn = document.getElementById("examSubmitBtn");
  var hint = document.getElementById("examEditHint");
  if (btn) btn.textContent = "Save changes";
  if (hint) hint.classList.remove("hidden");

  document.getElementById("examName").focus();
}

function cancelEditExam() {
  editingExamId = null;

  var nameEl = document.getElementById("examName");
  var subjectEl = document.getElementById("examSubject");
  var dateEl = document.getElementById("examDate");
  var notesEl = document.getElementById("examNotes");
  var btn = document.getElementById("examSubmitBtn");
  var hint = document.getElementById("examEditHint");

  if (nameEl) nameEl.value = "";
  if (subjectEl) subjectEl.value = "";
  if (dateEl) dateEl.value = "";
  if (notesEl) notesEl.value = "";
  if (btn) btn.textContent = "Add exam";
  if (hint) hint.classList.add("hidden");
}

function confirmDeleteExam(id) {
  if (!confirm("Delete this exam?")) return;
  for (var i = 0; i < exams.length; i++) {
    if (exams[i].id == id) { exams.splice(i, 1); break; }
  }
  saveExams();
  if (editingExamId == id) editingExamId = null;
  renderExams();
}

/* ---------- subjects page ---------- */

function renderSubjects() {
  var el = document.getElementById("view-subjects");
  if (!el) return;

  var cardsHTML = '<p class="empty-msg">No subjects yet. Add your classes here.</p>';
  if (subjects.length) {
    cardsHTML = '<div class="subject-grid">';
    for (var i = 0; i < subjects.length; i++) {
      var s = subjects[i];
      var lower = s.name.toLowerCase();

      var openCount = 0;
      for (var j = 0; j < tasks.length; j++) {
        if (!tasks[j].done && tasks[j].subject && tasks[j].subject.toLowerCase() == lower) openCount++;
      }

      var studied = 0;
      for (var j = 0; j < sessions.length; j++) {
        if (sessions[j].subject && sessions[j].subject.toLowerCase() == lower) studied += sessions[j].seconds;
      }

      var stats = openCount + " open task" + (openCount == 1 ? "" : "s") + " · ";
      stats += studied ? fmtDuration(studied) + " studied" : "no study time yet";

      cardsHTML +=
        '<div class="subject-item">' +
          '<div class="subject-header">' +
            '<span class="swatch" style="background:' + s.color + '"></span>' +
            '<span class="subject-name">' + esc(s.name) + "</span>" +
            '<button type="button" class="text-btn danger" onclick="confirmDeleteSubject(\'' + s.id + '\')">delete</button>' +
          "</div>" +
          '<p class="subject-stats">' + stats + "</p>" +
        "</div>";
    }
    cardsHTML += "</div>";
  }

  el.innerHTML =
    '<div class="page-head"><h1>Subjects</h1><p>Your classes. Colors help you spot them in task lists.</p></div>' +
    '<form class="add-form" onsubmit="submitSubjectForm(event)">' +
      '<div class="form-row">' +
        '<div class="form-group grow2">' +
          '<label for="subjectName">Subject</label>' +
          '<input class="field" id="subjectName" placeholder="e.g. Biology" required>' +
        "</div>" +
        '<div class="form-group">' +
          '<label for="subjectColor">Color</label>' +
          '<input class="field" type="color" id="subjectColor" value="#2c6e49">' +
        "</div>" +
        '<div class="form-group">' +
          "<label>&nbsp;</label>" +
          '<button class="btn" type="submit">Add subject</button>' +
        "</div>" +
      "</div>" +
    "</form>" +
    cardsHTML;
}

function submitSubjectForm(e) {
  e.preventDefault();

  var nameEl = document.getElementById("subjectName");
  var colorEl = document.getElementById("subjectColor");
  if (!nameEl) return;

  var name = nameEl.value.trim();
  var color = colorEl ? colorEl.value : "#2c6e49";
  if (!name) return;

  addSubject(name, color);
  nameEl.value = "";
  renderSubjects();
}

function confirmDeleteSubject(id) {
  if (!confirm("Delete this subject?")) return;
  deleteSubject(id);
  renderSubjects();
}

/* ---------- focus timer ---------- */

var PRESETS = [15, 25, 45, 60];
var focusDuration = 25;
var timer = { running: false, total: 0, left: 0, subject: "", endAt: 0 };

function setDuration(m) {
  focusDuration = m;
  renderFocus();
}

function saveTimerState() {
  localStorage.setItem("studyTimer", JSON.stringify({
    endAt: timer.running ? timer.endAt : 0,
    total: timer.total,
    subject: timer.subject,
    left: timer.left,
    running: timer.running
  }));
}

function startTimer() {
  var sel = document.getElementById("focusSubject");

  timer.subject = sel ? sel.value : "";
  timer.total = focusDuration * 60;
  timer.left = timer.total;
  timer.running = true;
  timer.endAt = Date.now() + timer.left * 1000;

  saveTimerState();
  renderFocus();
}

function startTicker() {
  clearInterval(timer.interval);
  timer.interval = setInterval(tick, 1000);
}

function tick() {
  timer.left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));

  var clock = document.getElementById("timerClock");
  var fill = document.getElementById("timerFill");

  if (clock) clock.textContent = fmtClock(timer.left);
  if (fill) {
    var pct = timer.total > 0 ? Math.round((timer.left / timer.total) * 100) : 0;
    fill.style.width = pct + "%";
  }

  if (timer.left <= 0) finishTimer();
}

function pauseTimer() {
  timer.running = false;
  timer.left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
  clearInterval(timer.interval);
  saveTimerState();
  renderFocus();
}

function resumeTimer() {
  if (timer.left <= 0) return;
  timer.endAt = Date.now() + timer.left * 1000;
  timer.running = true;
  saveTimerState();
  renderFocus();
}

function resetTimer() {
  timer.running = false;
  timer.left = 0;
  timer.total = 0;
  clearInterval(timer.interval);
  localStorage.removeItem("studyTimer");
  renderFocus();
}

function finishTimer() {
  var subject = timer.subject;
  var total = timer.total;

  timer.running = false;
  timer.left = 0;
  timer.total = 0;
  clearInterval(timer.interval);
  localStorage.removeItem("studyTimer");

  addSession(subject, total);
  toast("Session logged!");
  renderFocus();
}

/* brings a timer back after a page refresh */
function restoreTimer() {
  var saved = load("studyTimer", null);
  if (!saved || !saved.total) return;

  var left = saved.running === false
    ? saved.left
    : Math.round((saved.endAt - Date.now()) / 1000);

  if (left > 0) {
    timer.total = saved.total;
    timer.left = left;
    timer.subject = saved.subject || "";
    timer.endAt = saved.running === false ? Date.now() + left * 1000 : saved.endAt;
    timer.running = saved.running !== false;
  } else {
    localStorage.removeItem("studyTimer");
    addSession(saved.subject || "", saved.total);
  }
}

function renderFocus() {
  var el = document.getElementById("view-focus");
  if (!el) return;

  var today = todayStr();
  var todaySessions = sessionsOn(today);
  var todaySecs = secondsOn(today);

  var recent = sessions.slice().sort(function (a, b) { return b.at - a.at; }).slice(0, 8);
  var sessionHTML = '<p class="empty-msg">No sessions yet.</p>';
  if (recent.length) {
    sessionHTML = "";
    for (var i = 0; i < recent.length; i++) {
      sessionHTML +=
        '<div class="row">' +
          '<div class="grow"><span class="task-title">' + esc(recent[i].subject || "Focus session") + "</span></div>" +
          '<span class="muted">' + fmtDuration(recent[i].seconds) + "</span>" +
        "</div>";
    }
  }

  var timerHTML = "";
  if (timer.running || timer.left > 0) {
    var pct = timer.total > 0 ? Math.round((timer.left / timer.total) * 100) : 0;

    timerHTML =
      '<h2 class="timer-subject">' + esc(timer.subject || "Focus") + "</h2>" +
      '<div class="timer-clock" id="timerClock">' + fmtClock(timer.left) + "</div>" +
      '<div class="timer-progress"><div class="fill" id="timerFill" style="width:' + pct + '%"></div></div>' +
      '<div class="timer-controls">' +
        (timer.running
          ? '<button type="button" class="btn ghost" onclick="pauseTimer()">Pause</button>'
          : '<button type="button" class="btn" onclick="resumeTimer()">Resume</button>') +
        '<button type="button" class="btn ghost" onclick="resetTimer()">Reset</button>' +
      "</div>";
  } else {
    var presetsHTML = "";
    for (var i = 0; i < PRESETS.length; i++) {
      var m = PRESETS[i];
      var cls = "btn ghost small preset" + (m == focusDuration ? " active" : "");
      presetsHTML += '<button type="button" class="' + cls + '" onclick="setDuration(' + m + ')">' + m + " min</button>";
    }

    var optionsHTML = '<option value="">— none —</option>';
    for (var i = 0; i < subjects.length; i++) {
      var n = esc(subjects[i].name);
      optionsHTML += '<option value="' + n + '">' + n + "</option>";
    }

    timerHTML =
      "<h2>Ready to focus?</h2>" +
      '<p class="muted">Pick a length and a subject, then start.</p>' +
      '<div class="presets">' + presetsHTML + "</div>" +
      '<div class="form-group">' +
        '<label for="focusSubject">Subject (optional)</label>' +
        '<select class="field" id="focusSubject">' + optionsHTML + "</select>" +
      "</div>" +
      '<button type="button" class="btn" onclick="startTimer()">Start</button>';
  }

  el.innerHTML =
    '<div class="page-head"><h1>Focus</h1><p>Set a timer and study one thing at a time.</p></div>' +
    '<div class="focus-layout">' +
      '<div class="timer-box">' + timerHTML + "</div>" +
      '<div class="focus-sidebar">' +
        '<section class="section">' +
          '<div class="section-head"><h2>Today</h2></div>' +
          '<div class="stats-row">' +
            '<div class="stat"><span class="stat-num">' + fmtClock(todaySecs) + '</span><span class="stat-label">time studied</span></div>' +
            '<div class="stat"><span class="stat-num">' + todaySessions.length + '</span><span class="stat-label">sessions</span></div>' +
          "</div>" +
        "</section>" +
        '<section class="section">' +
          '<div class="section-head"><h2>Recent sessions</h2></div>' +
          sessionHTML +
        "</section>" +
      "</div>" +
    "</div>";

  if (timer.running) startTicker();
}

/* ---------- start ---------- */

function startApp() {
  /* the header always works, even if the saved data turns out to be broken */
  var brand = document.getElementById("brandBtn");
  if (brand) brand.addEventListener("click", function () { navigate("home"); });

  var links = document.querySelectorAll(".nav-link");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function () {
      navigate(this.dataset.nav || "home");
    });
  }

  /* back / forward buttons and typed links keep working */
  window.addEventListener("hashchange", function () {
    var view = location.hash.slice(1);
    if (VIEWS.indexOf(view) != -1 && view != currentView) navigate(view);
  });

  try {
    refreshSubjectOptions();
  } catch (err) {
    console.error("Study OS could not read the saved subjects", err);
  }

  try {
    restoreTimer();
  } catch (err) {
    console.error("Study OS could not restore the timer", err);
    localStorage.removeItem("studyTimer");
  }

  var startView = location.hash.slice(1);
  navigate(VIEWS.indexOf(startView) != -1 ? startView : "home");
}

/* the script tag sits at the end of <body>, so the DOM is already there */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
