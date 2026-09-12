var tasks = JSON.parse(localStorage.getItem("studyTasks") || "[]");
var subjects = JSON.parse(localStorage.getItem("studySubjects") || "[]");
var exams = JSON.parse(localStorage.getItem("studyExams") || "[]");
var sessions = JSON.parse(localStorage.getItem("studySessions") || "[]");

function save() {
  localStorage.setItem("studyTasks", JSON.stringify(tasks));
  localStorage.setItem("studySubjects", JSON.stringify(subjects));
  localStorage.setItem("studyExams", JSON.stringify(exams));
  localStorage.setItem("studySessions", JSON.stringify(sessions));
}

function uid() {
  return Date.now() + "-" + Math.floor(Math.random() * 100000);
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function pad(n) { return String(n).padStart(2, "0"); }

function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function parseDate(s) {
  var p = s.split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function daysUntil(dateStr) {
  var diff = parseDate(dateStr) - parseDate(todayStr());
  return Math.round(diff / 86400000);
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
  var el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 2000);
}

function addSubject(name, color) {
  for (var i = 0; i < subjects.length; i++) {
    if (subjects[i].name.toLowerCase() == name.toLowerCase()) {
      if (color) subjects[i].color = color;
      save();
      return;
    }
  }
  subjects.push({ id: uid(), name: name, color: color || "#2c6e49" });
  save();
  refreshSubjectOptions();
}

function deleteSubject(id) {
  if (!confirm("Delete this subject?")) return;
  for (var i = 0; i < subjects.length; i++) {
    if (subjects[i].id == id) { subjects.splice(i, 1); break; }
  }
  save();
  refreshSubjectOptions();
  renderSubjects();
}

function subjectColor(name) {
  for (var i = 0; i < subjects.length; i++) {
    if (subjects[i].name.toLowerCase() == String(name).toLowerCase()) {
      return subjects[i].color;
    }
  }
  return null;
}

function refreshSubjectOptions() {
  var dl = document.getElementById("subjectOptions");
  if (!dl) return;
  var html = "";
  for (var i = 0; i < subjects.length; i++) {
    html += '<option value="' + esc(subjects[i].name) + '"></option>';
  }
  dl.innerHTML = html;
}

function taskRow(t) {
  var color = subjectColor(t.subject);
  var title = esc(t.title);
  if (color) title = '<span class="dot" style="background:' + color + '"></span>' + title;

  var meta = "";
  if (t.subject) meta += esc(t.subject) + " ";
  if (t.due) {
    var diff = daysUntil(t.due);
    var label;
    if (diff < 0) label = "overdue";
    else if (diff == 0) label = "today";
    else if (diff == 1) label = "tomorrow";
    else label = parseDate(t.due).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (diff < 0) meta += '<span class="overdue">' + label + '</span>';
    else meta += "<span>" + label + "</span>";
  }

  return '<div class="row' + (t.done ? " done" : "") + '">' +
    '<input type="checkbox" ' + (t.done ? "checked" : "") + ' onchange="toggleTask(\'' + t.id + '\')">' +
    '<div class="grow">' +
      '<div class="title">' + title + '</div>' +
      '<div class="meta">' + meta + '</div>' +
    '</div>' +
    '<div class="actions">' +
      '<button class="link" onclick="editTask(\'' + t.id + '\')">edit</button>' +
      '<button class="link del" onclick="deleteTask(\'' + t.id + '\')">delete</button>' +
    '</div>' +
  '</div>';
}

function toggleTask(id) {
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id == id) {
      tasks[i].done = !tasks[i].done;
      break;
    }
  }
  save();
  renderCurrent();
}

function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id == id) { tasks.splice(i, 1); break; }
  }
  save();
  renderCurrent();
}

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

function nextExam() {
  var upcoming = [];
  for (var i = 0; i < exams.length; i++) {
    if (daysUntil(exams[i].date) >= 0) upcoming.push(exams[i]);
  }
  upcoming.sort(function (a, b) { return a.date.localeCompare(b.date); });
  return upcoming.length ? upcoming[0] : null;
}

function deleteExam(id) {
  if (!confirm("Delete this exam?")) return;
  for (var i = 0; i < exams.length; i++) {
    if (exams[i].id == id) { exams.splice(i, 1); break; }
  }
  save();
  renderExams();
}

function addSession(subject, seconds) {
  sessions.push({
    id: uid(), subject: subject || "", seconds: seconds,
    date: todayStr(), at: Date.now()
  });
  save();
}

