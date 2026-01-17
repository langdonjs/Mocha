/**
 * Storage Utilities for Mocha Study Tracker
 *
 * This file provides a clean API for interacting with chrome.storage.local.
 * All functions are async and return Promises, making them easy to use with await.
 *
 * Why chrome.storage.local instead of localStorage?
 * - Works in service workers (background scripts)
 * - Larger storage limit (5MB vs 5MB, but more reliable)
 * - Syncs across Chrome profiles (if using chrome.storage.sync)
 * - Better for extensions - it's the recommended approach
 *
 * This is similar to Python's database helper functions - we wrap the raw API
 * with friendlier functions that handle errors and edge cases.
 */

import { STORAGE_KEYS } from './constants.js';
import {
  createCharacter,
  createGamification,
  createSettings,
  createWeeklyProgress
} from '../models/data-models.js';
import { getCurrentWeekRange } from './calculations.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generic get function - retrieves data from storage
 * Like Python's dict.get() with a default value
 *
 * @param {string} key - Storage key to retrieve
 * @param {*} defaultValue - Value to return if key doesn't exist
 * @returns {Promise<*>} The stored value or defaultValue
 */
async function get(key, defaultValue = null) {
  try {
    // chrome.storage.local.get returns an object with the key as property
    // If key doesn't exist, that property will be undefined
    const result = await chrome.storage.local.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  } catch (error) {
    console.error(`[Storage] Error getting ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Generic set function - saves data to storage
 *
 * @param {string} key - Storage key
 * @param {*} value - Value to store (will be JSON serialized automatically)
 * @returns {Promise<boolean>} True if successful, false if error
 */
async function set(key, value) {
  try {
    // chrome.storage.local.set takes an object
    await chrome.storage.local.set({ [key]: value });
    return true;
  } catch (error) {
    console.error(`[Storage] Error setting ${key}:`, error);
    return false;
  }
}

/**
 * Generic remove function - deletes data from storage
 *
 * @param {string} key - Storage key to remove
 * @returns {Promise<boolean>} True if successful
 */
async function remove(key) {
  try {
    await chrome.storage.local.remove(key);
    return true;
  } catch (error) {
    console.error(`[Storage] Error removing ${key}:`, error);
    return false;
  }
}

// ============================================
// CHARACTER FUNCTIONS
// ============================================

/**
 * Saves the character to storage
 * Used during onboarding and when customizing the bear
 *
 * @param {import('../models/data-models.js').Character} character - Character object
 * @returns {Promise<boolean>} Success status
 */
export async function saveCharacter(character) {
  return await set(STORAGE_KEYS.character, character);
}

/**
 * Retrieves the character from storage
 * Returns null if no character exists (user hasn't completed onboarding)
 *
 * @returns {Promise<import('../models/data-models.js').Character|null>}
 */
export async function getCharacter() {
  return await get(STORAGE_KEYS.character, null);
}

// ============================================
// GOALS FUNCTIONS
// ============================================

/**
 * Saves a single goal
 * Adds it to the existing goals array or updates if ID exists
 *
 * @param {import('../models/data-models.js').Goal} goal - Goal object
 * @returns {Promise<boolean>} Success status
 */
export async function saveGoal(goal) {
  try {
    const goals = await getGoals();
    // Check if goal already exists (update) or is new (add)
    const existingIndex = goals.findIndex(g => g.id === goal.id);

    if (existingIndex >= 0) {
      // Update existing goal
      goals[existingIndex] = goal;
    } else {
      // Add new goal
      goals.push(goal);
    }

    return await set(STORAGE_KEYS.goals, goals);
  } catch (error) {
    console.error('[Storage] Error saving goal:', error);
    return false;
  }
}

/**
 * Gets all goals (including archived ones)
 * To get only active goals, filter the result: goals.filter(g => !g.archived)
 *
 * @returns {Promise<import('../models/data-models.js').Goal[]>}
 */
export async function getGoals() {
  return await get(STORAGE_KEYS.goals, []);
}

/**
 * Gets a single goal by ID
 *
 * @param {string} id - Goal ID to find
 * @returns {Promise<import('../models/data-models.js').Goal|null>}
 */
export async function getGoalById(id) {
  const goals = await getGoals();
  return goals.find(g => g.id === id) || null;
}

/**
 * Updates specific fields of a goal
 * This is like Python's dict.update() - merges updates into existing object
 *
 * @param {string} id - Goal ID to update
 * @param {Object} updates - Fields to update (partial Goal object)
 * @returns {Promise<boolean>} Success status
 */
export async function updateGoal(id, updates) {
  try {
    const goals = await getGoals();
    const index = goals.findIndex(g => g.id === id);

    if (index < 0) {
      console.warn(`[Storage] Goal ${id} not found for update`);
      return false;
    }

    // Merge updates into existing goal (spread operator = shallow merge)
    goals[index] = { ...goals[index], ...updates };
    return await set(STORAGE_KEYS.goals, goals);
  } catch (error) {
    console.error('[Storage] Error updating goal:', error);
    return false;
  }
}

/**
 * Deletes a goal permanently
 * Warning: This also removes associated tasks and sessions!
 *
 * @param {string} id - Goal ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteGoal(id) {
  try {
    const goals = await getGoals();
    const filteredGoals = goals.filter(g => g.id !== id);

    // Also delete associated tasks
    const tasks = await getTasks();
    const filteredTasks = tasks.filter(t => t.goalId !== id);
    await set(STORAGE_KEYS.tasks, filteredTasks);

    return await set(STORAGE_KEYS.goals, filteredGoals);
  } catch (error) {
    console.error('[Storage] Error deleting goal:', error);
    return false;
  }
}

// ============================================
// TASKS FUNCTIONS
// ============================================

/**
 * Saves a single task
 *
 * @param {import('../models/data-models.js').Task} task - Task object
 * @returns {Promise<boolean>} Success status
 */
export async function saveTask(task) {
  try {
    const tasks = await getTasks();
    const existingIndex = tasks.findIndex(t => t.id === task.id);

    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }

    return await set(STORAGE_KEYS.tasks, tasks);
  } catch (error) {
    console.error('[Storage] Error saving task:', error);
    return false;
  }
}

/**
 * Gets all tasks across all goals
 *
 * @returns {Promise<import('../models/data-models.js').Task[]>}
 */
export async function getTasks() {
  return await get(STORAGE_KEYS.tasks, []);
}

/**
 * Gets tasks for a specific goal
 *
 * @param {string} goalId - Goal ID to filter by
 * @returns {Promise<import('../models/data-models.js').Task[]>}
 */
export async function getTasksByGoal(goalId) {
  const tasks = await getTasks();
  return tasks.filter(t => t.goalId === goalId);
}

/**
 * Updates specific fields of a task
 *
 * @param {string} id - Task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>} Success status
 */
export async function updateTask(id, updates) {
  try {
    const tasks = await getTasks();
    const index = tasks.findIndex(t => t.id === id);

    if (index < 0) {
      console.warn(`[Storage] Task ${id} not found for update`);
      return false;
    }

    tasks[index] = { ...tasks[index], ...updates };
    return await set(STORAGE_KEYS.tasks, tasks);
  } catch (error) {
    console.error('[Storage] Error updating task:', error);
    return false;
  }
}

/**
 * Deletes a task
 *
 * @param {string} id - Task ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteTask(id) {
  try {
    const tasks = await getTasks();
    const filteredTasks = tasks.filter(t => t.id !== id);
    return await set(STORAGE_KEYS.tasks, filteredTasks);
  } catch (error) {
    console.error('[Storage] Error deleting task:', error);
    return false;
  }
}

// ============================================
// SESSIONS FUNCTIONS
// ============================================

/**
 * Saves a completed session
 *
 * @param {import('../models/data-models.js').Session} session - Session object
 * @returns {Promise<boolean>} Success status
 */
export async function saveSession(session) {
  try {
    const sessions = await getSessions();
    sessions.push(session);
    return await set(STORAGE_KEYS.sessions, sessions);
  } catch (error) {
    console.error('[Storage] Error saving session:', error);
    return false;
  }
}

/**
 * Gets all completed sessions
 *
 * @returns {Promise<import('../models/data-models.js').Session[]>}
 */
export async function getSessions() {
  return await get(STORAGE_KEYS.sessions, []);
}

/**
 * Gets sessions for a specific goal
 *
 * @param {string} goalId - Goal ID to filter by
 * @returns {Promise<import('../models/data-models.js').Session[]>}
 */
export async function getSessionsByGoal(goalId) {
  const sessions = await getSessions();
  return sessions.filter(s => s.goalId === goalId);
}

/**
 * Gets sessions within a date range
 * Useful for calculating weekly progress
 *
 * @param {string} startDate - ISO date string (start of range, inclusive)
 * @param {string} endDate - ISO date string (end of range, inclusive)
 * @returns {Promise<import('../models/data-models.js').Session[]>}
 */
export async function getSessionsByDateRange(startDate, endDate) {
  const sessions = await getSessions();
  const start = new Date(startDate);
  const end = new Date(endDate);

  return sessions.filter(s => {
    const sessionDate = new Date(s.startTime);
    return sessionDate >= start && sessionDate <= end;
  });
}

// ============================================
// ACTIVE SESSION FUNCTIONS
// ============================================

/**
 * Saves the currently active session (timer running)
 *
 * @param {import('../models/data-models.js').ActiveSession} activeSession
 * @returns {Promise<boolean>} Success status
 */
export async function saveActiveSession(activeSession) {
  return await set(STORAGE_KEYS.activeSession, activeSession);
}

/**
 * Gets the active session (if any)
 *
 * @returns {Promise<import('../models/data-models.js').ActiveSession|null>}
 */
export async function getActiveSession() {
  return await get(STORAGE_KEYS.activeSession, null);
}

/**
 * Clears the active session (when stopping timer)
 *
 * @returns {Promise<boolean>} Success status
 */
export async function clearActiveSession() {
  return await remove(STORAGE_KEYS.activeSession);
}

// ============================================
// GAMIFICATION FUNCTIONS
// ============================================

/**
 * Updates the user's points
 * Pass positive number to add, negative to subtract (for purchases)
 *
 * @param {number} amount - Points to add (can be negative)
 * @returns {Promise<import('../models/data-models.js').Gamification>} Updated gamification object
 */
export async function updatePoints(amount) {
  try {
    let gamification = await getGamification();

    // If no gamification data exists, create it
    if (!gamification) {
      gamification = createGamification();
    }

    // Update points
    gamification.totalPoints += amount;

    // Lifetime points only increase, never decrease
    if (amount > 0) {
      gamification.lifetimePoints += amount;
      gamification.pointsThisWeek += amount;
    }

    // Ensure total doesn't go negative (shouldn't happen with proper validation)
    gamification.totalPoints = Math.max(0, gamification.totalPoints);

    await set(STORAGE_KEYS.gamification, gamification);
    return gamification;
  } catch (error) {
    console.error('[Storage] Error updating points:', error);
    return null;
  }
}

/**
 * Gets the gamification data
 *
 * @returns {Promise<import('../models/data-models.js').Gamification>}
 */
export async function getGamification() {
  const gamification = await get(STORAGE_KEYS.gamification, null);
  // Return default if none exists
  return gamification || createGamification();
}

/**
 * Updates the study streak
 * Should be called after completing a session
 *
 * @returns {Promise<import('../models/data-models.js').Gamification>} Updated gamification
 */
export async function updateStreak() {
  try {
    let gamification = await getGamification();
    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD

    if (gamification.lastStudyDate === today) {
      // Already studied today, no change to streak
      return gamification;
    }

    // Check if yesterday was the last study date (streak continues)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (gamification.lastStudyDate === yesterdayStr) {
      // Continuing streak!
      gamification.currentStreak += 1;
    } else if (gamification.lastStudyDate === null) {
      // First ever session
      gamification.currentStreak = 1;
    } else {
      // Streak broken, start fresh
      gamification.currentStreak = 1;
    }

    // Update longest streak if current is higher
    gamification.longestStreak = Math.max(
      gamification.longestStreak,
      gamification.currentStreak
    );

    // Update last study date
    gamification.lastStudyDate = today;

    await set(STORAGE_KEYS.gamification, gamification);
    return gamification;
  } catch (error) {
    console.error('[Storage] Error updating streak:', error);
    return null;
  }
}

/**
 * Resets weekly points (should be called at week start)
 *
 * @returns {Promise<boolean>} Success status
 */
export async function resetWeeklyPoints() {
  try {
    const gamification = await getGamification();
    gamification.pointsThisWeek = 0;
    return await set(STORAGE_KEYS.gamification, gamification);
  } catch (error) {
    console.error('[Storage] Error resetting weekly points:', error);
    return false;
  }
}

// ============================================
// WEEKLY PROGRESS FUNCTIONS
// ============================================

/**
 * Saves weekly progress cache
 *
 * @param {import('../models/data-models.js').WeeklyProgress} progress
 * @returns {Promise<boolean>} Success status
 */
export async function saveWeeklyProgress(progress) {
  return await set(STORAGE_KEYS.weeklyProgress, progress);
}

/**
 * Gets weekly progress
 * Returns null if no cache exists or if it's for a different week
 *
 * @returns {Promise<import('../models/data-models.js').WeeklyProgress|null>}
 */
export async function getWeeklyProgress() {
  const progress = await get(STORAGE_KEYS.weeklyProgress, null);

  if (!progress) {
    return null;
  }

  // Check if cached progress is for current week
  const { start } = getCurrentWeekRange();
  if (progress.weekStart !== start) {
    // Cache is stale, return null
    return null;
  }

  return progress;
}

// ============================================
// SETTINGS FUNCTIONS
// ============================================

/**
 * Saves settings
 *
 * @param {import('../models/data-models.js').Settings} settings
 * @returns {Promise<boolean>} Success status
 */
export async function saveSettings(settings) {
  return await set(STORAGE_KEYS.settings, settings);
}

/**
 * Gets settings, returns defaults if none exist
 *
 * @returns {Promise<import('../models/data-models.js').Settings>}
 */
export async function getSettings() {
  const settings = await get(STORAGE_KEYS.settings, null);
  return settings || createSettings();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Clears all Mocha data from storage
 * Use with caution! This is for debugging/reset functionality
 *
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllData() {
  try {
    const keys = Object.values(STORAGE_KEYS);
    await chrome.storage.local.remove(keys);
    console.log('[Storage] All Mocha data cleared');
    return true;
  } catch (error) {
    console.error('[Storage] Error clearing all data:', error);
    return false;
  }
}

/**
 * Gets all stored data (for debugging)
 *
 * @returns {Promise<Object>} All stored data
 */
export async function getAllData() {
  try {
    const keys = Object.values(STORAGE_KEYS);
    return await chrome.storage.local.get(keys);
  } catch (error) {
    console.error('[Storage] Error getting all data:', error);
    return {};
  }
}

/**
 * Initializes storage with default values if empty
 * Called during first-time setup
 *
 * @returns {Promise<boolean>} Success status
 */
export async function initializeStorage() {
  try {
    // Only initialize what doesn't exist
    const [gamification, settings] = await Promise.all([
      get(STORAGE_KEYS.gamification, null),
      get(STORAGE_KEYS.settings, null)
    ]);

    const promises = [];

    if (!gamification) {
      promises.push(set(STORAGE_KEYS.gamification, createGamification()));
    }

    if (!settings) {
      promises.push(set(STORAGE_KEYS.settings, createSettings()));
    }

    await Promise.all(promises);
    console.log('[Storage] Storage initialized');
    return true;
  } catch (error) {
    console.error('[Storage] Error initializing storage:', error);
    return false;
  }
}
