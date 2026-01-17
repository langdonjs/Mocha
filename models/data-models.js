/**
 * Data Models for Mocha Study Tracker
 *
 * This file defines the structure of all data objects used in the app.
 * We use JSDoc type definitions for documentation and IDE support.
 * In a larger project, you might use TypeScript, but plain JS with JSDoc
 * works great for Chrome extensions and is easier for beginners.
 *
 * Think of these as "schemas" - they describe what our data looks like.
 * Similar to Python dataclasses or TypedDict.
 */

// ============================================
// CHARACTER - The user's bear companion
// ============================================

/**
 * @typedef {Object} Character
 * @property {string} name - User-chosen name for their bear (e.g., "Cocoa", "Teddy")
 * @property {'brown'|'black'|'polar'|'panda'|'grizzly'} species - Type of bear
 * @property {CharacterCustomization} customization - Currently equipped items
 * @property {CharacterInventory} inventory - All owned items
 * @property {string} createdAt - ISO date string when character was created
 */

/**
 * @typedef {Object} CharacterCustomization
 * @property {string|null} outfit - ID of currently equipped outfit (null = default)
 * @property {string[]} accessories - Array of equipped accessory IDs
 * @property {string|null} background - ID of room background (null = default)
 */

/**
 * @typedef {Object} CharacterInventory
 * @property {string[]} outfits - Array of owned outfit IDs
 * @property {string[]} accessories - Array of owned accessory IDs
 * @property {string[]} decorations - Array of owned decoration IDs
 * @property {string[]} backgrounds - Array of owned background IDs
 */

/**
 * Creates a new Character object with default values
 * This is like a "factory function" - it creates properly structured objects
 *
 * @param {string} name - The bear's name
 * @param {string} species - The bear species
 * @returns {Character}
 */
export function createCharacter(name, species) {
  return {
    name: name,
    species: species,
    customization: {
      outfit: null,
      accessories: [],
      background: null
    },
    inventory: {
      outfits: [],
      accessories: [],
      decorations: [],
      backgrounds: []
    },
    createdAt: new Date().toISOString()
  };
}

// ============================================
// GOAL - Something the user wants to track
// ============================================

/**
 * @typedef {Object} Goal
 * @property {string} id - Unique identifier (generated with timestamp + random)
 * @property {string} name - Display name (e.g., "CS61B", "Leetcode Practice")
 * @property {'class'|'coding'|'work'|'personal'|'other'} category - Type of goal
 * @property {string} icon - Emoji icon for visual identification
 * @property {string} color - Hex color code for UI theming (e.g., "#4A90A4")
 * @property {boolean} trackHours - Whether to track time spent
 * @property {number|null} weeklyHourGoal - Target hours per week (null if not tracking)
 * @property {boolean} trackTasks - Whether to track tasks/assignments
 * @property {number|null} weeklyTaskGoal - Target tasks per week (null if not tracking)
 * @property {string} taskUnit - What to call tasks (e.g., "assignments", "problems", "chapters")
 * @property {string} createdAt - ISO date string
 * @property {boolean} archived - Whether goal is archived (hidden from main view)
 */

/**
 * Creates a new Goal object
 *
 * @param {Object} params - Goal parameters
 * @param {string} params.name - Goal name
 * @param {string} params.category - Goal category
 * @param {string} params.icon - Emoji icon
 * @param {string} params.color - Hex color
 * @param {boolean} params.trackHours - Track hours?
 * @param {number|null} params.weeklyHourGoal - Hours goal
 * @param {boolean} params.trackTasks - Track tasks?
 * @param {number|null} params.weeklyTaskGoal - Tasks goal
 * @param {string} params.taskUnit - Task unit name
 * @returns {Goal}
 */
export function createGoal(params) {
  // Generate unique ID: timestamp + random string
  // This ensures uniqueness even if creating goals in rapid succession
  const id = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    id: id,
    name: params.name,
    category: params.category || 'other',
    icon: params.icon || '📚',
    color: params.color || '#4A90A4',
    trackHours: params.trackHours !== false, // Default true
    weeklyHourGoal: params.weeklyHourGoal || null,
    trackTasks: params.trackTasks || false,
    weeklyTaskGoal: params.weeklyTaskGoal || null,
    taskUnit: params.taskUnit || 'tasks',
    createdAt: new Date().toISOString(),
    archived: false
  };
}

