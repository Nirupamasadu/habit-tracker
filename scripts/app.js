import { ACHIEVEMENTS, DAILY_QUOTES, HABIT_COLORS, STUDENT_TEMPLATES } from "./constants.js";
import {
  addMonths,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  formatWeekday,
  getDayOfYear,
  getMonthMatrix,
  isSameDay,
  isSameMonth,
  toDateKey,
} from "./date-utils.js";
import {
  createEmptyState,
  createHabitFromTemplate,
  createId,
  loadStoredName,
  loadStoredState,
  normalizeState,
  saveStoredName,
  saveStoredState,
  serializeBackup,
} from "./storage.js";
import {
  getCompletionRate,
  getConsistencyScore,
  getDayStats,
  getHabitStreak,
  getHeatmapData,
  getMonthlyAnalytics,
  getOverallStreaks,
  getProductivityScore,
  getRecoveryState,
  getTotalCompletions,
  getUnlockedAchievementIds,
  getWeeklyAnalytics,
  isHabitComplete,
  setHabitCompletion,
} from "./stats.js";

const initialTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const app = {
  state: createEmptyState({ theme: initialTheme }),
  viewDate: new Date(),
  selectedDate: new Date(),
  celebratedPerfectDays: new Set(),
  user: null,
  busy: false,
};