function secondsToday() {
  var total = 0;
  var today = todayStr();
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].date == today) total += sessions[i].seconds;
  }
  return total;
}

var currentView = "home";

function navigate(view) {
  currentView = view;

  var links = document.querySelectorAll("nav a");
  for (var i = 0; i < links.length; i++) {
    if (links[i].dataset.nav == view) links[i].className = "active";
    else links[i].className = "";
  }

  var pages = document.querySelectorAll(".view");
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].id == "view-" + view) pages[i].className = "view active";
    else pages[i].className = "view";
  }

  location.hash = view;
  renderCurrent();
}

function renderCurrent() {
  if (currentView == "home") renderHome();
  else if (currentView == "focus") renderFocus();
  else if (currentView == "planner") renderPlanner();
  else if (currentView == "tasks") renderTasks();
  else if (currentView == "exams") renderExams();
  else if (currentView == "subjects") renderSubjects();
}

function renderHome() {
  var el = document.getElementById("view-home");
  var today = todayStr();

  var hour = new Date().getHours();
  var greet;
  if (hour < 12) greet = "Good morning.";
  else if (hour < 18) greet = "Good afternoon.";
  else greet = "Good evening.";

  var dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });

  var todays = [];
  for (var i = 0; i < tasks.length; i++) {
    if (!tasks[i].done && tasks[i].due && tasks[i].due <= today) todays.push(tasks[i]);
  }
  todays = sortTasks(todays);

  var todayHTML = "";
  if (todays.length) {
    var showCount = Math.min(todays.length, 6);
    for (var i = 0; i < showCount; i++) todayHTML += taskRow(todays[i]);
    if (todays.length > 6) {
      todayHTML += '<p class="muted">and ' + (todays.length - 6) + " more in Tasks.</p>";
    }
  } else {
    todayHTML = '<p class="empty">No tasks due today.</p>';
  }

  var leftWord = todays.length
    ? todays.length + " thing" + (todays.length == 1 ? "" : "s") + " left"
    : "all clear";

  var ne = nextExam();
  var examHTML;
  if (ne) {
    var diff = daysUntil(ne.date);
    var when;
    if (diff == 0) when = "today!";
    else if (diff == 1) when = "tomorrow";
    else when = parseDate(ne.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · in " + diff + " days";
    var tag = ne.subject ? '<span class="tag">' + esc(ne.subject) + "</span>" : "";
    examHTML = '<div class="row">' +
      '<div class="grow"><b>' + esc(ne.name) + '</b>' + tag + '</div>' +
      '<span class="exam-when">' + when + '</span>' +
    '</div>';
  } else {
    examHTML = '<p class="empty">No exams added yet.</p>';
  }

  var secs = secondsToday();
  var focusHTML;
  if (secs > 0) {
    var count = 0;
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].date == today) count++;
    }
    focusHTML = '<div class="row">' +
      '<div class="grow"><b>' + fmtDuration(secs) + " studied</b></div>" +
      '<span class="muted">' + count + " session" + (count == 1 ? "" : "s") + '</span>' +
    '</div>';
  } else {
    focusHTML = '<p class="empty">Haven\'t studied today yet.</p>';
  }

  var openCount = 0;
  for (var i = 0; i < tasks.length; i++) {
    if (!tasks[i].done) openCount++;
  }
  var totalStudied = 0;
  for (var i = 0; i < sessions.length; i++) {
    totalStudied += sessions[i].seconds;
  }

  el.innerHTML =
    '<div class="greeting">' +
      '<h1>' + greet + '</h1>' +
      '<p class="date-line">' + dateStr + '</p>' +
    '</div>' +
    '<div class="home-grid">' +
      '<div class="home-content">' +
        '<div class="section">' +
          '<div class="section-head"><h2>Today</h2><span class="muted">' + leftWord + '</span></div>' +
          todayHTML +
        '</div>' +
        '<div class="section">' +
          '<div class="section-head"><h2>Next exam</h2><button class="link" onclick="navigate(\'exams\')">all exams</button></div>' +
          examHTML +
        '</div>' +
        '<div class="section">' +
          '<div class="section-head"><h2>Focus</h2><button class="link" onclick="navigate(\'focus\')">open timer</button></div>' +
          focusHTML +
        '</div>' +
      '</div>' +
      '<div class="home-sidebar">' +
        '<div class="box">' +
          '<h3>Quick look</h3>' +
          '<div style="display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:5px 0">' +
            '<span>Open tasks</span><span>' + openCount + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:5px 0">' +
            '<span>Subjects</span><span>' + subjects.length + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;padding:5px 0">' +
            '<span>Total studied</span><span>' + fmtDuration(totalStudied) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

var calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
var selectedDay = todayStr();

function renderPlanner() {
  var el = document.getElementById("view-planner");

  var dayTasks = [];
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].due == selectedDay) dayTasks.push(tasks[i]);
  }
  dayTasks = sortTasks(dayTasks);

  var dayHTML = "";
  if (dayTasks.length) {
    for (var i = 0; i < dayTasks.length; i++) dayHTML += taskRow(dayTasks[i]);
  } else {
    dayHTML = '<p class="empty">No tasks on this day.</p>';
  }

  var monthLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  var weekday = parseDate(selectedDay).toLocaleDateString("en-US", { weekday: "long" });
  var dateLabel = parseDate(selectedDay).toLocaleDateString("en-US", { month: "long", day: "numeric" });

  el.innerHTML =
    '<div class="page-head"><h1>Planner</h1><p>Pick a day to see what is on it.</p></div>' +
    '<div class="planner-content">' +
      '<div class="cal">' +
        '<div class="cal-head">' +
          '<button class="plain" onclick="shiftMonth(-1)">←</button>' +
          '<h2>' + monthLabel + '</h2>' +
          '<button class="plain" onclick="shiftMonth(1)">→</button>' +
        '</div>' +
        '<div class="cal-grid">' + calCells() + '</div>' +
      '</div>' +
      '<div class="box day-detail">' +
        '<h3>' + weekday + ', ' + dateLabel + '</h3>' +
        dayHTML +
      '</div>' +
    '</div>';
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

    cells.push('<div class="' + cls + '" onclick="selectedDay=\'' + iso + '\';renderPlanner()"><span class="num">' + d + "</span>" + dots + "</div>");
  }

  return cells.join("");
}

function shiftMonth(n) {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1);
  renderPlanner();
}

var taskFilter = "all";
var editingTaskId = null;

function renderTasks() {
  var el = document.getElementById("view-tasks");

  var filterNames = ["all", "today", "upcoming", "overdue", "done"];
  var filtersHTML = "";
  for (var i = 0; i < filterNames.length; i++) {
    var f = filterNames[i];
    var label = f.charAt(0).toUpperCase() + f.slice(1);
    var cls = "plain";
    if (f == taskFilter) cls += " active";
    filtersHTML += '<button class="' + cls + '" onclick="taskFilter=\'' + f + '\';renderTasks()">' + label + "</button>";
  }

  var list = getFilteredTasks();
  var emptyMsg = "No tasks match this filter.";
  if (!tasks.length) emptyMsg = "No tasks yet. Add one above.";
  if (taskFilter == "done") emptyMsg = "Nothing completed yet.";

  var rowsHTML = "";
  if (list.length) {
    for (var i = 0; i < list.length; i++) rowsHTML += taskRow(list[i]);
  } else {
    rowsHTML = '<p class="empty">' + emptyMsg + "</p>";
  }

  el.innerHTML =
    '<div class="page-head"><h1>Tasks</h1><p>Your task list.</p></div>' +
    '<form onsubmit="submitTaskForm(event)">' +
      '<div class="form-row">' +
        '<div class="wide">' +
          '<label for="taskTitle">What needs doing?</label>' +
          '<input id="taskTitle" placeholder="e.g. Finish Biology worksheet" required>' +
        '</div>' +
        '<div>' +
          '<label for="taskSubject">Subject</label>' +
          '<input id="taskSubject" list="subjectOptions" placeholder="optional">' +
        '</div>' +
        '<div>' +
          '<label for="taskDue">Due date</label>' +
          '<input type="date" id="taskDue">' +
        '</div>' +
        '<div>' +
          '<label>&nbsp;</label>' +
          '<button id="taskSubmitBtn" type="submit">Add task</button>' +
        '</div>' +
      '</div>' +
      '<p class="edit-hint hidden" id="taskEditHint">Editing a task — <button type="button" class="link" onclick="editingTaskId=null;renderTasks()">cancel</button></p>' +
    '</form>' +
    '<div class="filters">' + filtersHTML + '</div>' +
    rowsHTML;
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

function submitTaskForm(e) {
  e.preventDefault();
  var title = document.getElementById("taskTitle").value.trim();
  var subject = document.getElementById("taskSubject").value.trim();
  var due = document.getElementById("taskDue").value;
  if (!title) return;
  if (subject) addSubject(subject);

  if (editingTaskId) {
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id == editingTaskId) {
        tasks[i].title = title;
        tasks[i].subject = subject;
        tasks[i].due = due;
        break;
      }
    }
    editingTaskId = null;
  } else {
    tasks.push({ id: uid(), title: title, subject: subject, due: due, done: false });
  }
  save();
  renderTasks();
}

