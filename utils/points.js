/**
 * Points System for Mocha Study Tracker
 *
 * This file handles all points calculations for the gamification system.
 * Points are earned through studying and can be spent in the shop.
 *
 * The philosophy: Reward consistent effort, not just time.
 * - Base points for studying (encourages ANY studying)
 * - Bonus for completing tasks (encourages finishing work)
 * - Bonus for meeting weekly goals (encourages planning)
 * - Bonus for streaks (encourages daily habits)
 */

import { TIME } from './constants.js';

// ============================================
// POINT VALUES - Easy to tweak
// ============================================

/**
 * Base points earned per hour of studying
 * 5 coins/hour means 1 hour = 5 coins
 */
export const POINTS_PER_HOUR = 5;

/**
 * Bonus points for completing a task during a session
 */
export const TASK_COMPLETE_BONUS = 5;

/**
 * Bonus points based on task difficulty
 * Harder tasks = more reward
 */
export const DIFFICULTY_BONUS = {
  easy: 5,
  medium: 10,
  hard: 15
};

/**
 * Bonus for achieving a weekly goal
 * Given once per goal when the week's target is reached
 */
export const WEEKLY_GOAL_BONUS = 50;

/**
 * Bonus for achieving ALL weekly goals (perfect week)
 * A big reward for hitting every target
 */
export const PERFECT_WEEK_BONUS = 100;

/**
 * Milestone streak bonuses
 * Given once when reaching these streak lengths
 */
export const STREAK_MILESTONES = {
  7: 50,    // One week streak
  14: 100,  // Two week streak
  30: 200,  // One month streak
  60: 300,  // Two month streak
  90: 500,  // Three month streak
  365: 1000 // One year streak!
};

/**
 * Daily streak bonus (small bonus each day to encourage daily use)
 */
export const DAILY_STREAK_BONUS = 2;

// ============================================
// CALCULATION FUNCTIONS
// ============================================

/**
 * Calculates points earned from a single study session
 *
 * Formula:
 * - Base: (duration in hours) × POINTS_PER_HOUR
 * - Task bonus: TASK_COMPLETE_BONUS if task was completed
 * - Difficulty bonus: Based on task difficulty (if task completed)
 *
 * @param {number} durationSeconds - Session duration in seconds
 * @param {boolean} taskCompleted - Whether a task was completed
 * @param {'easy'|'medium'|'hard'|null} taskDifficulty - Task difficulty (if applicable)
 * @returns {number} Total points earned (rounded to nearest integer)
 *
 * @example
 * // 1 hour session, no task
 * calculateSessionPoints(3600, false, null) // Returns: 10
 *
 * // 2 hour session, completed hard task
 * calculateSessionPoints(7200, true, 'hard') // Returns: 20 + 5 + 15 = 40
 */
export function calculateSessionPoints(durationSeconds, taskCompleted = false, taskDifficulty = null) {
  // Base points from time
  const hours = durationSeconds / TIME.secondsPerHour;
  let points = hours * POINTS_PER_HOUR;

  // Task completion bonus
  if (taskCompleted) {
    points += TASK_COMPLETE_BONUS;

    // Difficulty bonus
    if (taskDifficulty && DIFFICULTY_BONUS[taskDifficulty]) {
      points += DIFFICULTY_BONUS[taskDifficulty];
    }
  }

  // Round to nearest integer (no fractional points)
  return Math.round(points);
}

/**
 * Calculates bonus points for achieving weekly goals
 *
 * @param {import('../models/data-models.js').WeeklyProgress} weeklyProgress - Current week's progress
 * @param {import('../models/data-models.js').Goal[]} goals - Active goals
 * @returns {{goalBonuses: Object.<string, number>, perfectWeekBonus: number, total: number}}
 *
 * @example
 * // If CS61B goal (10 hrs) is met and Leetcode goal (3 tasks) is met:
 * // Returns { goalBonuses: { goal1: 50, goal2: 50 }, perfectWeekBonus: 100, total: 200 }
 */
export function calculateWeeklyBonus(weeklyProgress, goals) {
  const result = {
    goalBonuses: {},
    perfectWeekBonus: 0,
    total: 0
  };

  if (!weeklyProgress || !goals || goals.length === 0) {
    return result;
  }

  let allGoalsMet = true;
  let anyGoalsMet = false;

  goals.forEach(goal => {
    if (goal.archived) return;

    const progress = weeklyProgress.goals[goal.id];
    if (!progress) return;

    let goalMet = true;

    // Check hour goal
    if (goal.trackHours && goal.weeklyHourGoal) {
      if (progress.hoursCompleted < goal.weeklyHourGoal) {
        goalMet = false;
      }
    }

    // Check task goal
    if (goal.trackTasks && goal.weeklyTaskGoal) {
      if (progress.tasksCompleted < goal.weeklyTaskGoal) {
        goalMet = false;
      }
    }

    if (goalMet) {
      result.goalBonuses[goal.id] = WEEKLY_GOAL_BONUS;
      result.total += WEEKLY_GOAL_BONUS;
      anyGoalsMet = true;
    } else {
      allGoalsMet = false;
    }
  });

  // Perfect week bonus if all goals met
  if (allGoalsMet && anyGoalsMet) {
    result.perfectWeekBonus = PERFECT_WEEK_BONUS;
    result.total += PERFECT_WEEK_BONUS;
  }

  return result;
}

