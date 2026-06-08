import { HABIT_COLORS, STUDENT_TEMPLATES } from "./constants.js";
import { toDateKey } from "./date-utils.js";

export const USER_NAME_STORAGE_KEY = "momentum-habit-tracker:name";
export const HABIT_STATE_STORAGE_KEY = "momentum-habit-tracker:state";

function getLocalStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createId() {
  return crypto.randomUUID();
}

export function createHabitFromTemplate(template) {
  const today = toDateKey(new Date());

  return {
    id: createId(),
    name: template.name.trim(),
    icon: template.icon.trim() || "✓",
    color: template.color || HABIT_COLORS[0],
    createdAt: today,
    updatedAt: new Date().toISOString(),
  };
}

export function createEmptyState(settings = {}) {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    settings: {
      theme: settings.theme || "light",
    },
    habits: [],
    completions: {},
    achievements: {},
  };
}

export function createStarterState(settings = {}) {
  return {
    ...createEmptyState(settings),
    habits: STUDENT_TEMPLATES.slice(0, 4).map(createHabitFromTemplate),
  };
}

function normalizeAchievements(achievements) {
  if (!achievements || typeof achievements !== "object") return {};

  return Object.fromEntries(
    Object.entries(achievements)
      .filter(([id, unlockedAt]) => id && typeof unlockedAt === "string")
      .map(([id, unlockedAt]) => [String(id), unlockedAt]),
  );
}

function normalizeHabit(habit, index) {
  return {
    id: String(habit.id || createId()),
    name: String(habit.name || habit.title || "Untitled habit").trim().slice(0, 42),
    icon: String(habit.icon || "✓").trim().slice(0, 4),
    color: /^#[0-9a-f]{6}$/i.test(habit.color) ? habit.color : HABIT_COLORS[index % HABIT_COLORS.length],
    createdAt: /^\d{4}-\d{2}-\d{2}$/.test(habit.createdAt) ? habit.createdAt : toDateKey(new Date()),
    updatedAt: habit.updatedAt || new Date().toISOString(),
  };
}

export function normalizeState(input, settings = {}) {
  const raw = input?.data || input || {};
  const fallback = createStarterState(raw.settings || settings);
  const habits = Array.isArray(raw.habits) ? raw.habits.map(normalizeHabit) : fallback.habits;
  const knownIds = new Set(habits.map((habit) => habit.id));
  const completions = {};
  const theme =
    raw.settings?.theme === "dark" || raw.settings?.theme === "light"
      ? raw.settings.theme
      : settings.theme === "dark"
        ? "dark"
        : "light";

  if (raw.completions && typeof raw.completions === "object") {
    Object.entries(raw.completions).forEach(([dateKey, day]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !day || typeof day !== "object") return;

      Object.entries(day).forEach(([habitId, value]) => {
        if (!knownIds.has(habitId) || value !== true) return;
        completions[dateKey] = completions[dateKey] || {};
        completions[dateKey][habitId] = true;
      });
    });
  }

  return {
    version: 1,
    createdAt: raw.createdAt || fallback.createdAt,
    settings: {
      theme,
    },
    habits,
    completions,
    achievements: normalizeAchievements(raw.achievements),
  };
}

export function loadStoredName() {
  const storage = getLocalStorage();
  if (!storage) return "";

  return (storage.getItem(USER_NAME_STORAGE_KEY) || "").trim();
}

export function saveStoredName(name) {
  const storage = getLocalStorage();
  const normalizedName = String(name || "").trim();
  if (!storage || !normalizedName) return normalizedName;

  storage.setItem(USER_NAME_STORAGE_KEY, normalizedName);
  return normalizedName;
}

export function loadStoredState(settings = {}) {
  const storage = getLocalStorage();
  if (!storage) return createStarterState(settings);

  try {
    const rawState = storage.getItem(HABIT_STATE_STORAGE_KEY);
    return rawState ? normalizeState(JSON.parse(rawState), settings) : createStarterState(settings);
  } catch {
    return createStarterState(settings);
  }
}

export function saveStoredState(state) {
  const storage = getLocalStorage();
  if (!storage) return;

  storage.setItem(HABIT_STATE_STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

export function serializeBackup(state) {
  return JSON.stringify(
    {
      app: "Momentum Student Habit Calendar",
      exportedAt: new Date().toISOString(),
      data: normalizeState(state),
    },
    null,
    2,
  );
}