function editTask(id) {
  if (!document.getElementById("taskTitle")) navigate("tasks");
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].id == id) {
      editingTaskId = id;
      document.getElementById("taskTitle").value = tasks[i].title;
      document.getElementById("taskSubject").value = tasks[i].subject || "";
      document.getElementById("taskDue").value = tasks[i].due || "";
      document.getElementById("taskSubmitBtn").textContent = "Save changes";
      document.getElementById("taskEditHint").classList.remove("hidden");
      document.getElementById("taskTitle").focus();
      return;
    }
  }
}

var editingExamId = null;

function renderExams() {
  var el = document.getElementById("view-exams");

  var sorted = exams.slice();
  sorted.sort(function (a, b) { return a.date.localeCompare(b.date); });

  var rowsHTML = "";
  if (sorted.length) {
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i];
      var diff = daysUntil(e.date);
      var badge, cls;
      if (diff < 0) { badge = "passed"; cls = "past"; }
      else if (diff == 0) { badge = "today!"; cls = "soon"; }
      else if (diff == 1) { badge = "tomorrow!"; cls = "soon"; }
      else { badge = diff + " days"; cls = ""; }

      var dateFormatted = parseDate(e.date).toLocaleDateString("en-US", { month: "long", day: "numeric" });
      var meta = dateFormatted;
      if (e.subject) meta = esc(e.subject) + " · " + dateFormatted;

      var notesHTML = "";
      if (e.notes) notesHTML = '<div class="exam-notes">' + esc(e.notes) + '</div>';

      rowsHTML +=
        '<div class="row">' +
          '<div class="grow">' +
            '<div class="title">' + esc(e.name) + '</div>' +
            '<div class="meta">' + meta + '</div>' +
            notesHTML +
          '</div>' +
          '<span class="countdown ' + cls + '">' + badge + '</span>' +
          '<div class="actions">' +
            '<button class="link" onclick="editExam(\'' + e.id + '\')">edit</button>' +
            '<button class="link del" onclick="deleteExam(\'' + e.id + '\')">delete</button>' +
          '</div>' +
        '</div>';
    }
  } else {
    rowsHTML = '<p class="empty">No exams yet.</p>';
  }

  el.innerHTML =
    '<div class="page-head"><h1>Exams</h1><p>Tests and their dates.</p></div>' +
    '<form onsubmit="submitExamForm(event)">' +
      '<div class="form-row">' +
        '<div class="wide">' +
          '<label for="examName">Exam</label>' +
          '<input id="examName" placeholder="e.g. Biology midterm" required>' +
        '</div>' +
        '<div>' +
          '<label for="examSubject">Subject</label>' +
          '<input id="examSubject" list="subjectOptions" placeholder="optional">' +
        '</div>' +
        '<div>' +
          '<label for="examDate">Date</label>' +
          '<input type="date" id="examDate" required>' +
        '</div>' +
        '<div class="wide">' +
          '<label for="examNotes">Notes</label>' +
          '<input id="examNotes" placeholder="what\'s on it? (optional)">' +
        '</div>' +
        '<div>' +
          '<label>&nbsp;</label>' +
          '<button id="examSubmitBtn" type="submit">Add exam</button>' +
        '</div>' +
      '</div>' +
      '<p class="edit-hint hidden" id="examEditHint">Editing an exam — <button type="button" class="link" onclick="editingExamId=null;renderExams()">cancel</button></p>' +
    '</form>' +
    rowsHTML;
}

function submitExamForm(e) {
  e.preventDefault();
  var name = document.getElementById("examName").value.trim();
  var subject = document.getElementById("examSubject").value.trim();
  var date = document.getElementById("examDate").value;
  var notes = document.getElementById("examNotes").value.trim();
  if (!name || !date) return;
  if (subject) addSubject(subject);

  if (editingExamId) {
    for (var i = 0; i < exams.length; i++) {
      if (exams[i].id == editingExamId) {
        exams[i].name = name;
        exams[i].subject = subject;
        exams[i].date = date;
        exams[i].notes = notes;
        break;
      }
    }
    editingExamId = null;
  } else {
    exams.push({ id: uid(), name: name, subject: subject, date: date, notes: notes });
  }
  save();
  renderExams();
}