// ============================================
// TASK - An individual assignment or item
// ============================================

/**
 * @typedef {Object} Task
 * @property {string} id - Unique identifier
 * @property {string} goalId - Foreign key linking to parent Goal
 * @property {string} name - Task name (e.g., "Project 1A", "Two Sum")
 * @property {boolean} completed - Whether task is finished
 * @property {string|null} completedAt - ISO string when completed (null if not done)
 * @property {string|null} dueDate - ISO string for deadline (null if no deadline)
 * @property {'easy'|'medium'|'hard'} difficulty - Affects points earned
 * @property {string} notes - User notes about the task
 * @property {number} timeSpent - Total seconds spent on this task
 * @property {string|null} sessionId - ID of session where it was completed (for history)
 * @property {string} createdAt - ISO date string
 */

/**
 * Creates a new Task object
 *
 * @param {Object} params - Task parameters
 * @param {string} params.goalId - Parent goal ID
 * @param {string} params.name - Task name
 * @param {string} [params.dueDate] - Optional due date
 * @param {string} [params.difficulty] - easy/medium/hard
 * @param {string} [params.notes] - Optional notes
 * @returns {Task}
 */
export function createTask(params) {
  const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    id: id,
    goalId: params.goalId,
    name: params.name,
    completed: false,
    completedAt: null,
    dueDate: params.dueDate || null,
    difficulty: params.difficulty || 'medium',
    notes: params.notes || '',
    timeSpent: 0,
    sessionId: null,
    createdAt: new Date().toISOString()
  };
}

// ============================================
// SESSION - A completed study session
// ============================================

/**
 * @typedef {Object} Session
 * @property {string} id - Unique identifier
 * @property {string} goalId - Which goal this session was for
 * @property {string} startTime - ISO string when session started
 * @property {string} endTime - ISO string when session ended
 * @property {number} duration - Total active time in seconds (excludes pauses)
 * @property {'free'|'pomodoro'} mode - Session type
 * @property {number} pomodorosCompleted - Number of pomodoros finished (if pomodoro mode)
 * @property {string|null} taskId - Specific task worked on (if any)
 * @property {boolean} taskCompleted - Whether the task was completed this session
 * @property {number} pointsEarned - Points awarded for this session
 * @property {number} pausedDuration - Total time paused in seconds
 * @property {boolean} isManual - Whether this was manually entered (not timed)
 * @property {string} notes - Session notes
 * @property {string} createdAt - ISO date string
 */

/**
 * Creates a new Session object from an active session
 *
 * @param {Object} params - Session parameters
 * @returns {Session}
 */
export function createSession(params) {
  const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    id: id,
    goalId: params.goalId,
    startTime: params.startTime,
    endTime: params.endTime || new Date().toISOString(),
    duration: params.duration || 0,
    mode: params.mode || 'free',
    pomodorosCompleted: params.pomodorosCompleted || 0,
    taskId: params.taskId || null,
    taskCompleted: params.taskCompleted || false,
    pointsEarned: params.pointsEarned || 0,
    pausedDuration: params.pausedDuration || 0,
    isManual: params.isManual || false,
    notes: params.notes || '',
    createdAt: new Date().toISOString()
  };
}

// ============================================
// ACTIVE SESSION - Currently running session
// ============================================

/**
 * @typedef {Object} ActiveSession
 * @property {string} goalId - Goal being worked on
 * @property {string|null} taskId - Specific task (if any)
 * @property {string} startTime - ISO string when started
 * @property {string|null} pausedAt - ISO string when paused (null if running)
 * @property {number} totalPausedDuration - Accumulated pause time in seconds
 * @property {'free'|'pomodoro'} mode - Session mode
 * @property {PomodoroSettings|null} pomodoroSettings - Pomodoro config (if applicable)
 * @property {number} pomodorosCompleted - Pomodoros finished so far
 */

/**
 * @typedef {Object} PomodoroSettings
 * @property {number} workMinutes - Work interval length
 * @property {number} breakMinutes - Short break length
 * @property {number} longBreakMinutes - Long break length
 * @property {number} longBreakInterval - Pomodoros before long break
 */

