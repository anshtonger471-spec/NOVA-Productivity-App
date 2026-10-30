const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORAGE_KEY = "nova-productivity-v1";
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const defaultData = () => ({
  userName: "dreamer",
  tasks: [
    {
      id: uid(),
      title: "Make this week feel intentional",
      description: "Choose three things that matter most.",
      date: todayISO(),
      time: "10:00",
      priority: "High",
      category: "Personal",
      done: false,
      reminder: false,
      notified: false,
      created: Date.now(),
    },
    {
      id: uid(),
      title: "Spend 25 minutes learning",
      description: "One small session is enough to begin.",
      date: todayISO(),
      time: "12:30",
      priority: "Medium",
      category: "Study",
      done: false,
      reminder: false,
      notified: false,
      created: Date.now(),
    },
    {
      id: uid(),
      title: "Take a screen-free break",
      description: "Stretch, breathe, drink some water.",
      date: todayISO(),
      time: "17:00",
      priority: "Low",
      category: "Health",
      done: false,
      reminder: false,
      notified: false,
      created: Date.now(),
    },
  ],
  habits: [
    { id: uid(), name: "Drink more water", done: false },
    { id: uid(), name: "Read a little", done: false },
    { id: uid(), name: "Move my body", done: false },
  ],
  goals: [
    { id: uid(), name: "Build something I'm proud of", date: "", progress: 20 },
  ],
  note: "",
  focusMinutes: 0,
  completedHistory: {},
});
let data;
try {
  data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData();
} catch {
  data = defaultData();
}
let currentFilter = "all";
let priorityFilter = "all";
let calendarDate = new Date();
let selectedDate = todayISO();
let calendarView = "month";
let editingTaskId = null;
let timerMode = "Pomodoro";
let timerTotal = 25 * 60;
let timerRemaining = timerTotal;
let timerInterval = null;
let toastTimeout;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderStats();
}
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove("show"), 3000);
}
function formatTime(time) {
  if (!time) return "No time set";
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
function safeText(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}
function renderStats() {
  const todayTasks = data.tasks.filter((t) => t.date === todayISO());
  const doneToday = todayTasks.filter((t) => t.done).length;
  $("#todayStat").textContent = `${doneToday}/${todayTasks.length}`;
  $("#upcomingStat").textContent = data.tasks.filter(
    (t) => !t.done && t.date >= todayISO(),
  ).length;
  $("#focusStat").textContent =
    data.focusMinutes >= 60
      ? `${Math.floor(data.focusMinutes / 60)}h ${data.focusMinutes % 60}m`
      : `${data.focusMinutes}m`;
  $("#completedStat").textContent = data.tasks.filter((t) => t.done).length;
  $("#sideTaskCount").textContent = data.tasks.filter((t) => !t.done).length;
  $("#insightCompleted").textContent = data.tasks.filter((t) => t.done).length;
  $("#taskSummary").textContent =
    `${data.tasks.length} task${data.tasks.length === 1 ? "" : "s"} in your orbit`;
  renderWeekBars();
}
function renderTasks() {
  const list = $("#taskList");
  let tasks = [...data.tasks].filter(
    (t) =>
      currentFilter === "all" || (currentFilter === "open" ? !t.done : t.done),
  );
  if (priorityFilter !== "all")
    tasks = tasks.filter((t) => t.priority === priorityFilter);
  tasks.sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      a.date.localeCompare(b.date) ||
      (a.time || "99:99").localeCompare(b.time || "99:99"),
  );
  list.innerHTML = tasks
    .map(
      (t) => `
    <article class="task-item ${t.done ? "completed" : ""}">
      <input class="task-check" type="checkbox" data-complete="${t.id}" ${t.done ? "checked" : ""} aria-label="Mark ${safeText(t.title)} complete">
      <div class="task-main"><div class="task-title">${safeText(t.title)}</div>${t.description ? `<div class="task-description">${safeText(t.description)}</div>` : ""}
        <div class="task-meta"><span class="priority-badge priority-${t.priority}">${safeText(t.priority)}</span><span>${safeText(t.category)}</span><span>${safeText(t.date === todayISO() ? "Today" : t.date)}</span>${t.reminder ? "<span>🔔 reminder</span>" : ""}</div>
      </div>
      <div><div class="task-time">${safeText(formatTime(t.time))}</div><div class="task-actions"><button data-edit="${t.id}" aria-label="Edit task">✎</button><button data-delete="${t.id}" aria-label="Delete task">×</button></div></div>
    </article>`,
    )
    .join("");
  $("#emptyTasks").hidden = tasks.length !== 0;
  list.hidden = tasks.length === 0;
}
function renderCalendar() {
  const grid = $("#calendarGrid");
  const y = calendarDate.getFullYear(),
    m = calendarDate.getMonth();
  $("#monthTitle").textContent = calendarDate.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  let html = weekdays.map((d) => `<div class="weekday">${d}</div>`).join("");
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  const count = calendarView === "week" ? 7 : 42;
  const weekStart = new Date(calendarDate);
  if (calendarView === "week")
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const origin = calendarView === "week" ? weekStart : start;
  for (let i = 0; i < count; i++) {
    const d = new Date(origin);
    d.setDate(origin.getDate() + i);
    const iso = dateISO(d);
    const dayTasks = data.tasks.filter((t) => t.date === iso);
    html += `<button class="day-cell ${d.getMonth() !== m && calendarView === "month" ? "muted-day" : ""} ${iso === todayISO() ? "today" : ""} ${iso === selectedDate ? "selected" : ""}" data-date="${iso}" aria-label="${d.toLocaleDateString()} with ${dayTasks.length} tasks"><span class="day-number">${d.getDate()}</span><span class="day-dots">${dayTasks
      .slice(0, 3)
      .map((t) => `<i title="${safeText(t.title)}"></i>`)
      .join("")}</span></button>`;
  }
  grid.innerHTML = html;
  $("#selectedDayInfo").innerHTML =
    `<strong>${new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</strong> · ${data.tasks.filter((t) => t.date === selectedDate).length} task(s) planned. <button class="plain-button" id="addOnSelectedDay">＋ Plan this day</button>`;
  $("#addOnSelectedDay").addEventListener("click", () =>
    openTaskModal(null, selectedDate),
  );
}
function renderHabits() {
  $("#habitList").innerHTML = data.habits
    .map(
      (h) =>
        `<label class="habit-row"><input type="checkbox" data-habit="${h.id}" ${h.done ? "checked" : ""}><span>${safeText(h.name)}</span><small>${h.done ? "BLOOMED" : "TODAY"}</small></label>`,
    )
    .join("");
  const done = data.habits.filter((h) => h.done).length;
  $("#habitProgress").textContent = `${done} / ${data.habits.length} complete`;
  $("#habitProgressBar").style.width =
    `${data.habits.length ? (done / data.habits.length) * 100 : 0}%`;
}
function renderGoals() {
  $("#goalList").innerHTML = data.goals.length
    ? data.goals
        .map(
          (g) =>
            `<article class="goal-card"><div class="goal-card-top"><strong>${safeText(g.name)}</strong><button data-goal-delete="${g.id}" aria-label="Delete goal">×</button></div><p>${g.date ? `Target: ${safeText(g.date)}` : "A goal worth growing toward."}</p><input type="range" min="0" max="100" value="${g.progress}" data-goal-progress="${g.id}" aria-label="Goal progress"><div class="goal-card-foot"><span>PROGRESS</span><strong>${g.progress}%</strong></div></article>`,
        )
        .join("")
    : `<p class="muted">Your next big thing can start small. Add a goal ✧</p>`;
}
function renderWeekBars() {
  const root = $("#weekBars");
  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date();
  const values = [];
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const key = dateISO(d);
    const count = data.tasks.filter(
      (t) => t.done && (t.completedDate || t.date) === key,
    ).length;
    values.push({ label: dayNames[d.getDay()], count });
  }
  const max = Math.max(1, ...values.map((v) => v.count));
  root.innerHTML = values
    .map(
      (v) =>
        `<div class="bar-column"><i style="height:${Math.max(6, (v.count / max) * 82)}%"></i><span>${v.label}</span></div>`,
    )
    .join("");
}
function renderAll() {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  $("#greeting").innerHTML =
    `${greeting}, ${safeText(data.userName || "dreamer")}! <span>✦</span>`;
  $("#todayLabel").textContent = new Date()
    .toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
  $("#quickNote").value = data.note || "";
  renderTasks();
  renderCalendar();
  renderHabits();
  renderGoals();
  renderStats();
}
function openTaskModal(task = null, date = selectedDate) {
  editingTaskId = task?.id || null;
  $("#taskModalTitle").textContent = task
    ? "Edit your mission."
    : "Make it happen.";
  $("#editingTaskId").value = task?.id || "";
  $("#taskTitle").value = task?.title || "";
  $("#taskDescription").value = task?.description || "";
  $("#taskDate").value = task?.date || date || todayISO();
  $("#taskTime").value = task?.time || "";
  $("#taskPriority").value = task?.priority || "Medium";
  $("#taskCategory").value = task?.category || "Personal";
  $("#taskReminder").checked = !!task?.reminder;
  $("#taskModal").showModal();
  setTimeout(() => $("#taskTitle").focus(), 50);
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el?.open) el.close();
}
function requestNotificationPermission() {
  if (!("Notification" in window)) {
    toast("This browser does not support notifications.");
    return Promise.resolve(false);
  }
  if (Notification.permission === "granted") return Promise.resolve(true);
  if (Notification.permission === "denied") {
    toast("Notifications are blocked in browser settings.");
    return Promise.resolve(false);
  }
  return Notification.requestPermission().then((p) => p === "granted");
}
function scheduleReminder(task) {
  if (
    !task.reminder ||
    task.notified ||
    task.done ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  const when = new Date(`${task.date}T${task.time || "09:00"}:00`).getTime();
  const delta = when - Date.now();
  if (delta > 0 && delta <= 2147480000) {
    setTimeout(() => {
      const latest = data.tasks.find((t) => t.id === task.id);
      if (latest && !latest.done && Notification.permission === "granted") {
        new Notification("NOVA reminder ✦", {
          body: latest.title,
          tag: latest.id,
        });
        latest.notified = true;
        persist();
      }
    }, delta);
  }
}
function setFilter(filter) {
  currentFilter = filter;
  $$(".filter-chip").forEach((b) =>
    b.classList.toggle("active", b.dataset.filter === filter),
  );
  renderTasks();
}
$("#taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const reminder = $("#taskReminder").checked;
  if (
    reminder &&
    "Notification" in window &&
    Notification.permission === "default"
  )
    await requestNotificationPermission();
  const task = {
    id: editingTaskId || uid(),
    title: $("#taskTitle").value.trim(),
    description: $("#taskDescription").value.trim(),
    date: $("#taskDate").value,
    time: $("#taskTime").value,
    priority: $("#taskPriority").value,
    category: $("#taskCategory").value,
    reminder,
    notified: editingTaskId
      ? !!data.tasks.find((t) => t.id === editingTaskId)?.notified
      : false,
    done: editingTaskId
      ? !!data.tasks.find((t) => t.id === editingTaskId)?.done
      : false,
    created: editingTaskId
      ? data.tasks.find((t) => t.id === editingTaskId)?.created
      : Date.now(),
  };
  if (!task.title || !task.date) return;
  if (editingTaskId)
    data.tasks = data.tasks.map((t) => (t.id === editingTaskId ? task : t));
  else data.tasks.push(task);
  persist();
  renderTasks();
  renderCalendar();
  closeModal("taskModal");
  toast(
    editingTaskId
      ? "Mission updated ✦"
      : "A new mission joined your universe ✨",
  );
  scheduleReminder(task);
});
$("#taskList").addEventListener("change", (event) => {
  const id = event.target.dataset.complete;
  if (!id) return;
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return;
  task.done = event.target.checked;
  if (task.done) {
    task.completedDate = todayISO();
    data.completedHistory[todayISO()] =
      (data.completedHistory[todayISO()] || 0) + 1;
    toast("One little win, captured. ✨");
  } else {
    task.completedDate = null;
    toast("Task moved back to your orbit.");
  }
  persist();
  renderTasks();
  renderCalendar();
  renderStats();
});
$("#taskList").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");
  if (edit) {
    const task = data.tasks.find((t) => t.id === edit.dataset.edit);
    if (task) openTaskModal(task);
  }
  if (del) {
    data.tasks = data.tasks.filter((t) => t.id !== del.dataset.delete);
    persist();
    renderTasks();
    renderCalendar();
    toast("Task removed from orbit.");
  }
});
$$(".filter-chip").forEach((b) =>
  b.addEventListener("click", () => setFilter(b.dataset.filter)),
);
$("#priorityFilter").addEventListener("change", (e) => {
  priorityFilter = e.target.value;
  renderTasks();
});
$("#openTaskModal").addEventListener("click", () => openTaskModal());
$("#emptyAddTask").addEventListener("click", () => openTaskModal());
$("#calendarAdd").addEventListener("click", () =>
  openTaskModal(null, selectedDate),
);
$("#clearCompleted").addEventListener("click", () => {
  const count = data.tasks.filter((t) => t.done).length;
  data.tasks = data.tasks.filter((t) => !t.done);
  persist();
  renderTasks();
  renderCalendar();
  toast(`${count} completed task(s) cleared.`);
});
$("#prevMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
});
$("#nextMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
});
$("#calendarGrid").addEventListener("click", (e) => {
  const cell = e.target.closest("[data-date]");
  if (!cell) return;
  selectedDate = cell.dataset.date;
  const d = new Date(`${selectedDate}T12:00:00`);
  calendarDate = new Date(d.getFullYear(), d.getMonth(), 1);
  renderCalendar();
});
$$("[data-calendar-view]").forEach((b) =>
  b.addEventListener("click", () => {
    calendarView = b.dataset.calendarView;
    $$("[data-calendar-view]").forEach((x) =>
      x.classList.toggle("active", x === b),
    );
    renderCalendar();
  }),
);
$$("[data-close]").forEach((b) =>
  b.addEventListener("click", () => closeModal(b.dataset.close)),
);
$("#addHabitButton").addEventListener("click", () =>
  $("#habitModal").showModal(),
);
$("#habitForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#habitName").value.trim();
  if (!name) return;
  data.habits.push({ id: uid(), name, done: false });
  persist();
  renderHabits();
  closeModal("habitModal");
  $("#habitName").value = "";
  toast("A new habit has been planted. ✿");
});
$("#habitList").addEventListener("change", (e) => {
  const id = e.target.dataset.habit;
  if (!id) return;
  const habit = data.habits.find((h) => h.id === id);
  if (habit) {
    habit.done = e.target.checked;
    persist();
    renderHabits();
  }
});
$("#addGoalButton").addEventListener("click", () =>
  $("#goalModal").showModal(),
);
$("#goalForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#goalName").value.trim();
  if (!name) return;
  data.goals.push({ id: uid(), name, date: $("#goalDate").value, progress: 0 });
  persist();
  renderGoals();
  closeModal("goalModal");
  $("#goalName").value = "";
  $("#goalDate").value = "";
  toast("A new dream has a direction. ✦");
});
$("#goalList").addEventListener("input", (e) => {
  const id = e.target.dataset.goalProgress;
  if (!id) return;
  const goal = data.goals.find((g) => g.id === id);
  if (goal) {
    goal.progress = Number(e.target.value);
    const label = e.target.parentElement.querySelector(
      ".goal-card-foot strong",
    );
    if (label) label.textContent = `${goal.progress}%`;
    persist();
  }
});
$("#goalList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-goal-delete]");
  if (b) {
    data.goals = data.goals.filter((g) => g.id !== b.dataset.goalDelete);
    persist();
    renderGoals();
    toast("Goal removed.");
  }
});
$("#saveNote").addEventListener("click", () => {
  data.note = $("#quickNote").value;
  persist();
  $("#noteSaved").textContent =
    `Saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  toast("Your thought is safely saved. ✎");
});
let noteSaveTimeout;
$("#quickNote").addEventListener("input", () => {
  clearTimeout(noteSaveTimeout);
  noteSaveTimeout = setTimeout(() => {
    data.note = $("#quickNote").value;
    persist();
    $("#noteSaved").textContent = "Autosaved in this browser";
  }, 500);
});
$("#nameButton").addEventListener("click", () => {
  const name = prompt("What should NOVA call you?", data.userName);
  if (name !== null && name.trim()) {
    data.userName = name.trim().slice(0, 28);
    persist();
    renderAll();
    toast("Your space, your name. ✨");
  }
});
$("#profileButton").addEventListener("click", () => $("#nameButton").click());
$("#themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("light-mode");
  const isLight = document.body.classList.contains("light-mode");
  $("#themeToggle").textContent = isLight ? "☀" : "☾";
  localStorage.setItem("nova-theme", isLight ? "light" : "dark");
});
if (localStorage.getItem("nova-theme") === "light") {
  document.body.classList.add("light-mode");
  $("#themeToggle").textContent = "☀";
}
$$(".side-link").forEach((b) =>
  b.addEventListener("click", () => {
    $$(".side-link").forEach((x) => x.classList.toggle("selected", x === b));
    const targets = {
      overview: "#dashboard",
      tasks: "#tasksPanel",
      calendar: "#calendar",
      habits: "#habitsPanel",
      focus: "#focusPanel",
      notes: "#notesPanel",
      goals: "#goalsPanel",
    };
    document
      .querySelector(targets[b.dataset.view] || "#dashboard")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }),
);
$("#menuToggle").addEventListener("click", () =>
  $("#mainNav").classList.toggle("open"),
);
$$(".main-nav a").forEach((a) =>
  a.addEventListener("click", () => $("#mainNav").classList.remove("open")),
);

function updateTimerDisplay() {
  const mm = String(Math.floor(timerRemaining / 60)).padStart(2, "0"),
    ss = String(timerRemaining % 60).padStart(2, "0");
  $("#timerDisplay").textContent = `${mm}:${ss}`;
  const degrees = timerTotal
    ? ((timerTotal - timerRemaining) / timerTotal) * 360
    : 0;
  $("#timerRing").style.background =
    `conic-gradient(var(--pink) 0deg,var(--purple) ${Math.max(0, degrees)}deg,#343044 ${Math.max(0, degrees)}deg 360deg)`;
}
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  $("#timerStart").textContent = "RESUME FOCUS";
}
function selectTimer(minutes, mode) {
  stopTimer();
  timerMode = mode;
  timerTotal = minutes * 60;
  timerRemaining = timerTotal;
  $("#focusModeLabel").textContent = mode.toUpperCase();
  $("#timerStart").textContent = "START FOCUS";
  updateTimerDisplay();
}
$$(".focus-tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    $$(".focus-tabs button").forEach((x) =>
      x.classList.toggle("active", x === b),
    );
    selectTimer(Number(b.dataset.minutes), b.dataset.mode);
  }),
);
$("#timerStart").addEventListener("click", () => {
  if (timerInterval) {
    stopTimer();
    return;
  }
  $("#timerStart").textContent = "PAUSE";
  timerInterval = setInterval(() => {
    timerRemaining--;
    updateTimerDisplay();
    if (timerRemaining <= 0) {
      stopTimer();
      if (timerMode === "Pomodoro") {
        data.focusMinutes += 25;
        persist();
      }
      toast(`${timerMode} complete! Take a breath. ✨`);
      if ("Notification" in window && Notification.permission === "granted")
        new Notification("NOVA focus portal", {
          body: `${timerMode} complete. You did it!`,
        });
    }
  }, 1000);
});
$("#timerReset").addEventListener("click", () => {
  stopTimer();
  timerRemaining = timerTotal;
  updateTimerDisplay();
  $("#timerStart").textContent = "START FOCUS";
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && timerInterval) {
    /* timer continues while the tab is open */
  }
});

renderAll();
data.tasks.filter((t) => t.reminder).forEach(scheduleReminder);
updateTimerDisplay();