function editExam(id) {
  for (var i = 0; i < exams.length; i++) {
    if (exams[i].id == id) {
      editingExamId = id;
      document.getElementById("examName").value = exams[i].name;
      document.getElementById("examSubject").value = exams[i].subject || "";
      document.getElementById("examDate").value = exams[i].date;
      document.getElementById("examNotes").value = exams[i].notes || "";
      document.getElementById("examSubmitBtn").textContent = "Save changes";
      document.getElementById("examEditHint").classList.remove("hidden");
      document.getElementById("examName").focus();
      return;
    }
  }
}

function renderSubjects() {
  var el = document.getElementById("view-subjects");

  var cardsHTML = "";
  if (subjects.length) {
    cardsHTML = '<div class="subject-grid">';
    for (var i = 0; i < subjects.length; i++) {
      var s = subjects[i];

      var openCount = 0;
      for (var j = 0; j < tasks.length; j++) {
        if (!tasks[j].done && tasks[j].subject && tasks[j].subject.toLowerCase() == s.name.toLowerCase()) openCount++;
      }

      var studied = 0;
      for (var j = 0; j < sessions.length; j++) {
        if (sessions[j].subject && sessions[j].subject.toLowerCase() == s.name.toLowerCase()) studied += sessions[j].seconds;
      }

      var stats = openCount + " open task" + (openCount == 1 ? "" : "s") + " · ";
      if (studied) stats += fmtDuration(studied) + " studied";
      else stats += "no study time yet";

      cardsHTML +=
        '<div class="subject">' +
          '<div style="display:flex;align-items:center">' +
            '<span class="swatch" style="background:' + s.color + '"></span>' +
            '<b style="flex:1">' + esc(s.name) + '</b>' +
            '<button class="link del" onclick="deleteSubject(\'' + s.id + '\')">delete</button>' +
          '</div>' +
          '<p class="meta">' + stats + '</p>' +
        '</div>';
    }
    cardsHTML += "</div>";
  } else {
    cardsHTML = '<p class="empty">No subjects yet.</p>';
  }

  el.innerHTML =
    '<div class="page-head"><h1>Subjects</h1><p>Your classes.</p></div>' +
    '<form onsubmit="submitSubjectForm(event)">' +
      '<div class="form-row">' +
        '<div class="wide">' +
          '<label for="subjectName">Subject</label>' +
          '<input id="subjectName" placeholder="e.g. Biology" required>' +
        '</div>' +
        '<div>' +
          '<label for="subjectColor">Color</label>' +
          '<input type="color" id="subjectColor" value="#2c6e49">' +
        '</div>' +
        '<div>' +
          '<label>&nbsp;</label>' +
          '<button type="submit">Add subject</button>' +
        '</div>' +
      '</div>' +
    '</form>' +
    cardsHTML;
}

function submitSubjectForm(e) {
  e.preventDefault();
  var name = document.getElementById("subjectName").value.trim();
  var color = document.getElementById("subjectColor").value;
  if (!name) return;
  addSubject(name, color);
  renderSubjects();
}

var PRESETS = [15, 25, 45, 60];
var focusDuration = 25;
var timer = {
  running: false,
  total: 0,
  left: 0,
  subject: "",
  endAt: 0,
  interval: null
};