const dom = {
  html: document.documentElement,
  body: document.body,
  welcomeScreen: document.querySelector("#welcomeScreen"),
  welcomeForm: document.querySelector("#welcomeForm"),
  studentName: document.querySelector("#studentName"),
  welcomeMessage: document.querySelector("#welcomeMessage"),
  appShell: document.querySelector("#appShell"),
  changeNameButton: document.querySelector("#changeNameButton"),
  userName: document.querySelector("#userName"),
  userEmail: document.querySelector("#userEmail"),
  userAvatar: document.querySelector("#userAvatar"),
  loadingOverlay: document.querySelector("#loadingOverlay"),
  loadingText: document.querySelector("#loadingText"),
  todayLabel: document.querySelector("#todayLabel"),
  dailyQuote: document.querySelector("#dailyQuote"),
  productivityRing: document.querySelector("#productivityRing"),
  productivityScore: document.querySelector("#productivityScore"),
  totalCompleted: document.querySelector("#totalCompleted"),
  completionRate: document.querySelector("#completionRate"),
  currentStreak: document.querySelector("#currentStreak"),
  longestStreak: document.querySelector("#longestStreak"),
  consistencyScore: document.querySelector("#consistencyScore"),
  monthlyRate: document.querySelector("#monthlyRate"),
  monthlyCompleted: document.querySelector("#monthlyCompleted"),
  monthTitle: document.querySelector("#monthTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  todayButton: document.querySelector("#todayButton"),
  selectedDateLabel: document.querySelector("#selectedDateLabel"),
  selectedDayMeter: document.querySelector("#selectedDayMeter"),
  selectedDayScore: document.querySelector("#selectedDayScore"),
  selectedDayCompleted: document.querySelector("#selectedDayCompleted"),
  selectedDayMood: document.querySelector("#selectedDayMood"),
  habitList: document.querySelector("#habitList"),
  habitForm: document.querySelector("#habitForm"),
  habitFormTitle: document.querySelector("#habitFormTitle"),
  habitId: document.querySelector("#habitId"),
  habitName: document.querySelector("#habitName"),
  habitIcon: document.querySelector("#habitIcon"),
  habitColor: document.querySelector("#habitColor"),
  saveHabitButton: document.querySelector("#saveHabitButton span"),
  resetHabitForm: document.querySelector("#resetHabitForm"),
  colorPresets: document.querySelector("#colorPresets"),
  templateGrid: document.querySelector("#templateGrid"),
  habitLibrary: document.querySelector("#habitLibrary"),
  searchHabits: document.querySelector("#searchHabits"),
  habitFilter: document.querySelector("#habitFilter"),
  weeklyChart: document.querySelector("#weeklyChart"),
  weeklyCompleted: document.querySelector("#weeklyCompleted"),
  monthInsight: document.querySelector("#monthInsight"),
  monthRing: document.querySelector("#monthRing"),
  monthRingLabel: document.querySelector("#monthRingLabel"),
  heatmapGrid: document.querySelector("#heatmapGrid"),
  badgeGrid: document.querySelector("#badgeGrid"),
  badgeCount: document.querySelector("#badgeCount"),
  historyList: document.querySelector("#historyList"),
  streakGrid: document.querySelector("#streakGrid"),
  themeToggle: document.querySelector("#themeToggle"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  toastStack: document.querySelector("#toastStack"),
  confettiRoot: document.querySelector("#confettiRoot"),
};

function plural(value, noun) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function refreshIcons() {
  window.lucide?.createIcons();
}

function setBusy(isBusy, message = "Saving locally") {
  app.busy = isBusy;
  dom.body.classList.toggle("is-busy", isBusy);
  dom.loadingOverlay.setAttribute("aria-hidden", String(!isBusy));
  dom.loadingText.textContent = message;
}

function persistState() {
  saveStoredState(app.state);
}

function setWelcomeMessage(message, isError = true) {
  dom.welcomeMessage.textContent = message;
  dom.welcomeMessage.classList.toggle("ok", !isError);
}

function showWelcome(message = "", name = app.user?.name || loadStoredName()) {
  app.user = null;
  dom.body.classList.remove("dashboard-ready");
  dom.welcomeScreen.removeAttribute("aria-hidden");
  dom.appShell.setAttribute("aria-hidden", "true");
  dom.studentName.value = name || "";
  setWelcomeMessage(message, Boolean(message));
  applyTheme();
  refreshIcons();
  window.setTimeout(() => dom.studentName.focus(), 0);
}

function showApp() {
  dom.body.classList.add("dashboard-ready");
  dom.welcomeScreen.setAttribute("aria-hidden", "true");
  dom.appShell.removeAttribute("aria-hidden");
}

function renderUser() {
  const name = app.user?.name || "Student";
  dom.userName.textContent = name;
  dom.userEmail.textContent = "Local profile";
  dom.userAvatar.src = "assets/app-icon.svg";
  dom.userAvatar.alt = "";
}

function openDashboard(name) {
  app.user = { name };
  app.state = loadStoredState({ theme: app.state.settings.theme || initialTheme });
  showApp();
  renderUser();
  resetHabitForm();
  renderWithAchievements({ silent: true });
}

function handleWelcomeSubmit(event) {
  event.preventDefault();

  const name = dom.studentName.value.trim();
  if (!name) {
    setWelcomeMessage("Enter your name to continue.");
    dom.studentName.focus();
    return;
  }

  const savedName = saveStoredName(name);
  setWelcomeMessage("", false);
  openDashboard(savedName);
}

function showNameEditor() {
  showWelcome("", app.user?.name || loadStoredName());
}

function applyTheme() {
  dom.html.dataset.theme = app.state.settings.theme;
  const icon = app.state.settings.theme === "dark" ? "sun" : "moon";
  dom.themeToggle.innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
  refreshIcons();
}

function renderWithAchievements(options = {}) {
  const previousAchievements = new Set(Object.keys(app.state.achievements));
  const unlocked = getUnlockedAchievementIds(app.state);

  unlocked.forEach((id) => {
    if (!app.state.achievements[id]) {
      app.state.achievements[id] = new Date().toISOString();
    }
  });

  render();
  persistState();

  if (!options.silent) {
    unlocked
      .filter((id) => !previousAchievements.has(id))
      .forEach((id) => {
        const achievement = ACHIEVEMENTS.find((item) => item.id === id);
        showToast(`${achievement.icon} ${achievement.title}`, achievement.description);
        burstConfetti();
      });
  }
}

function showToast(title, message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  dom.toastStack.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function showError(error, fallback = "Something went wrong. Please try again.") {
  console.error(error);
  showToast("Action failed", error?.message || fallback);
}

function burstConfetti() {
  const colors = ["#2563eb", "#14b8a6", "#f97316", "#db2777", "#8b5cf6", "#22c55e"];

  for (let index = 0; index < 52; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.setProperty("--x", `${Math.random() * 100}vw`);
    piece.style.setProperty("--drift", `${Math.random() * 160 - 80}px`);
    piece.style.setProperty("--delay", `${Math.random() * 0.35}s`);
    piece.style.setProperty("--spin", `${Math.random() * 520 - 260}deg`);
    piece.style.background = colors[index % colors.length];
    dom.confettiRoot.append(piece);
    window.setTimeout(() => piece.remove(), 2400);
  }
}

function filteredHabits(dateKey = toDateKey(app.selectedDate)) {
  const query = dom.searchHabits.value.trim().toLowerCase();
  const filter = dom.habitFilter.value;

  return app.state.habits.filter((habit) => {
    const matchesSearch =
      !query ||
      habit.name.toLowerCase().includes(query) ||
      habit.icon.toLowerCase().includes(query);
    const complete = isHabitComplete(app.state, habit.id, dateKey);
    const streak = getHabitStreak(app.state, habit.id).current;

    if (!matchesSearch) return false;
    if (filter === "completed") return complete;
    if (filter === "pending") return !complete;
    if (filter === "streak") return streak > 0;
    return true;
  });
}

function renderOverview() {
  const quoteIndex = getDayOfYear(new Date()) % DAILY_QUOTES.length;
  const totalCompleted = getTotalCompletions(app.state);
  const rate = getCompletionRate(app.state);
  const streaks = getOverallStreaks(app.state);
  const month = getMonthlyAnalytics(app.state, app.viewDate);
  const consistency = getConsistencyScore(app.state);
  const productivity = getProductivityScore(app.state);

  dom.todayLabel.textContent = formatLongDate(new Date());
  dom.dailyQuote.textContent = DAILY_QUOTES[quoteIndex];
  dom.productivityScore.textContent = productivity;
  dom.productivityRing.style.setProperty("--score", productivity);
  dom.totalCompleted.textContent = totalCompleted;
  dom.completionRate.textContent = `${rate.percent}%`;
  dom.currentStreak.textContent = plural(streaks.current, "day");
  dom.longestStreak.textContent = plural(streaks.longest, "day");
  dom.consistencyScore.textContent = `${consistency}%`;
  dom.monthlyRate.textContent = `${month.percent}%`;
  dom.monthlyCompleted.textContent = `${month.completed} completions`;
}

function renderCalendar() {
  const today = new Date();
  const selectedKey = toDateKey(app.selectedDate);
  const dates = getMonthMatrix(app.viewDate);

  dom.monthTitle.textContent = formatMonthYear(app.viewDate);
  dom.calendarGrid.innerHTML = dates
    .map((date) => {
      const dateKey = toDateKey(date);
      const stats = getDayStats(app.state, dateKey);
      const completedHabits = app.state.habits
        .filter((habit) => isHabitComplete(app.state, habit.id, dateKey))
        .slice(0, 4);
      const dots = completedHabits
        .map((habit) => `<i style="--habit-color: ${habit.color}"></i>`)
        .join("");
      const classes = [
        "calendar-day",
        isSameMonth(date, app.viewDate) ? "" : "muted",
        isSameDay(date, today) ? "today" : "",
        selectedKey === dateKey ? "selected" : "",
        stats.total > 0 && stats.completed === stats.total ? "perfect" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <button class="${classes}" data-date="${dateKey}" data-level="${Math.ceil(stats.percent / 25)}" type="button" aria-label="${formatLongDate(date)}, ${stats.percent}% complete">
          <span class="date-number">${date.getDate()}</span>
          <span class="completion-count">${stats.completed}/${stats.total}</span>
          <span class="habit-dots">${dots}</span>
        </button>
      `;
    })
    .join("");
}

function getDayMood(stats) {
  if (!stats.total) return "Create your first habit";
  if (stats.percent === 100) return "Perfect study day";
  if (stats.percent >= 70) return "Strong momentum";
  if (stats.percent >= 40) return "Keep building";
  if (stats.completed > 0) return "You started";
  return "Ready to start";
}

function renderSelectedDay() {
  const dateKey = toDateKey(app.selectedDate);
  const stats = getDayStats(app.state, dateKey);
  const habits = filteredHabits(dateKey);

  dom.selectedDateLabel.textContent = formatLongDate(app.selectedDate);
  dom.selectedDayMeter.style.setProperty("--day-score", stats.percent);
  dom.selectedDayScore.textContent = `${stats.percent}%`;
  dom.selectedDayCompleted.textContent = `${stats.completed} of ${stats.total} habits complete`;
  dom.selectedDayMood.textContent = getDayMood(stats);

  if (!habits.length) {
    dom.habitList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="list-filter" aria-hidden="true"></i>
        <strong>No habits match this view.</strong>
        <span>Adjust the search or filter to keep tracking.</span>
      </div>
    `;
    return;
  }

  dom.habitList.innerHTML = habits
    .map((habit) => {
      const complete = isHabitComplete(app.state, habit.id, dateKey);
      const streak = getHabitStreak(app.state, habit.id);
      const habitName = escapeHtml(habit.name);

      return `
        <article class="habit-row ${complete ? "complete" : ""}">
          <button class="check-button" data-action="toggle" data-id="${habit.id}" type="button" aria-label="Toggle ${habitName}">
            <i data-lucide="${complete ? "check" : "circle"}" aria-hidden="true"></i>
          </button>
          <span class="habit-icon" style="--habit-color: ${habit.color}">${escapeHtml(habit.icon)}</span>
          <div class="habit-main">
            <strong>${habitName}</strong>
            <small>${plural(streak.current, "day")} current - ${plural(streak.longest, "day")} best</small>
          </div>
          <span class="status-chip">${complete ? "Done" : "Open"}</span>
          <button class="icon-button tiny" data-action="edit" data-id="${habit.id}" type="button" aria-label="Edit ${habitName}">
            <i data-lucide="pencil" aria-hidden="true"></i>
          </button>
        </article>
      `;
    })
    .join("");
}

function renderColorPresets() {
  dom.colorPresets.innerHTML = HABIT_COLORS.map(
    (color) => `
      <button class="color-chip" data-color="${color}" style="--chip-color: ${color}" type="button" aria-label="Use ${color}"></button>
    `,
  ).join("");
}

function renderTemplates() {
  const existingNames = new Set(app.state.habits.map((habit) => habit.name.toLowerCase()));

  dom.templateGrid.innerHTML = STUDENT_TEMPLATES.map((template) => {
    const exists = existingNames.has(template.name.toLowerCase());
    return `
      <button class="template-button" data-template="${escapeHtml(template.name)}" type="button" ${exists ? "disabled" : ""}>
        <span style="--habit-color: ${template.color}">${template.icon}</span>
        <strong>${escapeHtml(template.name)}</strong>
        <small>${exists ? "Added" : "Add"}</small>
      </button>
    `;
  }).join("");
}

function renderHabitLibrary() {
  if (!app.state.habits.length) {
    dom.habitLibrary.innerHTML = `
      <div class="empty-state">
        <i data-lucide="sparkles" aria-hidden="true"></i>
        <strong>No habits yet.</strong>
        <span>Use templates or create a custom habit.</span>
      </div>
    `;
    return;
  }

  dom.habitLibrary.innerHTML = `
    <div class="mini-head">
      <strong>Habit library</strong>
      <small>${app.state.habits.length} active</small>
    </div>
    ${app.state.habits
      .map((habit) => {
        const streak = getHabitStreak(app.state, habit.id);
        const habitName = escapeHtml(habit.name);
        return `
          <article class="library-row">
            <span class="habit-icon" style="--habit-color: ${habit.color}">${escapeHtml(habit.icon)}</span>
            <div>
              <strong>${habitName}</strong>
              <small>${plural(streak.longest, "day")} best streak</small>
            </div>
            <button class="icon-button tiny" data-action="edit" data-id="${habit.id}" type="button" aria-label="Edit ${habitName}">
              <i data-lucide="pencil" aria-hidden="true"></i>
            </button>
            <button class="icon-button tiny danger" data-action="delete" data-id="${habit.id}" type="button" aria-label="Delete ${habitName}">
              <i data-lucide="trash-2" aria-hidden="true"></i>
            </button>
          </article>
        `;
      })
      .join("")}
  `;
}

function renderAnalytics() {
  const weekly = getWeeklyAnalytics(app.state);
  const monthly = getMonthlyAnalytics(app.state, app.viewDate);
  const heatmap = getHeatmapData(app.state);
  const history = weekly.slice(-7);
  const unlocked = new Set(Object.keys(app.state.achievements));
  const weeklyDone = weekly.reduce((sum, item) => sum + item.completed, 0);

  dom.weeklyCompleted.textContent = `${weeklyDone} completed`;
  dom.weeklyChart.innerHTML = weekly
    .map((item) => `
      <div class="bar-item" title="${formatLongDate(item.date)}: ${item.percent}%">
        <span class="bar-track"><i style="height: ${Math.max(4, item.percent)}%"></i></span>
        <small>${formatWeekday(item.date)}</small>
      </div>
    `)
    .join("");

  dom.monthInsight.textContent = `${monthly.perfectDays} perfect days`;
  dom.monthRing.style.setProperty("--month-score", monthly.percent);
  dom.monthRingLabel.textContent = `${monthly.percent}%`;

  dom.heatmapGrid.innerHTML = heatmap
    .map((item) => `
      <button class="heat-cell" data-level="${item.level}" type="button" title="${formatShortDate(item.date)}: ${item.completed}/${item.total} complete"></button>
    `)
    .join("");

  dom.badgeCount.textContent = `${unlocked.size} unlocked`;
  dom.badgeGrid.innerHTML = ACHIEVEMENTS.map((achievement) => {
    const isUnlocked = unlocked.has(achievement.id);
    return `
      <article class="badge-card ${isUnlocked ? "unlocked" : ""}">
        <span>${achievement.icon}</span>
        <strong>${escapeHtml(achievement.title)}</strong>
        <small>${escapeHtml(achievement.description)}</small>
      </article>
    `;
  }).join("");

  dom.historyList.innerHTML = history
    .reverse()
    .map((item) => `
      <article class="history-row">
        <span>${formatShortDate(item.date)}</span>
        <strong>${item.completed}/${item.total}</strong>
        <i style="width: ${item.percent}%"></i>
      </article>
    `)
    .join("");
}

function renderStreaks() {
  if (!app.state.habits.length) {
    dom.streakGrid.innerHTML = `
      <div class="empty-state">
        <i data-lucide="flame" aria-hidden="true"></i>
        <strong>No streaks yet.</strong>
        <span>Add a habit to start a run.</span>
      </div>
    `;
    return;
  }

  dom.streakGrid.innerHTML = app.state.habits
    .map((habit) => {
      const streak = getHabitStreak(app.state, habit.id);
      const recovery = getRecoveryState(app.state, habit.id);
      const badge = streak.current >= 30 ? "Legend" : streak.current >= 14 ? "Elite" : streak.current >= 7 ? "Weekly" : streak.current >= 3 ? "Spark" : "Starter";

      return `
        <article class="streak-card" style="--habit-color: ${habit.color}">
          <span class="habit-icon">${escapeHtml(habit.icon)}</span>
          <div>
            <strong>${escapeHtml(habit.name)}</strong>
            <small class="${recovery.tone}">${escapeHtml(recovery.label)}</small>
          </div>
          <div class="streak-numbers">
            <span><b>${streak.current}</b> current</span>
            <span><b>${streak.longest}</b> longest</span>
          </div>
          <em>${badge}</em>
        </article>
      `;
    })
    .join("");
}

function render() {
  renderOverview();
  renderCalendar();
  renderSelectedDay();
  renderColorPresets();
  renderTemplates();
  renderHabitLibrary();
  renderAnalytics();
  renderStreaks();
  applyTheme();
  refreshIcons();
}

function resetHabitForm() {
  dom.habitForm.reset();
  dom.habitId.value = "";
  dom.habitColor.value = HABIT_COLORS[0];
  dom.habitFormTitle.textContent = "Create a habit";
  dom.saveHabitButton.textContent = "Save habit";
}

function editHabit(habitId) {
  const habit = app.state.habits.find((item) => item.id === habitId);
  if (!habit) return;

  dom.habitId.value = habit.id;
  dom.habitName.value = habit.name;
  dom.habitIcon.value = habit.icon;
  dom.habitColor.value = habit.color;
  dom.habitFormTitle.textContent = "Edit habit";
  dom.saveHabitButton.textContent = "Update habit";
  dom.habitName.focus();
}

function deleteHabit(habitId) {
  if (app.busy || !app.user) return;

  const habit = app.state.habits.find((item) => item.id === habitId);
  if (!habit) return;

  const confirmed = window.confirm(`Delete "${habit.name}" and its completion history?`);
  if (!confirmed) return;

  app.state.habits = app.state.habits.filter((item) => item.id !== habitId);
  Object.keys(app.state.completions).forEach((dateKey) => {
    delete app.state.completions[dateKey][habitId];
    if (Object.keys(app.state.completions[dateKey]).length === 0) {
      delete app.state.completions[dateKey];
    }
  });
  resetHabitForm();
  renderWithAchievements();
  showToast("Habit deleted", `${habit.name} was removed.`);
}

function saveHabit(event) {
  event.preventDefault();
  if (app.busy || !app.user) return;

  const name = dom.habitName.value.trim();
  const icon = dom.habitIcon.value.trim();
  const color = dom.habitColor.value;

  if (!name || !icon) {
    showToast("Missing habit detail", "Add a name and an emoji before saving.");
    return;
  }

  const editingId = dom.habitId.value;
  const duplicate = app.state.habits.some(
    (habit) => habit.name.toLowerCase() === name.toLowerCase() && habit.id !== editingId,
  );

  if (duplicate) {
    showToast("Already exists", "That habit is already in your tracker.");
    return;
  }

  const now = new Date().toISOString();

  if (editingId) {
    app.state.habits = app.state.habits.map((habit) =>
      habit.id === editingId
        ? {
            ...habit,
            name,
            icon,
            color,
            updatedAt: now,
          }
        : habit,
    );
  } else {
    app.state.habits.push({
      id: createId(),
      name,
      icon,
      color,
      createdAt: toDateKey(new Date()),
      updatedAt: now,
    });
  }

  resetHabitForm();
  renderWithAchievements();
}

function addTemplate(templateName) {
  if (app.busy || !app.user) return;

  const template = STUDENT_TEMPLATES.find((item) => item.name === templateName);
  if (!template) return;

  const exists = app.state.habits.some((habit) => habit.name.toLowerCase() === template.name.toLowerCase());
  if (exists) return;

  app.state.habits.push(createHabitFromTemplate(template));
  renderWithAchievements();
  showToast("Template added", `${template.icon} ${template.name} is ready.`);
}

function toggleCompletion(habitId) {
  if (app.busy || !app.user) return;

  const dateKey = toDateKey(app.selectedDate);
  const wasComplete = isHabitComplete(app.state, habitId, dateKey);
  const nextValue = !wasComplete;

  setHabitCompletion(app.state, habitId, dateKey, nextValue);
  const stats = getDayStats(app.state, dateKey);
  renderWithAchievements();

  if (stats.total > 0 && stats.completed === stats.total && !app.celebratedPerfectDays.has(dateKey)) {
    app.celebratedPerfectDays.add(dateKey);
    showToast("Perfect day", "Every habit is complete for this date.");
    burstConfetti();
  }
}

function exportBackup() {
  const backup = serializeBackup(app.state);
  const blob = new Blob([backup], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `momentum-habit-backup-${toDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Backup exported", "Your local habit data backup is ready.");
}

function importBackup(file) {
  if (app.busy || !app.user) return;

  const reader = new FileReader();

  reader.addEventListener("load", async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const importedState = normalizeState(parsed, app.state.settings);
      const confirmed = window.confirm("Import this backup and replace current local habit data?");
      if (!confirmed) return;

      setBusy(true, "Importing backup");
      app.state = importedState;
      app.viewDate = new Date();
      app.selectedDate = new Date();
      renderWithAchievements({ silent: true });
      showToast("Backup imported", "Your previous habit data has been restored locally.");
    } catch (error) {
      showError(error, "Choose a valid Momentum JSON backup.");
    } finally {
      setBusy(false);
      dom.importFile.value = "";
    }
  });

  reader.readAsText(file);
}

function initApp() {
  app.state = loadStoredState({ theme: initialTheme });
  applyTheme();
  refreshIcons();

  const storedName = loadStoredName();
  if (storedName) {
    openDashboard(storedName);
    return;
  }

  showWelcome();
}

function bindEvents() {
  dom.welcomeForm.addEventListener("submit", handleWelcomeSubmit);
  dom.changeNameButton.addEventListener("click", showNameEditor);

  dom.prevMonth.addEventListener("click", () => {
    app.viewDate = addMonths(app.viewDate, -1);
    render();
  });

  dom.nextMonth.addEventListener("click", () => {
    app.viewDate = addMonths(app.viewDate, 1);
    render();
  });

  dom.todayButton.addEventListener("click", () => {
    app.viewDate = new Date();
    app.selectedDate = new Date();
    render();
  });

  dom.calendarGrid.addEventListener("click", (event) => {
    const day = event.target.closest("[data-date]");
    if (!day) return;

    app.selectedDate = new Date(`${day.dataset.date}T00:00:00`);
    app.viewDate = new Date(app.selectedDate.getFullYear(), app.selectedDate.getMonth(), 1);
    render();
  });

  dom.habitList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    if (actionButton.dataset.action === "toggle") toggleCompletion(actionButton.dataset.id);
    if (actionButton.dataset.action === "edit") editHabit(actionButton.dataset.id);
  });

  dom.habitLibrary.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    if (actionButton.dataset.action === "edit") editHabit(actionButton.dataset.id);
    if (actionButton.dataset.action === "delete") deleteHabit(actionButton.dataset.id);
  });

  dom.habitForm.addEventListener("submit", saveHabit);
  dom.resetHabitForm.addEventListener("click", resetHabitForm);

  dom.colorPresets.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-color]");
    if (chip) dom.habitColor.value = chip.dataset.color;
  });

  dom.templateGrid.addEventListener("click", (event) => {
    const templateButton = event.target.closest("[data-template]");
    if (templateButton) addTemplate(templateButton.dataset.template);
  });

  dom.searchHabits.addEventListener("input", render);
  dom.habitFilter.addEventListener("change", render);

  dom.themeToggle.addEventListener("click", () => {
    app.state.settings.theme = app.state.settings.theme === "dark" ? "light" : "dark";
    render();
    persistState();
  });

  dom.exportButton.addEventListener("click", exportBackup);
  dom.importButton.addEventListener("click", () => dom.importFile.click());
  dom.importFile.addEventListener("change", () => {
    const [file] = dom.importFile.files;
    if (file) importBackup(file);
  });
}

bindEvents();
initApp();
