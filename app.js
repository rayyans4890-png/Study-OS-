import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "home" | "focus" | "planner" | "tasks" | "exams" | "subjects";

type Subject = {
  id: string;
  name: string;
  color: string;
};

type Task = {
  id: string;
  title: string;
  subject: string;
  due: string;
  done: boolean;
};

type Exam = {
  id: string;
  name: string;
  subject: string;
  date: string;
  notes: string;
};

type Session = {
  id: string;
  subject: string;
  seconds: number;
  date: string;
  at: number;
};

type TimerState = {
  running: boolean;
  total: number;
  left: number;
  subject: string;
  endAt: number;
};

type ToastState = {
  id: number;
  message: string;
};

const PRESETS = [15, 25, 45, 60];

function uid() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayStr() {
  return toISO(new Date());
}

function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysUntil(dateStr: string) {
  const diff = parseDate(dateStr).getTime() - parseDate(todayStr()).getTime();
  return Math.round(diff / 86400000);
}

function fmtShort(s: string) {
  return parseDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m} min`;
}

function fmtClock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sortTasks(list: Task[]) {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  });
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage("studyTasks", []));
  const [subjects, setSubjects] = useState<Subject[]>(() => loadFromStorage("studySubjects", []));
  const [exams, setExams] = useState<Exam[]>(() => loadFromStorage("studyExams", []));
  const [sessions, setSessions] = useState<Session[]>(() => loadFromStorage("studySessions", []));
  const [currentView, setCurrentView] = useState<View>("home");

  const [taskFilter, setTaskFilter] = useState("all");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examName, setExamName] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examNotes, setExamNotes] = useState("");

  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState("#2c6e49");

  const [calMonth, setCalMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(todayStr());

  const [focusDuration, setFocusDuration] = useState(25);
  const [focusSubject, setFocusSubject] = useState("");
  const [timer, setTimer] = useState<TimerState>({
    running: false,
    total: 0,
    left: 0,
    subject: "",
    endAt: 0,
  });

  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    localStorage.setItem("studyTasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("studySubjects", JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem("studyExams", JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem("studySessions", JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    const views: View[] = ["home", "focus", "planner", "tasks", "exams", "subjects"];
    const hash = window.location.hash.replace("#", "") as View;
    if (views.includes(hash)) setCurrentView(hash);

    const onHashChange = () => {
      const next = window.location.hash.replace("#", "") as View;
      if (views.includes(next)) setCurrentView(next);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    window.location.hash = currentView;
  }, [currentView]);

  useEffect(() => {
    const saved = loadFromStorage<{
      endAt: number;
      total: number;
      subject: string;
      left: number;
      running: boolean;
    } | null>("studyTimer", null);

    if (!saved) return;

    const left = saved.running === false ? saved.left : Math.round((saved.endAt - Date.now()) / 1000);

    if (left > 0) {
      setTimer({
        running: saved.running !== false,
        total: saved.total,
        left,
        subject: saved.subject || "",
        endAt: saved.endAt,
      });
      setFocusSubject(saved.subject || "");
    } else {
      localStorage.removeItem("studyTimer");
      setSessions((prev) => [
        ...prev,
        { id: uid(), subject: saved.subject || "", seconds: saved.total, date: todayStr(), at: Date.now() },
      ]);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!timer.running) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        const left = Math.max(0, Math.round((prev.endAt - Date.now()) / 1000));
        if (left <= 0) {
          return { ...prev, running: false, left: 0 };
        }
        return { ...prev, left };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.running]);

  useEffect(() => {
    if (!timer.total) return;

    if (timer.running || timer.left > 0) {
      localStorage.setItem(
        "studyTimer",
        JSON.stringify({
          endAt: timer.endAt,
          total: timer.total,
          subject: timer.subject,
          left: timer.left,
          running: timer.running,
        })
      );
    }
  }, [timer]);

  useEffect(() => {
    if (timer.total > 0 && timer.left === 0 && !timer.running) {
      localStorage.removeItem("studyTimer");
      setSessions((prev) => [
        ...prev,
        { id: uid(), subject: timer.subject, seconds: timer.total, date: todayStr(), at: Date.now() },
      ]);
      setToast({ id: Date.now(), message: "Session logged!" });
      setTimer((prev) => ({ ...prev, total: 0, subject: "", endAt: 0 }));
      setFocusSubject("");
    }
  }, [timer.left, timer.running, timer.total, timer.subject]);

  const subjectColorLookup = (name: string) => {
    const found = subjects.find((s) => s.name.toLowerCase() === String(name).toLowerCase());
    return found ? found.color : "";
  };

  const addSubject = (name: string, color?: string) => {
    if (!name.trim()) return;

    setSubjects((prev) => {
      const idx = prev.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
      if (idx >= 0) {
        const copy = [...prev];
        if (color) copy[idx] = { ...copy[idx], color };
        return copy;
      }
      return [...prev, { id: uid(), name, color: color || "#2c6e49" }];
    });
  };

  const deleteSubject = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const todaySeconds = useMemo(() => {
    const today = todayStr();
    return sessions.reduce((sum, s) => (s.date === today ? sum + s.seconds : sum), 0);
  }, [sessions]);

  const openTaskCount = useMemo(() => tasks.filter((t) => !t.done).length, [tasks]);

  const filteredTasks = useMemo(() => {
    const today = todayStr();
    const list = tasks.filter((t) => {
      if (taskFilter === "today") return t.due === today;
      if (taskFilter === "upcoming") return !t.done && !!t.due && t.due > today;
      if (taskFilter === "overdue") return !t.done && !!t.due && t.due < today;
      if (taskFilter === "done") return t.done;
      return true;
    });

    return sortTasks(list);
  }, [tasks, taskFilter]);

  const nextExam = useMemo(() => {
    const upcoming = exams.filter((e) => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
    return upcoming[0] || null;
  }, [exams]);

  const recentSessions = useMemo(() => [...sessions].sort((a, b) => b.at - a.at).slice(0, 8), [sessions]);

  const navigate = (view: View) => setCurrentView(view);

  const handleTaskSubmit = (e: FormEvent) => {
    e.preventDefault();
    const title = taskTitle.trim();
    const subject = taskSubject.trim();

    if (!title) return;
    if (subject) addSubject(subject);

    if (editingTaskId) {
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTaskId ? { ...t, title, subject, due: taskDue } : t))
      );
      setEditingTaskId(null);
    } else {
      setTasks((prev) => [...prev, { id: uid(), title, subject, due: taskDue, done: false }]);
    }

    setTaskTitle("");
    setTaskSubject("");
    setTaskDue("");
  };

  const startEditTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    setEditingTaskId(id);
    setTaskTitle(task.title);
    setTaskSubject(task.subject || "");
    setTaskDue(task.due || "");
    navigate("tasks");
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setTaskTitle("");
    setTaskSubject("");
    setTaskDue("");
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const deleteTask = (id: string) => {
    if (!window.confirm("Delete this task?")) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleExamSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = examName.trim();
    const subject = examSubject.trim();
    const notes = examNotes.trim();

    if (!name || !examDate) return;
    if (subject) addSubject(subject);

    if (editingExamId) {
      setExams((prev) =>
        prev.map((exam) =>
          exam.id === editingExamId ? { ...exam, name, subject, date: examDate, notes } : exam
        )
      );
      setEditingExamId(null);
    } else {
      setExams((prev) => [...prev, { id: uid(), name, subject, date: examDate, notes }]);
    }

    setExamName("");
    setExamSubject("");
    setExamDate("");
    setExamNotes("");
  };

  const startEditExam = (id: string) => {
    const exam = exams.find((e) => e.id === id);
    if (!exam) return;

    setEditingExamId(id);
    setExamName(exam.name);
    setExamSubject(exam.subject || "");
    setExamDate(exam.date);
    setExamNotes(exam.notes || "");
    navigate("exams");
  };

  const cancelExamEdit = () => {
    setEditingExamId(null);
    setExamName("");
    setExamSubject("");
    setExamDate("");
    setExamNotes("");
  };

  const deleteExam = (id: string) => {
    if (!window.confirm("Delete this exam?")) return;
    setExams((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSubjectSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = subjectName.trim();
    if (!name) return;
    addSubject(name, subjectColor);
    setSubjectName("");
    setSubjectColor("#2c6e49");
  };

  const startTimer = () => {
    const subject = focusSubject;
    const total = focusDuration * 60;
    const endAt = Date.now() + total * 1000;

    setTimer({
      running: true,
      total,
      left: total,
      subject,
      endAt,
    });
  };

  const pauseTimer = () => {
    setTimer((prev) => {
      const left = Math.max(0, Math.round((prev.endAt - Date.now()) / 1000));
      return { ...prev, running: false, left, endAt: 0 };
    });
  };

  const resumeTimer = () => {
    setTimer((prev) => {
      if (prev.left <= 0) return prev;
      return {
        ...prev,
        running: true,
        endAt: Date.now() + prev.left * 1000,
      };
    });
  };

  const resetTimer = () => {
    localStorage.removeItem("studyTimer");
    setTimer({
      running: false,
      total: 0,
      left: 0,
      subject: "",
      endAt: 0,
    });
  };

  const shiftMonth = (n: number) => {
    setCalMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + n, 1));
  };

  const renderTaskRow = (task: Task) => {
    const color = subjectColorLookup(task.subject);
    const overdue = !task.done && !!task.due && task.due < todayStr();

    let dueLabel = "";
    if (task.due) {
      const diff = daysUntil(task.due);
      if (diff < 0) dueLabel = "overdue";
      else if (diff === 0) dueLabel = "today";
      else if (diff === 1) dueLabel = "tomorrow";
      else dueLabel = fmtShort(task.due);
    }

    return (
      <div className={`row task-row ${task.done ? "done" : ""}`} key={task.id}>
        <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
        <div className="grow">
          <div className="task-title">
            {color ? <span className="dot" style={{ background: color }} /> : null}
            {task.title}
          </div>
          <div className="task-meta">
            {task.subject ? <span>{task.subject}</span> : null}
            {task.subject && task.due ? <span> · </span> : null}
            {task.due ? <span className={overdue ? "overdue" : ""}>{dueLabel}</span> : null}
          </div>
        </div>
        <div className="task-actions">
          <button className="text-btn" onClick={() => startEditTask(task.id)} type="button">
            edit
          </button>
          <button className="text-btn danger" onClick={() => deleteTask(task.id)} type="button">
            delete
          </button>
        </div>
      </div>
    );
  };

  const renderHome = () => {
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";
    const dateText = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const today = todayStr();
    const dueNow = sortTasks(tasks.filter((t) => !t.done && !!t.due && t.due <= today));
    const leftWord = dueNow.length
      ? `${dueNow.length} thing${dueNow.length === 1 ? "" : "s"} left`
      : "all clear";

    const totalStudied = sessions.reduce((sum, s) => sum + s.seconds, 0);
    const todayCount = sessions.filter((s) => s.date === today).length;

    return (
      <div className="view active" id="view-home">
        <div className="greeting">
          <h1>{greet}</h1>
          <p className="date-line">{dateText}</p>
        </div>

        <div className="home-grid">
          <div className="home-content">
            <section className="section">
              <div className="section-head">
                <h2>Today</h2>
                <span className="note">{leftWord}</span>
              </div>
              <div className="list">
                {dueNow.length ? dueNow.slice(0, 6).map(renderTaskRow) : <p className="empty-msg">Nothing due today.</p>}
              </div>
              {dueNow.length > 6 ? <p className="muted">...and {dueNow.length - 6} more in Tasks.</p> : null}
            </section>

            <section className="section">
              <div className="section-head">
                <h2>Next exam</h2>
                <button className="text-btn" type="button" onClick={() => navigate("exams")}>
                  all exams
                </button>
              </div>
              {nextExam ? (
                <div className="row">
                  <div className="grow">
                    <span className="task-title">{nextExam.name}</span>
                    {nextExam.subject ? <span className="tag">{nextExam.subject}</span> : null}
                  </div>
                  <span className="exam-when">
                    {daysUntil(nextExam.date) === 0
                      ? "today!"
                      : daysUntil(nextExam.date) === 1
                        ? "tomorrow"
                        : `${fmtShort(nextExam.date)} · in ${daysUntil(nextExam.date)} days`}
                  </span>
                </div>
              ) : (
                <p className="empty-msg">No exams scheduled.</p>
              )}
            </section>

            <section className="section">
              <div className="section-head">
                <h2>Focus</h2>
                <button className="text-btn" type="button" onClick={() => navigate("focus")}>
                  open timer
                </button>
              </div>

              {todaySeconds > 0 ? (
                <div className="row">
                  <div className="grow">
                    <span className="task-title">{fmtDuration(todaySeconds)} studied</span>
                  </div>
                  <span className="muted">
                    {todayCount} session{todayCount === 1 ? "" : "s"}
                  </span>
                </div>
              ) : (
                <p className="empty-msg">No study time yet today.</p>
              )}
            </section>
          </div>

          <aside className="home-sidebar">
            <div className="box">
              <h3>Quick look</h3>
              <div className="quick-row">
                <span>Open tasks</span>
                <span className="mono">{openTaskCount}</span>
              </div>
              <div className="quick-row">
                <span>Subjects</span>
                <span className="mono">{subjects.length}</span>
              </div>
              <div className="quick-row no-border">
                <span>Total studied</span>
                <span className="mono">{fmtDuration(totalStudied)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  };

  const renderPlanner = () => {
    const y = calMonth.getFullYear();
    const m = calMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = todayStr();
    const monthLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const dayTasks = sortTasks(tasks.filter((t) => t.due === selectedDay));

    return (
      <div className="view active" id="view-planner">
        <div className="page-head">
          <h1>Planner</h1>
          <p>Pick a day to see what is on it.</p>
        </div>

        <div className="planner-content">
          <div className="cal">
            <div className="cal-head">
              <button className="btn ghost small" type="button" onClick={() => shiftMonth(-1)}>
                ←
              </button>
              <h2>{monthLabel}</h2>
              <button className="btn ghost small" type="button" onClick={() => shiftMonth(1)}>
                →
              </button>
            </div>

            <div className="cal-grid">
              {dayNames.map((d) => (
                <div className="cal-dow" key={d}>
                  {d}
                </div>
              ))}

              {Array.from({ length: firstDay }).map((_, i) => (
                <div className="cal-day other" key={`empty-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
                const taskCount = tasks.filter((t) => !t.done && t.due === iso).length;
                const cls = [
                  "cal-day",
                  iso === today ? "today" : "",
                  iso === selectedDay ? "selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button className={cls} key={iso} type="button" onClick={() => setSelectedDay(iso)}>
                    <span className="num">{d}</span>
                    {taskCount > 0 ? (
                      <span className="dots">
                        {Array.from({ length: Math.min(taskCount, 3) }).map((__, idx) => (
                          <i key={`${iso}-dot-${idx}`} />
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="box day-detail">
            <h3>
              {parseDate(selectedDay).toLocaleDateString("en-US", { weekday: "long" })},{" "}
              {parseDate(selectedDay).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </h3>
            <div className="list">
              {dayTasks.length ? dayTasks.map(renderTaskRow) : <p className="empty-msg">Nothing scheduled this day.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTasks = () => {
    const filters = ["all", "today", "upcoming", "overdue", "done"];
    const empty =
      tasks.length === 0
        ? "No tasks yet. Add one above."
        : taskFilter === "done"
          ? "Nothing completed yet."
          : "Nothing here. Try another filter.";

    return (
      <div className="view active" id="view-tasks">
        <div className="page-head">
          <h1>Tasks</h1>
          <p>All your tasks, right here.</p>
        </div>

        <form className="add-form" onSubmit={handleTaskSubmit}>
          <div className="form-row">
            <div className="form-group grow2">
              <label htmlFor="taskTitle">What needs doing?</label>
              <input
                className="field"
                id="taskTitle"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Finish Biology worksheet"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="taskSubject">Subject</label>
              <input
                className="field"
                id="taskSubject"
                list="subjectOptions"
                value={taskSubject}
                onChange={(e) => setTaskSubject(e.target.value)}
                placeholder="optional"
              />
            </div>

            <div className="form-group">
              <label htmlFor="taskDue">Due date</label>
              <input
                className="field"
                type="date"
                id="taskDue"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label> </label>
              <button className="btn" type="submit">
                {editingTaskId ? "Save changes" : "Add task"}
              </button>
            </div>
          </div>

          {editingTaskId ? (
            <p className="edit-hint">
              Editing a task -{" "}
              <button type="button" className="text-btn" onClick={cancelTaskEdit}>
                cancel
              </button>
            </p>
          ) : null}
        </form>

        <div className="filters">
          {filters.map((f) => (
            <button
              key={f}
              className={`text-btn ${taskFilter === f ? "active" : ""}`}
              type="button"
              onClick={() => setTaskFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="list">{filteredTasks.length ? filteredTasks.map(renderTaskRow) : <p className="empty-msg">{empty}</p>}</div>
      </div>
    );
  };

  const renderExams = () => {
    const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));

    return (
      <div className="view active" id="view-exams">
        <div className="page-head">
          <h1>Exams</h1>
          <p>Tests and their dates.</p>
        </div>

        <form className="add-form" onSubmit={handleExamSubmit}>
          <div className="form-row">
            <div className="form-group grow2">
              <label htmlFor="examName">Exam</label>
              <input
                className="field"
                id="examName"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g. Biology midterm"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="examSubject">Subject</label>
              <input
                className="field"
                id="examSubject"
                list="subjectOptions"
                value={examSubject}
                onChange={(e) => setExamSubject(e.target.value)}
                placeholder="optional"
              />
            </div>

            <div className="form-group">
              <label htmlFor="examDate">Date</label>
              <input
                className="field"
                type="date"
                id="examDate"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group grow2">
              <label htmlFor="examNotes">Notes</label>
              <input
                className="field"
                id="examNotes"
                value={examNotes}
                onChange={(e) => setExamNotes(e.target.value)}
                placeholder="what is on it? (optional)"
              />
            </div>

            <div className="form-group">
              <label> </label>
              <button className="btn" type="submit">
                {editingExamId ? "Save changes" : "Add exam"}
              </button>
            </div>
          </div>

          {editingExamId ? (
            <p className="edit-hint">
              Editing an exam -{" "}
              <button type="button" className="text-btn" onClick={cancelExamEdit}>
                cancel
              </button>
            </p>
          ) : null}
        </form>

        <div className="list">
          {sorted.length ? (
            sorted.map((exam) => {
              const diff = daysUntil(exam.date);
              const cls = diff < 0 ? "past" : diff <= 1 ? "soon" : "";
              const label = diff < 0 ? "passed" : diff === 0 ? "today!" : diff === 1 ? "tomorrow!" : `${diff} days`;

              const dateFormatted = parseDate(exam.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              });

              return (
                <div className="row" key={exam.id}>
                  <div className="grow">
                    <div className="task-title">{exam.name}</div>
                    <div className="task-meta">
                      {exam.subject ? `${exam.subject} · ${dateFormatted}` : dateFormatted}
                    </div>
                    {exam.notes ? <div className="exam-notes">{exam.notes}</div> : null}
                  </div>
                  <span className={`countdown ${cls}`}>{label}</span>
                  <div className="task-actions">
                    <button type="button" className="text-btn" onClick={() => startEditExam(exam.id)}>
                      edit
                    </button>
                    <button type="button" className="text-btn danger" onClick={() => deleteExam(exam.id)}>
                      delete
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="empty-msg">No exams yet. Add one when a test comes up.</p>
          )}
        </div>
      </div>
    );
  };

  const renderSubjects = () => {
    return (
      <div className="view active" id="view-subjects">
        <div className="page-head">
          <h1>Subjects</h1>
          <p>Your classes. Colors help you spot them in task lists.</p>
        </div>

        <form className="add-form" onSubmit={handleSubjectSubmit}>
          <div className="form-row">
            <div className="form-group grow2">
              <label htmlFor="subjectName">Subject</label>
              <input
                className="field"
                id="subjectName"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="e.g. Biology"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="subjectColor">Color</label>
              <input
                className="field"
                type="color"
                id="subjectColor"
                value={subjectColor}
                onChange={(e) => setSubjectColor(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label> </label>
              <button className="btn" type="submit">
                Add subject
              </button>
            </div>
          </div>
        </form>

        {subjects.length ? (
          <div className="subject-grid">
            {subjects.map((s) => {
              const open = tasks.filter(
                (t) => !t.done && t.subject && t.subject.toLowerCase() === s.name.toLowerCase()
              ).length;

              const studied = sessions.reduce((sum, session) => {
                if (session.subject && session.subject.toLowerCase() === s.name.toLowerCase()) {
                  return sum + session.seconds;
                }
                return sum;
              }, 0);

              return (
                <div className="subject-item" key={s.id}>
                  <div className="subject-header">
                    <span className="swatch" style={{ background: s.color }} />
                    <span className="subject-name">{s.name}</span>
                    <button
                      className="text-btn danger"
                      type="button"
                      onClick={() => {
                        if (window.confirm("Delete this subject?")) {
                          deleteSubject(s.id);
                        }
                      }}
                    >
                      delete
                    </button>
                  </div>
                  <p className="subject-stats">
                    {open} open task{open === 1 ? "" : "s"} · {studied ? `${fmtDuration(studied)} studied` : "no study time yet"}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-msg">No subjects yet. Add your classes here.</p>
        )}
      </div>
    );
  };

  const renderFocus = () => {
    const todayCount = sessions.filter((s) => s.date === todayStr()).length;

    return (
      <div className="view active" id="view-focus">
        <div className="page-head">
          <h1>Focus</h1>
          <p>Set a timer and study one thing at a time.</p>
        </div>

        <div className="focus-layout">
          <div className="timer-box">
            {timer.running || timer.left > 0 ? (
              <>
                <h2 className="timer-subject">{timer.subject || "Focus"}</h2>
                <div className="timer-clock">{fmtClock(timer.left)}</div>
                <div className="timer-progress">
                  <div
                    className="fill"
                    style={{ width: `${timer.total > 0 ? Math.round((timer.left / timer.total) * 100) : 0}%` }}
                  />
                </div>
                <div className="timer-controls">
                  {timer.running ? (
                    <button className="btn ghost" type="button" onClick={pauseTimer}>
                      Pause
                    </button>
                  ) : (
                    <button className="btn" type="button" onClick={resumeTimer}>
                      Resume
                    </button>
                  )}
                  <button className="btn ghost" type="button" onClick={resetTimer}>
                    Reset
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Ready to focus?</h2>
                <p className="muted">Pick a length and a subject, then start.</p>
                <div className="presets">
                  {PRESETS.map((m) => (
                    <button
                      type="button"
                      className={`btn ghost small preset ${m === focusDuration ? "active" : ""}`}
                      key={m}
                      onClick={() => setFocusDuration(m)}
                    >
                      {m} min
                    </button>
                  ))}
                </div>

                <div className="form-group">
                  <label htmlFor="focusSubject">Subject (optional)</label>
                  <select
                    className="field"
                    id="focusSubject"
                    value={focusSubject}
                    onChange={(e) => setFocusSubject(e.target.value)}
                  >
                    <option value="">- none -</option>
                    {subjects.map((s) => (
                      <option value={s.name} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button className="btn" type="button" onClick={startTimer}>
                  Start
                </button>
              </>
            )}
          </div>

          <div className="focus-sidebar">
            <section className="section">
              <div className="section-head">
                <h2>Today</h2>
              </div>
              <div className="stats-row">
                <div className="stat">
                  <span className="stat-num">{fmtClock(todaySeconds)}</span>
                  <span className="stat-label">time studied</span>
                </div>
                <div className="stat">
                  <span className="stat-num">{todayCount}</span>
                  <span className="stat-label">sessions</span>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="section-head">
                <h2>Recent sessions</h2>
              </div>
              <div className="list">
                {recentSessions.length ? (
                  recentSessions.map((session) => (
                    <div className="row" key={session.id}>
                      <div className="grow">
                        <span className="task-title">{session.subject || "Focus session"}</span>
                      </div>
                      <span className="muted">{fmtDuration(session.seconds)}</span>
                    </div>
                  ))
                ) : (
                  <p className="empty-msg">No sessions yet.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" type="button" onClick={() => navigate("home")}>
            Study OS
          </button>
          <p className="brand-subtitle">Personal study planner</p>

          <nav className="main-nav" aria-label="Main navigation">
            {(["home", "focus", "planner", "tasks", "exams", "subjects"] as View[]).map((view) => (
              <button
                type="button"
                key={view}
                data-nav={view}
                className={`nav-link ${currentView === view ? "active" : ""}`}
                onClick={() => navigate(view)}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="page">
        {currentView === "home" ? renderHome() : null}
        {currentView === "focus" ? renderFocus() : null}
        {currentView === "planner" ? renderPlanner() : null}
        {currentView === "tasks" ? renderTasks() : null}
        {currentView === "exams" ? renderExams() : null}
        {currentView === "subjects" ? renderSubjects() : null}
      </main>

      <datalist id="subjectOptions">
        {subjects.map((s) => (
          <option value={s.name} key={s.id} />
        ))}
      </datalist>

      {toast ? (
        <div className="toast" key={toast.id}>
          {toast.message}
        </div>
      ) : null}
    </>
  );
}
