function renderHome() {
  var el = document.getElementById("view-home");
  var today = todayStr();

  var hour = new Date().getHours();
  var greet;

  if (hour < 12) {
    greet = "Good morning.";
  } else if (hour < 18) {
    greet = "Good afternoon.";
  } else {
    greet = "Good evening.";
  }

  var dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  var todays = [];

  for (var i = 0; i < tasks.length; i++) {
    if (!tasks[i].done && tasks[i].due && tasks[i].due <= today) {
      todays.push(tasks[i]);
    }
  }

  todays = sortTasks(todays);

  var todayHTML = "";

  if (todays.length) {
    todayHTML = '<div class="list">';

    var showCount = Math.min(todays.length, 6);

    for (var i = 0; i < showCount; i++) {
      todayHTML += taskRow(todays[i]);
    }

    todayHTML += "</div>";

    if (todays.length > 6) {
      todayHTML += '<p class="muted">…and ' +
        (todays.length - 6) +
        " more in Tasks.</p>";
    }
  } else {
    todayHTML = '<p class="empty-msg">Nothing due today.</p>';
  }

  var leftWord;

  if (todays.length) {
    leftWord = todays.length +
      " thing" +
      (todays.length == 1 ? "" : "s") +
      " left";
  } else {
    leftWord = "all clear";
  }

  var ne = nextExam();
  var examHTML;

  if (ne) {
    var diff = daysUntil(ne.date);
    var when;

    if (diff == 0) {
      when = "today!";
    } else if (diff == 1) {
      when = "tomorrow";
    } else {
      when = fmtShort(ne.date) + " · in " + diff + " days";
    }

    var tag = ne.subject
      ? '<span class="tag">' + esc(ne.subject) + "</span>"
      : "";

    examHTML =
      '<div class="row">' +
        '<div class="grow">' +
          '<span class="task-title">' +
            esc(ne.name) +
          '</span>' +
          tag +
        '</div>' +
        '<span class="exam-when">' +
          when +
        '</span>' +
      '</div>';
  } else {
    examHTML = '<p class="empty-msg">No exams scheduled.</p>';
  }

  var secs = secondsToday();
  var focusHTML;

  if (secs > 0) {
    var count = sessionsToday();

    focusHTML =
      '<div class="row">' +
        '<div class="grow">' +
          '<span class="task-title">' +
            fmtDuration(secs) +
            " studied" +
          '</span>' +
        '</div>' +
        '<span class="muted">' +
          count +
          " session" +
          (count == 1 ? "" : "s") +
        '</span>' +
      '</div>';
  } else {
    focusHTML = '<p class="empty-msg">No study time yet today.</p>';
  }

  el.innerHTML =
    '<div class="greeting">' +
      '<div>' +
        '<h1>' + greet + '</h1>' +
      '</div>' +
      '<p class="date-line">' + dateStr + '</p>' +
    '</div>' +

    '<div class="home-grid">' +

      '<div class="home-content">' +

        '<section class="section">' +
          '<div class="section-head">' +
            '<h2>Today</h2>' +
            '<span class="note">' + leftWord + '</span>' +
          '</div>' +
          todayHTML +
        '</section>' +

        '<section class="section">' +
          '<div class="section-head">' +
            '<h2>Next exam</h2>' +
            '<button class="text-btn" onclick="navigate(\'exams\')">' +
              'all exams' +
            '</button>' +
          '</div>' +
          examHTML +
        '</section>' +

        '<section class="section">' +
          '<div class="section-head">' +
            '<h2>Focus</h2>' +
            '<button class="text-btn" onclick="navigate(\'focus\')">' +
              'open timer' +
            '</button>' +
          '</div>' +
          focusHTML +
        '</section>' +

      '</div>' +

    '</div>';
}