/**
 * Creates a new ActiveSession object
 *
 * @param {Object} params - Active session parameters
 * @returns {ActiveSession}
 */
export function createActiveSession(params) {
  return {
    goalId: params.goalId,
    taskId: params.taskId || null,
    startTime: new Date().toISOString(),
    pausedAt: null,
    totalPausedDuration: 0,
    mode: params.mode || 'free',
    pomodoroSettings: params.pomodoroSettings || null,
    pomodorosCompleted: 0
  };
}

// ============================================
// GAMIFICATION - Points and streaks
// ============================================

/**
 * @typedef {Object} Gamification
 * @property {number} totalPoints - Current spendable points
 * @property {number} lifetimePoints - Total points ever earned (never decreases)
 * @property {number} pointsThisWeek - Points earned this week (resets weekly)
 * @property {number} currentStreak - Consecutive days with study sessions
 * @property {number} longestStreak - Best streak ever achieved
 * @property {string|null} lastStudyDate - ISO date string of last study day (date only, not time)
 */

/**
 * Creates initial Gamification object for new users
 *
 * @returns {Gamification}
 */
export function createGamification() {
  return {
    totalPoints: 0,
    lifetimePoints: 0,
    pointsThisWeek: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null
  };
}

// ============================================
// WEEKLY PROGRESS - Cached calculations
// ============================================

/**
 * @typedef {Object} WeeklyProgress
 * @property {string} weekStart - ISO date string for Monday of current week
 * @property {string} weekEnd - ISO date string for Sunday of current week
 * @property {Object.<string, GoalProgress>} goals - Progress per goal, keyed by goal ID
 * @property {number} totalHours - Total hours studied this week
 * @property {number} totalTasks - Total tasks completed this week
 */

/**
 * @typedef {Object} GoalProgress
 * @property {number} hoursCompleted - Hours studied toward this goal
 * @property {number} tasksCompleted - Tasks finished for this goal
 */

/**
 * Creates a new WeeklyProgress object
 *
 * @param {string} weekStart - Monday of the week
 * @param {string} weekEnd - Sunday of the week
 * @returns {WeeklyProgress}
 */
export function createWeeklyProgress(weekStart, weekEnd) {
  return {
    weekStart: weekStart,
    weekEnd: weekEnd,
    goals: {},
    totalHours: 0,
    totalTasks: 0
  };
}

// ============================================
// SETTINGS - User preferences
// ============================================

/**
 * @typedef {Object} Settings
 * @property {'light'|'dark'|'system'} theme - UI theme
 * @property {TimerDefaults} timerDefaults - Default timer settings
 * @property {NotificationSettings} notifications - Notification preferences
 * @property {IdleSettings} idleDetection - Idle detection settings
 * @property {'monday'|'sunday'} weekStartDay - When the week starts
 */

/**
 * @typedef {Object} TimerDefaults
 * @property {'free'|'pomodoro'} mode - Default session mode
 * @property {number} pomodoroWork - Work interval in minutes
 * @property {number} pomodoroBreak - Short break in minutes
 * @property {number} pomodoroLongBreak - Long break in minutes
 * @property {number} pomodoroLongBreakInterval - Work sessions before long break
 */

/**
 * @typedef {Object} NotificationSettings
 * @property {boolean} enabled - Master notification toggle
 * @property {boolean} sessionComplete - Notify when session ends
 * @property {boolean} goalReminders - Remind about unmet goals
 * @property {boolean} streakReminders - Remind to maintain streak
 */

/**
 * @typedef {Object} IdleSettings
 * @property {boolean} enabled - Whether to detect idle
 * @property {number} timeoutMinutes - Minutes of inactivity before auto-pause
 */

/**
 * Creates default Settings object for new users
 *
 * @returns {Settings}
 */
export function createSettings() {
  return {
    theme: 'light',
    timerDefaults: {
      mode: 'free',
      pomodoroWork: 25,
      pomodoroBreak: 5,
      pomodoroLongBreak: 15,
      pomodoroLongBreakInterval: 4
    },
    notifications: {
      enabled: true,
      sessionComplete: true,
      goalReminders: true,
      streakReminders: true
    },
    idleDetection: {
      enabled: true,
      timeoutMinutes: 5
    },
    weekStartDay: 'monday'
  };
}
