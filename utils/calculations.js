/**
 * Calculation Utilities for Mocha Study Tracker
 *
 * This file contains pure functions for calculating various metrics.
 * "Pure" means they don't modify any data - they just take inputs and return outputs.
 * This makes them easy to test and reason about.
 *
 * These are like Python helper functions - reusable logic extracted into one place.
 */

import { TIME, DAYS } from './constants.js';

// ============================================
// DATE/WEEK CALCULATIONS
// ============================================

/**
 * Gets the start of the week (Monday) for a given date
 * JavaScript's Date.getDay() returns 0 for Sunday, 1 for Monday, etc.
 *
 * @param {Date} date - Any date
 * @param {'monday'|'sunday'} weekStartDay - Which day starts the week
 * @returns {Date} The Monday (or Sunday) of that week at 00:00:00
 */
export function getWeekStart(date, weekStartDay = 'monday') {
  const d = new Date(date);
  const day = d.getDay();

  // Calculate days to subtract to get to week start
  let diff;
  if (weekStartDay === 'monday') {
    // If Sunday (0), go back 6 days. Otherwise go back (day - 1) days.
    diff = day === 0 ? 6 : day - 1;
  } else {
    // Sunday start: just subtract the day number
    diff = day;
  }

  d.setDate(d.getDate() - diff);
  // Reset to start of day
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Gets the end of the week (Sunday or Saturday) for a given date
 *
 * @param {Date} date - Any date
 * @param {'monday'|'sunday'} weekStartDay - Which day starts the week
 * @returns {Date} The Sunday (or Saturday) of that week at 23:59:59
 */
export function getWeekEnd(date, weekStartDay = 'monday') {
  const weekStart = getWeekStart(date, weekStartDay);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Gets the current week's date range
 * Returns ISO date strings for easy storage and comparison
 *
 * @param {'monday'|'sunday'} weekStartDay - Which day starts the week
 * @returns {{start: string, end: string}} Start and end dates as ISO strings (date only)
 */
export function getCurrentWeekRange(weekStartDay = 'monday') {
  const now = new Date();
  const start = getWeekStart(now, weekStartDay);
  const end = getWeekEnd(now, weekStartDay);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

/**
 * Gets the week number of the year (1-52)
 * Useful for comparing weeks across months
 *
 * @param {Date} date - Any date
 * @returns {number} Week number (1-52)
 */
export function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Set to nearest Thursday (makes week counting more consistent)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  // Get first week's Thursday
  const week1 = new Date(d.getFullYear(), 0, 4);
  // Calculate full weeks between them
  return 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
}

/**
 * Checks if two dates are the same day
 *
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {boolean} True if same day
 */
export function isSameDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Checks if a date is today
 *
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if today
 */
export function isToday(date) {
  return isSameDay(date, new Date());
}

/**
 * Checks if a date is within the current week
 *
 * @param {Date|string} date - Date to check
 * @param {'monday'|'sunday'} weekStartDay - Which day starts the week
 * @returns {boolean} True if in current week
 */
export function isThisWeek(date, weekStartDay = 'monday') {
  const { start, end } = getCurrentWeekRange(weekStartDay);
  const d = new Date(date);
  const dateStr = d.toISOString().split('T')[0];
  return dateStr >= start && dateStr <= end;
}

// ============================================
// PROGRESS CALCULATIONS
// ============================================

/**
 * Calculates weekly progress for each goal
 * This is the main progress calculation function
 *
 * @param {import('../models/data-models.js').Session[]} sessions - Sessions to analyze
 * @param {import('../models/data-models.js').Task[]} tasks - Tasks to analyze
 * @param {import('../models/data-models.js').Goal[]} goals - Goals to calculate for
 * @param {string} weekStart - ISO date string for week start
 * @returns {import('../models/data-models.js').WeeklyProgress} Calculated progress
 */
export function calculateWeeklyProgress(sessions, tasks, goals, weekStart) {
  console.log('=======================================');
  console.log('CALCULATE WEEKLY PROGRESS CALLED!!!!');
  console.log('=======================================');
  console.log('Sessions passed in:', sessions?.length || 0);
  console.log('First session:', sessions?.[0]);
  
  const weekEnd = getWeekEnd(new Date(weekStart)).toISOString().split('T')[0];

  console.log('[calculations] calculateWeeklyProgress called');
  console.log('[calculations] Week range:', weekStart, 'to', weekEnd);
  console.log('[calculations] Sessions count:', sessions.length);
  console.log('[calculations] Goals count:', goals.length);

  // Initialize progress object
  // Using reduce is like Python's dict comprehension: {g.id: {...} for g in goals}
  const progress = {
    weekStart: weekStart,
    weekEnd: weekEnd,
    goals: {},
    totalHours: 0,
    totalTasks: 0
  };

  // Initialize progress for each goal
  goals.forEach(goal => {
    console.log('[calculations] Initializing goal:', goal.id, goal.name);
    progress.goals[goal.id] = {
      hoursCompleted: 0,
      tasksCompleted: 0
    };
  });

  console.log('[calculations] About to process sessions...');
  console.log('[calculations] Sessions array:', sessions);
  console.log('[calculations] Sessions is array?', Array.isArray(sessions));
  console.log('[calculations] Sessions length:', sessions?.length);

  // Calculate hours from sessions
  sessions.forEach(session => {
    const sessionDate = new Date(session.startTime).toISOString().split('T')[0];
    
    const inRange = sessionDate >= weekStart && sessionDate <= weekEnd;
    const goalExists = !!progress.goals[session.goalId];
    
    console.log('[calculations] Session check:', session.goalId);
    console.log('[calculations]   Session date:', sessionDate);
    console.log('[calculations]   Week start:', weekStart);
    console.log('[calculations]   Week end:', weekEnd);
    console.log('[calculations]   In range?', inRange);
    console.log('[calculations]   Goal exists?', goalExists);

    // Check if session is within the week
    if (inRange) {
      console.log('[calculations]   ✓ Session IS in week range');
      if (goalExists) {
        console.log('[calculations]   ✓ Goal EXISTS in progress');
        // Convert seconds to hours
        const hours = session.duration / TIME.secondsPerHour;
        progress.goals[session.goalId].hoursCompleted += hours;
        progress.totalHours += hours;
        console.log('[calculations]   ✓ Added', hours, 'hours. Total now:', progress.goals[session.goalId].hoursCompleted);
      } else {
        console.log('[calculations]   ✗ Goal NOT FOUND in progress.goals!');
      }
    } else {
      console.log('[calculations]   ✗ Session NOT in week range');
    }
  });

  // Calculate completed tasks
  tasks.forEach(task => {
    if (task.completed && task.completedAt) {
      const completedDate = new Date(task.completedAt).toISOString().split('T')[0];

      if (completedDate >= weekStart && completedDate <= weekEnd) {
        if (progress.goals[task.goalId]) {
          progress.goals[task.goalId].tasksCompleted += 1;
          progress.totalTasks += 1;
        }
      }
    }
  });

  // Round hours to 2 decimal places for cleaner display
  progress.totalHours = Math.round(progress.totalHours * 100) / 100;
  Object.keys(progress.goals).forEach(goalId => {
    progress.goals[goalId].hoursCompleted =
      Math.round(progress.goals[goalId].hoursCompleted * 100) / 100;
  });

  return progress;
}

/**
 * Calculates total hours from an array of sessions
 *
 * @param {import('../models/data-models.js').Session[]} sessions - Sessions to sum
 * @returns {number} Total hours (with 2 decimal precision)
 */
export function calculateTotalHours(sessions) {
  const totalSeconds = sessions.reduce((sum, session) => sum + session.duration, 0);
  return Math.round((totalSeconds / TIME.secondsPerHour) * 100) / 100;
}

/**
 * Calculates the percentage of a goal completed
 *
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @returns {number} Percentage (0-100), capped at 100
 */
export function calculatePercentage(current, target) {
  if (!target || target <= 0) return 0;
  const percentage = (current / target) * 100;
  return Math.min(100, Math.round(percentage));
}

// ============================================
// STREAK CALCULATIONS
// ============================================

/**
 * Calculates streak from session history
 * A streak is consecutive days with at least one session
 *
 * @param {import('../models/data-models.js').Session[]} sessions - All sessions
 * @returns {{current: number, longest: number}} Current and longest streak
 */
export function calculateStreak(sessions) {
  if (sessions.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Get unique study dates, sorted newest first
  const studyDates = [...new Set(
    sessions.map(s => new Date(s.startTime).toISOString().split('T')[0])
  )].sort().reverse();

  if (studyDates.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Check if streak is still active (studied today or yesterday)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const isActive = studyDates[0] === today || studyDates[0] === yesterdayStr;

  // Calculate current streak
  let currentStreak = 0;
  if (isActive) {
    currentStreak = 1;
    for (let i = 1; i < studyDates.length; i++) {
      const prevDate = new Date(studyDates[i - 1]);
      const currDate = new Date(studyDates[i]);
      const diffDays = Math.round((prevDate - currDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak (check all consecutive sequences)
  let longestStreak = currentStreak;
  let tempStreak = 1;

  for (let i = 1; i < studyDates.length; i++) {
    const prevDate = new Date(studyDates[i - 1]);
    const currDate = new Date(studyDates[i]);
    const diffDays = Math.round((prevDate - currDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  return { current: currentStreak, longest: longestStreak };
}

/**
 * Checks if the user's streak is still active
 * Streak breaks if user didn't study yesterday
 *
 * @param {string|null} lastStudyDate - ISO date string of last study (date only)
 * @returns {boolean} True if streak is active
 */
export function isOnStreak(lastStudyDate) {
  if (!lastStudyDate) return false;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  return lastStudyDate === today || lastStudyDate === yesterdayStr;
}

// ============================================
// FORMATTING FUNCTIONS
// ============================================

/**
 * Formats seconds into a human-readable duration string
 * Examples: "1h 23m", "45m", "5m 30s"
 *
 * @param {number} seconds - Duration in seconds
 * @param {boolean} includeSeconds - Whether to show seconds for short durations
 * @returns {string} Formatted duration string
 */
export function formatDuration(seconds, includeSeconds = false) {
  if (seconds < 0) seconds = 0;

  const hours = Math.floor(seconds / TIME.secondsPerHour);
  const minutes = Math.floor((seconds % TIME.secondsPerHour) / TIME.secondsPerMinute);
  const secs = Math.floor(seconds % TIME.secondsPerMinute);

  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }

  if (includeSeconds && (secs > 0 || parts.length === 0)) {
    parts.push(`${secs}s`);
  }

  // If no parts (0 seconds and not showing seconds), show "0m"
  if (parts.length === 0) {
    parts.push('0m');
  }

  return parts.join(' ');
}

/**
 * Formats seconds into timer display format (HH:MM:SS or MM:SS)
 *
 * @param {number} seconds - Duration in seconds
 * @returns {string} Timer format like "01:23:45" or "23:45"
 */
export function formatTimer(seconds) {
  if (seconds < 0) seconds = 0;

  const hours = Math.floor(seconds / TIME.secondsPerHour);
  const minutes = Math.floor((seconds % TIME.secondsPerHour) / TIME.secondsPerMinute);
  const secs = Math.floor(seconds % TIME.secondsPerMinute);

  const pad = (n) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

/**
 * Formats a date for display
 *
 * @param {Date|string} date - Date to format
 * @param {'short'|'long'|'relative'} format - Format type
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'short') {
  const d = new Date(date);

  switch (format) {
    case 'short':
      // "Mon, Jan 5"
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });

    case 'long':
      // "Monday, January 5, 2024"
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

    case 'relative':
      // "Today", "Yesterday", "2 days ago", etc.
      return getRelativeDate(d);

    default:
      return d.toLocaleDateString();
  }
}

/**
 * Gets a relative date string ("Today", "Yesterday", "3 days ago", etc.)
 *
 * @param {Date} date - Date to describe
 * @returns {string} Relative description
 */
function getRelativeDate(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today - target;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return 'Last week';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return 'Last month';
  return `${Math.floor(diffDays / 30)} months ago`;
}

// ============================================
// ELAPSED TIME CALCULATION
// ============================================

/**
 * Calculates elapsed time for an active session
 * Accounts for pauses
 *
 * @param {import('../models/data-models.js').ActiveSession} activeSession - Active session
 * @returns {number} Elapsed seconds (excluding paused time)
 */
export function calculateElapsedTime(activeSession) {
  if (!activeSession) return 0;

  const startTime = new Date(activeSession.startTime).getTime();
  const now = Date.now();

  // If paused, use pausedAt time instead of now
  const endTime = activeSession.pausedAt
    ? new Date(activeSession.pausedAt).getTime()
    : now;

  // Total elapsed minus total paused time
  const totalElapsed = (endTime - startTime) / 1000;
  const activeTime = totalElapsed - activeSession.totalPausedDuration;

  return Math.max(0, Math.floor(activeTime));
}