function renderFocus() {
  var el = document.getElementById("view-focus");
  var todaySecs = secondsToday();
  var todayCount = 0;
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].date == todayStr()) todayCount++;
  }

  var recent = sessions.slice().reverse().slice(0, 8);
  var sessionHTML = "";
  if (recent.length) {
    for (var i = 0; i < recent.length; i++) {
      var s = recent[i];
      var name = s.subject || "Focus session";
      sessionHTML +=
        '<div class="row">' +
          '<div class="grow"><b>' + esc(name) + '</b></div>' +
          '<span class="muted">' + fmtDuration(s.seconds) + '</span>' +
        '</div>';
    }
  } else {
    sessionHTML = '<p class="empty">No sessions yet.</p>';
  }

  var timerHTML = "";
  if (timer.running || timer.left > 0) {
    var pct = timer.total > 0 ? Math.round((timer.left / timer.total) * 100) : 0;
    var pauseOrResume;
    if (timer.running) pauseOrResume = '<button class="plain" onclick="pauseTimer()">Pause</button>';
    else pauseOrResume = '<button onclick="resumeTimer()">Resume</button>';
    var subject = timer.subject || "Focus";
    timerHTML =
      '<p class="muted">' + esc(subject) + '</p>' +
      '<div class="timer-clock" id="timerClock">' + fmtClock(timer.left) + '</div>' +
      '<div class="timer-progress"><div class="fill" id="timerFill" style="width:' + pct + '%"></div></div>' +
      '<div class="timer-controls">' +
        pauseOrResume +
        '<button class="plain" onclick="resetTimer()">Reset</button>' +
      '</div>';
  } else {
    var presetsHTML = "";
    for (var i = 0; i < PRESETS.length; i++) {
      var m = PRESETS[i];
      var cls = "plain";
      if (m == focusDuration) cls += " active";
      presetsHTML += '<button class="' + cls + '" onclick="focusDuration=' + m + ';renderFocus()">' + m + " min</button>";
    }
    var optionsHTML = '<option value="">— none —</option>';
    for (var i = 0; i < subjects.length; i++) {
      var n = esc(subjects[i].name);
      optionsHTML += '<option value="' + n + '">' + n + "</option>";
    }
    timerHTML =
      '<h2>Ready to focus?</h2>' +
      '<p class="muted">Pick a length and a subject, then start.</p>' +
      '<div class="presets">' + presetsHTML + '</div>' +
      '<div>' +
        '<label for="focusSubject">Subject (optional)</label><br>' +
        '<select id="focusSubject">' + optionsHTML + '</select>' +
      '</div>' +
      '<p><button onclick="startTimer()">Start</button></p>';
  }

  el.innerHTML =
    '<div class="page-head"><h1>Focus</h1><p>Study in timed blocks.</p></div>' +
    '<div class="focus-layout">' +
      '<div class="timer-box">' + timerHTML + '</div>' +
      '<div class="focus-sidebar">' +
        '<div class="section">' +
          '<div class="section-head"><h2>Today</h2></div>' +
          '<div class="stats-row">' +
            '<div class="stat"><span class="stat-num">' + fmtClock(todaySecs) + '</span><span class="stat-label">time studied</span></div>' +
            '<div class="stat"><span class="stat-num">' + todayCount + '</span><span class="stat-label">sessions</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="section">' +
          '<div class="section-head"><h2>Recent sessions</h2></div>' +
          sessionHTML +
        '</div>' +
      '</div>' +
    '</div>';

  if (timer.running) startTicker();
}

function startTimer() {
  var sel = document.getElementById("focusSubject");
  if (sel) timer.subject = sel.value;
  timer.total = focusDuration * 60;
  timer.left = timer.total;
  timer.running = true;
  timer.endAt = Date.now() + timer.left * 1000;
  localStorage.setItem("studyTimer", JSON.stringify({
    endAt: timer.endAt, total: timer.total, subject: timer.subject,
    left: timer.left, running: true
  }));
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
  localStorage.setItem("studyTimer", JSON.stringify({
    endAt: 0, total: timer.total, subject: timer.subject,
    left: timer.left, running: false
  }));
  renderFocus();
}

function resumeTimer() {
  if (timer.left <= 0) return;
  timer.endAt = Date.now() + timer.left * 1000;
  timer.running = true;
  localStorage.setItem("studyTimer", JSON.stringify({
    endAt: timer.endAt, total: timer.total, subject: timer.subject,
    left: timer.left, running: true
  }));
  renderFocus();
}

function resetTimer() {
  timer.running = false;
  timer.left = 0;
  clearInterval(timer.interval);
  localStorage.removeItem("studyTimer");
  renderFocus();
}

function finishTimer() {
  timer.running = false;
  timer.left = 0;
  clearInterval(timer.interval);
  localStorage.removeItem("studyTimer");
  addSession(timer.subject, timer.total);
  toast("Session logged!");
  renderFocus();
}

function restoreTimer() {
  var saved = JSON.parse(localStorage.getItem("studyTimer") || "null");
  if (!saved) return;
  var left = saved.running === false
    ? saved.left
    : Math.round((saved.endAt - Date.now()) / 1000);
  if (left > 0) {
    timer.total = saved.total;
    timer.left = left;
    timer.subject = saved.subject || "";
    timer.endAt = saved.endAt;
    timer.running = saved.running !== false;
  } else {
    localStorage.removeItem("studyTimer");
    addSession(saved.subject || "", saved.total);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  refreshSubjectOptions();
  restoreTimer();

  var views = ["home", "focus", "planner", "tasks", "exams", "subjects"];
  var hash = location.hash.slice(1);
  if (views.indexOf(hash) != -1) navigate(hash);
  else navigate("home");
});