/**
 * Calculates streak bonus for reaching milestone
 * Only returns bonus if the streak is EXACTLY at a milestone (not above)
 * This prevents giving the bonus multiple times
 *
 * @param {number} currentStreak - Current streak in days
 * @returns {number} Milestone bonus (0 if not at milestone)
 *
 * @example
 * calculateStreakMilestoneBonus(7)  // Returns: 50 (hit 1 week!)
 * calculateStreakMilestoneBonus(8)  // Returns: 0 (already past milestone)
 */
export function calculateStreakMilestoneBonus(currentStreak) {
  return STREAK_MILESTONES[currentStreak] || 0;
}

/**
 * Calculates the daily streak bonus
 * Given each day the streak continues
 *
 * @param {number} currentStreak - Current streak length
 * @returns {number} Daily bonus points
 */
export function calculateDailyStreakBonus(currentStreak) {
  if (currentStreak <= 0) return 0;

  // Scale bonus slightly with streak length (caps at 10x)
  const multiplier = Math.min(Math.floor(currentStreak / 7) + 1, 10);
  return DAILY_STREAK_BONUS * multiplier;
}

/**
 * Gets the total points that would be earned from a session
 * Combines all bonuses into one result
 *
 * @param {Object} params - Session parameters
 * @param {number} params.durationSeconds - Session duration
 * @param {boolean} params.taskCompleted - Task completed?
 * @param {string|null} params.taskDifficulty - Task difficulty
 * @param {number} params.currentStreak - Current streak (before this session)
 * @param {boolean} params.isFirstSessionToday - First session of the day?
 * @returns {{base: number, taskBonus: number, difficultyBonus: number, streakBonus: number, total: number}}
 */
export function calculateTotalSessionPoints(params) {
  const {
    durationSeconds,
    taskCompleted = false,
    taskDifficulty = null,
    currentStreak = 0,
    isFirstSessionToday = false
  } = params;

  const result = {
    base: 0,
    taskBonus: 0,
    difficultyBonus: 0,
    streakBonus: 0,
    total: 0
  };

  // Base points from time
  const hours = durationSeconds / TIME.secondsPerHour;
  result.base = Math.round(hours * POINTS_PER_HOUR);

  // Task bonuses
  if (taskCompleted) {
    result.taskBonus = TASK_COMPLETE_BONUS;
    if (taskDifficulty && DIFFICULTY_BONUS[taskDifficulty]) {
      result.difficultyBonus = DIFFICULTY_BONUS[taskDifficulty];
    }
  }

  // Streak bonus (only for first session of the day)
  if (isFirstSessionToday) {
    // New streak day! Calculate the streak as if it's extended
    const newStreak = currentStreak + 1;
    result.streakBonus = calculateDailyStreakBonus(newStreak);

    // Add milestone bonus if applicable
    const milestoneBonus = calculateStreakMilestoneBonus(newStreak);
    result.streakBonus += milestoneBonus;
  }

  result.total = result.base + result.taskBonus + result.difficultyBonus + result.streakBonus;

  return result;
}

/**
 * Estimates points for an ongoing session
 * Useful for showing "You'll earn ~X points" in the UI
 *
 * @param {number} durationSeconds - Current elapsed time
 * @param {boolean} hasTask - Is there a task selected?
 * @param {string|null} taskDifficulty - Task difficulty if known
 * @returns {number} Estimated total points
 */
export function estimateSessionPoints(durationSeconds, hasTask = false, taskDifficulty = null) {
  let points = (durationSeconds / TIME.secondsPerHour) * POINTS_PER_HOUR;

  if (hasTask) {
    // Assume task will be completed for estimate
    points += TASK_COMPLETE_BONUS;
    if (taskDifficulty) {
      points += DIFFICULTY_BONUS[taskDifficulty] || DIFFICULTY_BONUS.medium;
    }
  }

  return Math.round(points);
}

/**
 * Gets the next streak milestone
 * Useful for showing "X days until next bonus!"
 *
 * @param {number} currentStreak - Current streak
 * @returns {{days: number, bonus: number}|null} Next milestone or null if none
 */
export function getNextStreakMilestone(currentStreak) {
  const milestones = Object.keys(STREAK_MILESTONES)
    .map(Number)
    .sort((a, b) => a - b);

  const nextMilestone = milestones.find(m => m > currentStreak);

  if (nextMilestone) {
    return {
      days: nextMilestone,
      daysRemaining: nextMilestone - currentStreak,
      bonus: STREAK_MILESTONES[nextMilestone]
    };
  }

  return null;
}

/**
 * Calculates how many points are needed for a shop item
 *
 * @param {number} price - Item price
 * @param {number} currentPoints - User's current points
 * @returns {{canAfford: boolean, needed: number, hoursNeeded: number}}
 */
export function calculatePointsNeeded(price, currentPoints) {
  const needed = Math.max(0, price - currentPoints);
  const hoursNeeded = needed / POINTS_PER_HOUR;

  return {
    canAfford: currentPoints >= price,
    needed: needed,
    hoursNeeded: Math.ceil(hoursNeeded * 10) / 10 // Round up to 1 decimal
  };
}
