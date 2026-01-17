/**
 * Progress Page JavaScript
 *
 * This page shows detailed weekly progress:
 * - Stats overview (hours, tasks, streak, points)
 * - Per-goal progress with progress bars
 * - Session history
 * - Daily breakdown
 * - Manual entry form
 * - Data export
 */

import {
  getGoals,
  getSessions,
  getTasks,
  getGamification,
  getSessionsByDateRange,
  saveSession,
  saveGoal,
  deleteGoal,
  saveTask,
  deleteTask
} from '../utils/storage.js';

import {
  getCurrentWeekRange,
  calculateWeeklyProgress,
  calculateStreak,
  formatDuration,
  formatDate,
  calculatePercentage,
  isToday
} from '../utils/calculations.js';

import { createSession } from '../models/data-models.js';
import { calculateSessionPoints, POINTS_PER_HOUR } from '../utils/points.js';
import { TIME } from '../utils/constants.js';

// ============================================
// STATE
// ============================================

let goals = [];
let sessions = [];
let tasks = [];
let gamification = null;
let weeklyProgress = null;
let currentWeekOffset = 0; // 0 = current week, -1 = last week, etc.
let editingGoalId = null; // Track which goal is being edited
let currentTaskGoalId = null; // Track which goal we're adding a task to
let confirmResolve = null; // Promise resolver for confirmation modal

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  console.log('[Progress] Initializing...');

  try {
    // Load all data
    [goals, sessions, tasks, gamification] = await Promise.all([
      getGoals(),
      getSessions(),
      getTasks(),
      getGamification()
    ]);

    // Filter to active goals only
    goals = goals.filter(g => !g.archived);

    // Set up event listeners
    setupEventListeners();

    // Set default date for manual entry
    document.getElementById('manual-date').valueAsDate = new Date();

    // Render the page
    await renderPage();

    console.log('[Progress] Initialization complete');
  } catch (error) {
    console.error('[Progress] Error initializing:', error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  console.log('[Progress] Setting up event listeners...');
  
  // Back to popup button
  const backBtn = document.getElementById('back-to-popup');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      chrome.action.openPopup();
      window.close();
    });
  }
  
  // Goal modal controls
  setupGoalModal();
  
  // Task modal controls
  setupTaskModal();
  
  // Confirmation modal controls
  setupConfirmModal();
  
  // Add new goal button
  const addNewGoalBtn = document.getElementById('add-new-goal-btn');
  if (addNewGoalBtn) {
    console.log('[Progress] Found add-new-goal-btn');
    addNewGoalBtn.addEventListener('click', () => {
      console.log('[Progress] Add new goal button clicked!');
      showAddGoalModal();
    });
  } else {
    console.log('[Progress] add-new-goal-btn NOT FOUND');
  }

  const addGoalBtn = document.getElementById('add-goal-btn');
  if (addGoalBtn) {
    console.log('[Progress] Found add-goal-btn');
    addGoalBtn.addEventListener('click', () => {
      console.log('[Progress] Add goal button clicked!');
      showAddGoalModal();
    });
  } else {
    console.log('[Progress] add-goal-btn NOT FOUND');
  }

  // Week navigation
  document.getElementById('prev-week').addEventListener('click', () => {
    currentWeekOffset--;
    renderPage();
  });

  document.getElementById('next-week').addEventListener('click', () => {
    if (currentWeekOffset < 0) {
      currentWeekOffset++;
      renderPage();
    }
  });

  // Manual entry toggle
  document.getElementById('toggle-manual-form').addEventListener('click', () => {
    const form = document.getElementById('manual-entry-form');
    const icon = document.getElementById('toggle-icon');
    form.classList.toggle('hidden');
    icon.textContent = form.classList.contains('hidden') ? '+' : '−';
  });

  // Save manual entry
  document.getElementById('save-manual-entry').addEventListener('click', handleSaveManualEntry);

  // Export button (if exists)
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }
}

// ============================================
// RENDERING
// ============================================

async function renderPage() {
  // Render goals management section
  renderGoalsManagement();

  // Calculate week range
  const { start, end } = getWeekRange();

  console.log('[Progress] Week range:', start, 'to', end);

  // Update week label
  updateWeekLabel(start, end);

  // Get sessions for this week
  const weekSessions = await getSessionsByDateRange(start, end);

  // Calculate weekly progress (inline to avoid cache issues)
  weeklyProgress = {
    weekStart: start,
    weekEnd: end,
    goals: {},
    totalHours: 0,
    totalTasks: 0
  };
  
  // Initialize each goal
  goals.forEach(goal => {
    weeklyProgress.goals[goal.id] = {
      hoursCompleted: 0,
      tasksCompleted: 0
    };
  });
  
  // Calculate hours from sessions
  weekSessions.forEach(session => {
    if (weeklyProgress.goals[session.goalId]) {
      const hours = session.duration / 3600;
      weeklyProgress.goals[session.goalId].hoursCompleted += hours;
      weeklyProgress.totalHours += hours;
    }
  });
  
  // Calculate completed tasks
  tasks.forEach(task => {
    if (task.completed && task.completedAt) {
      const completedDate = new Date(task.completedAt).toISOString().split('T')[0];
      if (completedDate >= start && completedDate <= end) {
        if (weeklyProgress.goals[task.goalId]) {
          weeklyProgress.goals[task.goalId].tasksCompleted += 1;
          weeklyProgress.totalTasks += 1;
        }
      }
    }
  });
  
  // Round hours to 2 decimal places
  weeklyProgress.totalHours = Math.round(weeklyProgress.totalHours * 100) / 100;
  Object.keys(weeklyProgress.goals).forEach(goalId => {
    weeklyProgress.goals[goalId].hoursCompleted = 
      Math.round(weeklyProgress.goals[goalId].hoursCompleted * 100) / 100;
  });

  // Render all sections
  renderStats(weekSessions);
  renderGoalsProgress();
  renderSessionsList(weekSessions);
  renderDailyBreakdown(weekSessions, start);
  populateGoalSelect();

  // Update navigation buttons
  document.getElementById('next-week').disabled = currentWeekOffset >= 0;
}

function getWeekRange() {
  const now = new Date();
  now.setDate(now.getDate() + (currentWeekOffset * 7));
  return getWeekRangeForDate(now);
}

function getWeekRangeForDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Adjust for Monday start

  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
}

function updateWeekLabel(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Format: "Jan 13 - Jan 19" or "This Week (Jan 13 - Jan 19)"
  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateRange = `${startStr} - ${endStr}`;

  let label;
  if (currentWeekOffset === 0) {
    label = `This Week (${dateRange})`;
  } else if (currentWeekOffset === -1) {
    label = `Last Week (${dateRange})`;
  } else {
    label = dateRange;
  }

  document.getElementById('week-label').textContent = label;
}

function renderStats(weekSessions) {
  // Total hours
  const totalHours = weeklyProgress.totalHours;
  document.getElementById('total-hours').textContent = `${totalHours.toFixed(1)}h`;

  // Hours goal progress
  const totalHoursGoal = goals.reduce((sum, g) => sum + (g.weeklyHourGoal || 0), 0);
  document.getElementById('hours-goal-progress').textContent =
    totalHoursGoal > 0 ? `${totalHours.toFixed(1)} of ${totalHoursGoal}h goal` : 'No hours goal set';

  // Total tasks
  document.getElementById('total-tasks').textContent = weeklyProgress.totalTasks;

  // Tasks goal progress
  const totalTasksGoal = goals.reduce((sum, g) => sum + (g.weeklyTaskGoal || 0), 0);
  document.getElementById('tasks-goal-progress').textContent =
    totalTasksGoal > 0 ? `${weeklyProgress.totalTasks} of ${totalTasksGoal} tasks goal` : 'No tasks goal set';

  // Streak
  const { current: currentStreak } = calculateStreak(sessions);
  document.getElementById('current-streak').textContent = currentStreak;

  const streakStatus = currentStreak > 0
    ? `Best: ${gamification?.longestStreak || currentStreak} days`
    : 'Start studying today!';
  document.getElementById('streak-status').textContent = streakStatus;

  // Points this week
  const weekPoints = weekSessions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);
  document.getElementById('points-earned').textContent = weekPoints;
  document.getElementById('total-points').textContent =
    `${gamification?.totalPoints || 0} total points`;
}

function renderGoalsProgress() {
  const container = document.getElementById('goals-progress-list');
  const emptyState = document.getElementById('no-goals-state');

  if (goals.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  // Clear existing content (except empty state)
  container.querySelectorAll('.goal-progress-card').forEach(el => el.remove());

  goals.forEach(goal => {
    const progress = weeklyProgress?.goals?.[goal.id] || { hoursCompleted: 0, tasksCompleted: 0 };

    const hoursPercent = calculatePercentage(progress.hoursCompleted, goal.weeklyHourGoal);
    const tasksPercent = calculatePercentage(progress.tasksCompleted, goal.weeklyTaskGoal);

    // Determine status
    let status = 'on-track';
    let statusText = 'On Track';

    if (hoursPercent >= 100 && (!goal.trackTasks || tasksPercent >= 100)) {
      status = 'complete';
      statusText = 'Complete!';
    }
    // Remove "Behind" status - don't show negative feedback

    const card = document.createElement('div');
    card.className = 'goal-progress-card';
    card.style.borderLeftColor = goal.color;

    let barsHtml = '';

    if (goal.trackHours && goal.weeklyHourGoal) {
      barsHtml += `
        <div class="goal-progress-row">
          <span class="goal-progress-label">Hours</span>
          <div class="goal-progress-bar-container">
            <div class="goal-progress-bar" style="width: ${hoursPercent}%; background: linear-gradient(90deg, ${goal.color} 0%, ${goal.color}99 100%);"></div>
          </div>
          <span class="goal-progress-value">${progress.hoursCompleted.toFixed(1)} / ${goal.weeklyHourGoal}h</span>
        </div>
      `;
    }

    if (goal.trackTasks && goal.weeklyTaskGoal) {
      barsHtml += `
        <div class="goal-progress-row">
          <span class="goal-progress-label">Tasks</span>
          <div class="goal-progress-bar-container">
            <div class="goal-progress-bar" style="width: ${tasksPercent}%; background: linear-gradient(90deg, ${goal.color} 0%, ${goal.color}99 100%);"></div>
          </div>
          <span class="goal-progress-value">${progress.tasksCompleted} / ${goal.weeklyTaskGoal} ${goal.taskUnit}</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="goal-progress-icon">${goal.icon}</div>
      <div class="goal-progress-content">
        <div class="goal-progress-header">
          <span class="goal-progress-name">${goal.name}</span>
          <span class="goal-progress-status ${status}">${statusText}</span>
        </div>
        <div class="goal-progress-bars">
          ${barsHtml || '<span class="text-muted">No tracking configured</span>'}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderSessionsList(weekSessions) {
  const container = document.getElementById('sessions-list');
  const emptyState = document.getElementById('no-sessions-state');

  // Clear existing items
  container.querySelectorAll('.session-item').forEach(el => el.remove());

  if (weekSessions.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  // Sort by date (newest first) and take last 10
  const recentSessions = [...weekSessions]
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(0, 10);

  recentSessions.forEach(session => {
    const goal = goals.find(g => g.id === session.goalId);
    const hasNotes = session.notes && session.notes.trim().length > 0;
    
    const item = document.createElement('li');
    item.className = 'session-item';
    if (hasNotes) {
      item.classList.add('has-notes');
    }

    item.innerHTML = `
      <div class="session-icon">${goal?.icon || '📚'}</div>
      <div class="session-details">
        <div class="session-goal-name">${goal?.name || 'Unknown Goal'}</div>
        <div class="session-meta">
          <span>${formatDate(session.startTime, 'relative')}</span>
          <span>•</span>
          <span>${session.mode === 'pomodoro' ? '🍅 Pomodoro' : '🕐 Free'}</span>
          ${hasNotes ? '<span>•</span><span class="notes-indicator">📝 Has notes</span>' : ''}
        </div>
        ${hasNotes ? `<div class="session-notes hidden" id="notes-${session.id}">
          <div class="notes-label">Notes:</div>
          <div class="notes-text">${session.notes}</div>
        </div>` : ''}
      </div>
      <div class="session-right">
        <div class="session-duration">${formatDuration(session.duration)}</div>
        <div class="session-points">+${session.pointsEarned} pts</div>
        ${hasNotes ? `<button class="btn-icon-small view-notes-btn" data-session-id="${session.id}" title="View notes">
          📝
        </button>` : ''}
      </div>
    `;

    container.appendChild(item);
    
    // Add click handler for notes button
    if (hasNotes) {
      const notesBtn = item.querySelector('.view-notes-btn');
      const notesDiv = item.querySelector(`#notes-${session.id}`);
      
      notesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notesDiv.classList.toggle('hidden');
        notesBtn.textContent = notesDiv.classList.contains('hidden') ? '📝' : '📖';
        notesBtn.title = notesDiv.classList.contains('hidden') ? 'View notes' : 'Hide notes';
      });
    }
  });
}

function renderDailyBreakdown(weekSessions, weekStart) {
  const container = document.getElementById('daily-breakdown');
  container.innerHTML = '';

  const startDate = new Date(weekStart);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Find max hours for scaling
  let maxHours = 0;
  const dailyHours = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const dayHours = weekSessions
      .filter(s => new Date(s.startTime).toISOString().split('T')[0] === dateStr)
      .reduce((sum, s) => sum + s.duration / TIME.secondsPerHour, 0);

    dailyHours.push({ date, dateStr, hours: dayHours });
    maxHours = Math.max(maxHours, dayHours);
  }

  // Default max to 4 hours if no data
  if (maxHours === 0) maxHours = 4;

  dailyHours.forEach((day, i) => {
    const percent = (day.hours / maxHours) * 100;
    const isTodayClass = isToday(day.date) ? 'today' : '';

    const row = document.createElement('div');
    row.className = `day-row ${isTodayClass}`;

    row.innerHTML = `
      <span class="day-name">${days[i]}</span>
      <div class="day-bar-container">
        <div class="day-bar" style="width: ${percent}%;">
          ${day.hours >= 0.5 ? `<span class="day-bar-label">${day.hours.toFixed(1)}h</span>` : ''}
        </div>
      </div>
      <span class="day-hours">${day.hours.toFixed(1)}h</span>
    `;

    container.appendChild(row);
  });
}

function populateGoalSelect() {
  const select = document.getElementById('manual-goal');
  select.innerHTML = '';

  if (goals.length === 0) {
    select.innerHTML = '<option value="">No goals available</option>';
    return;
  }

  goals.forEach(goal => {
    const option = document.createElement('option');
    option.value = goal.id;
    option.textContent = `${goal.icon} ${goal.name}`;
    select.appendChild(option);
  });
}

// ============================================
// MANUAL ENTRY
// ============================================

async function handleSaveManualEntry() {
  const goalId = document.getElementById('manual-goal').value;
  const hours = parseInt(document.getElementById('manual-hours').value) || 0;
  const minutes = parseInt(document.getElementById('manual-minutes').value) || 0;
  const seconds = parseInt(document.getElementById('manual-seconds').value) || 0;
  const date = document.getElementById('manual-date').value;
  const notes = document.getElementById('manual-notes').value;

  if (!goalId) {
    alert('Please select a goal');
    return;
  }

  const durationSeconds = (hours * 3600) + (minutes * 60) + seconds;
  
  console.log('[Progress] Manual entry - Goal ID:', goalId);
  console.log('[Progress] Manual entry - Duration:', hours, 'h', minutes, 'm', seconds, 's');
  console.log('[Progress] Total duration in seconds:', durationSeconds);
  
  if (durationSeconds <= 0) {
    alert('Please enter a valid duration');
    return;
  }

  if (!date) {
    alert('Please select a date');
    return;
  }

  // Create manual session
  const sessionDate = new Date(date);
  sessionDate.setHours(12, 0, 0, 0); // Set to noon

  const points = calculateSessionPoints(durationSeconds, false, null);

  const session = createSession({
    goalId: goalId,
    startTime: sessionDate.toISOString(),
    endTime: new Date(sessionDate.getTime() + durationSeconds * 1000).toISOString(),
    duration: durationSeconds,
    mode: 'free',
    pointsEarned: points,
    isManual: true,
    notes: notes
  });

  console.log('[Progress] Saving manual session:', session);

  try {
    await saveSession(session);
    console.log('[Progress] Manual session saved successfully');

    // Reload ALL data to ensure fresh calculations
    sessions = await getSessions();
    tasks = await getTasks();
    goals = await getGoals();
    goals = goals.filter(g => !g.archived);
    
    console.log('[Progress] Reloaded sessions count:', sessions.length);
    console.log('[Progress] Reloaded goals count:', goals.length);
    
    // Re-render the entire page
    await renderPage();

    // Reset form
    document.getElementById('manual-hours').value = 0;
    document.getElementById('manual-minutes').value = 30;
    document.getElementById('manual-seconds').value = 0;
    document.getElementById('manual-notes').value = '';

    alert('Entry saved successfully!');
  } catch (error) {
    console.error('[Progress] Error saving manual entry:', error);
    alert('Error saving entry. Please try again.');
  }
}

// ============================================
// EXPORT
// ============================================

function handleExport() {
  const { start, end } = getWeekRange();

  // Build CSV content
  let csv = 'Date,Goal,Duration (minutes),Points,Mode,Notes\n';

  sessions
    .filter(s => {
      const date = new Date(s.startTime).toISOString().split('T')[0];
      return date >= start && date <= end;
    })
    .forEach(session => {
      const goal = goals.find(g => g.id === session.goalId);
      const date = new Date(session.startTime).toISOString().split('T')[0];
      const duration = Math.round(session.duration / 60);
      const notes = (session.notes || '').replace(/"/g, '""');

      csv += `${date},"${goal?.name || 'Unknown'}",${duration},${session.pointsEarned},${session.mode},"${notes}"\n`;
    });

  // Download file
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mocha-progress-${start}-${end}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// ============================================
// GOALS MANAGEMENT
// ============================================

function renderGoalsManagement() {
  const container = document.getElementById('goals-management-list');
  if (!container) return;

  container.innerHTML = '';

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <div class="empty-state-title">No goals yet</div>
        <div class="empty-state-text">Click the button below to create your first goal!</div>
      </div>
    `;
    return;
  }

  goals.forEach(goal => {
    const goalTasks = tasks.filter(t => t.goalId === goal.id && !t.completed);
    
    const goalItem = document.createElement('div');
    goalItem.className = 'goal-item';
    goalItem.dataset.goalId = goal.id;

    goalItem.innerHTML = `
      <div class="goal-item-header" data-goal-id="${goal.id}">
        <div class="goal-item-title">
          <span class="goal-item-icon">${goal.icon}</span>
          <span class="goal-item-name">${goal.name}</span>
        </div>
        <div class="goal-item-actions">
          <button class="btn btn-secondary btn-small edit-goal-btn" data-goal-id="${goal.id}">
            Edit
          </button>
          <button class="btn btn-danger btn-small delete-goal-btn" data-goal-id="${goal.id}">
            Delete
          </button>
        </div>
      </div>
      <div class="goal-item-details hidden" id="goal-details-${goal.id}">
        <div class="goal-detail-row">
          <span class="goal-detail-label">Weekly Hour Goal:</span>
          <span class="goal-detail-value">${goal.weeklyHourGoal || 0} hours</span>
        </div>
        <div class="goal-detail-row">
          <span class="goal-detail-label">Weekly Task Goal:</span>
          <span class="goal-detail-value">${goal.weeklyTaskGoal || 0} ${goal.taskUnit || 'tasks'}</span>
        </div>
        <div class="tasks-list">
          <div class="tasks-list-header">
            <span class="tasks-list-title">Active Tasks</span>
            <button class="btn btn-secondary btn-small add-task-btn" data-goal-id="${goal.id}">
              + Add Task
            </button>
          </div>
          <div class="tasks-container" id="tasks-${goal.id}">
            ${goalTasks.length === 0 ? '<p style="font-size: 13px; color: #999; text-align: center; padding: 16px;">No active tasks</p>' : ''}
          </div>
        </div>
      </div>
    `;

    container.appendChild(goalItem);

    // Render tasks for this goal
    if (goalTasks.length > 0) {
      const tasksContainer = goalItem.querySelector(`#tasks-${goal.id}`);
      goalTasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        taskItem.innerHTML = `
          <div class="task-item-content">
            <div class="task-item-name">${task.name}</div>
            <div class="task-item-meta">Difficulty: ${task.difficulty || 'medium'}</div>
          </div>
          <div class="task-item-actions">
            <button class="btn btn-secondary btn-small delete-task-btn" data-task-id="${task.id}">
              Delete
            </button>
          </div>
        `;
        tasksContainer.appendChild(taskItem);
      });
    }
  });

  // Attach event listeners
  container.querySelectorAll('.goal-item-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.goal-item-actions')) return; // Don't toggle if clicking buttons
      const goalId = header.dataset.goalId;
      const details = document.getElementById(`goal-details-${goalId}`);
      if (details) {
        details.classList.toggle('hidden');
      }
    });
  });

  container.querySelectorAll('.edit-goal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const goalId = btn.dataset.goalId;
      showEditGoalModal(goalId);
    });
  });

  container.querySelectorAll('.delete-goal-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const goalId = btn.dataset.goalId;
      const goal = goals.find(g => g.id === goalId);
      const confirmed = await showConfirmDialog(
        `Delete "${goal.name}"?`,
        'This action cannot be undone. All tasks and progress for this goal will be lost.',
        '🗑️'
      );
      if (confirmed) {
        await handleDeleteGoal(goalId);
      }
    });
  });

  container.querySelectorAll('.add-task-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const goalId = btn.dataset.goalId;
      showAddTaskModal(goalId);
    });
  });

  container.querySelectorAll('.delete-task-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      const confirmed = await showConfirmDialog(
        'Delete Task?',
        'Are you sure you want to delete this task?',
        '🗑️'
      );
      if (confirmed) {
        await handleDeleteTask(taskId);
      }
    });
  });
}

async function handleDeleteGoal(goalId) {
  try {
    await deleteGoal(goalId);
    goals = await getGoals();
    goals = goals.filter(g => !g.archived);
    await renderPage();
    alert('Goal deleted successfully!');
  } catch (error) {
    console.error('[Progress] Error deleting goal:', error);
    alert('Error deleting goal. Please try again.');
  }
}

async function handleDeleteTask(taskId) {
  try {
    await deleteTask(taskId);
    tasks = await getTasks();
    renderGoalsManagement();
  } catch (error) {
    console.error('[Progress] Error deleting task:', error);
    alert('Error deleting task. Please try again.');
  }
}

// ============================================
// MODAL CONTROLS
// ============================================

function setupGoalModal() {
  const modal = document.getElementById('goal-modal');
  const overlay = document.getElementById('goal-modal-overlay');
  const closeBtn = document.getElementById('goal-modal-close');
  const cancelBtn = document.getElementById('goal-modal-cancel');
  const form = document.getElementById('goal-form');

  // Close modal handlers
  const closeModal = () => {
    modal.classList.remove('active');
    editingGoalId = null;
    form.reset();
  };

  overlay.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Emoji button handlers
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const emoji = btn.dataset.emoji;
      document.getElementById('goal-icon').value = emoji;
    });
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSaveGoal();
  });
}

function setupTaskModal() {
  const modal = document.getElementById('task-modal');
  const overlay = document.getElementById('task-modal-overlay');
  const closeBtn = document.getElementById('task-modal-close');
  const cancelBtn = document.getElementById('task-modal-cancel');
  const form = document.getElementById('task-form');

  // Close modal handlers
  const closeModal = () => {
    modal.classList.remove('active');
    currentTaskGoalId = null;
    form.reset();
  };

  overlay.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSaveTask();
  });
}

function setupConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  const overlay = document.getElementById('confirm-modal-overlay');
  const cancelBtn = document.getElementById('confirm-cancel');
  const okBtn = document.getElementById('confirm-ok');

  const closeModal = (result) => {
    modal.classList.remove('active');
    if (confirmResolve) {
      confirmResolve(result);
      confirmResolve = null;
    }
  };

  overlay.addEventListener('click', () => closeModal(false));
  cancelBtn.addEventListener('click', () => closeModal(false));
  okBtn.addEventListener('click', () => closeModal(true));
}

function showConfirmDialog(title, message, icon = '⚠️') {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const iconEl = modal.querySelector('.confirm-icon');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    iconEl.textContent = icon;
    
    modal.classList.add('active');
  });
}

function showAddGoalModal() {
  console.log('[Progress] ===== showAddGoalModal called! =====');
  
  const modal = document.getElementById('goal-modal');
  console.log('[Progress] Modal element:', modal);
  
  if (!modal) {
    console.error('[Progress] ERROR: Modal element not found!');
    alert('Error: Modal not found. Please refresh the page.');
    return;
  }
  
  editingGoalId = null;
  const title = document.getElementById('goal-modal-title');
  const form = document.getElementById('goal-form');
  
  console.log('[Progress] Title element:', title);
  console.log('[Progress] Form element:', form);
  
  title.textContent = 'Create New Goal';
  form.reset();
  document.getElementById('goal-color').value = '#A67C52';
  document.getElementById('goal-hours').value = 10;
  document.getElementById('goal-tasks').value = 5;
  document.getElementById('goal-task-unit').value = 'tasks';
  
  console.log('[Progress] Adding "active" class to modal');
  modal.classList.add('active');
  console.log('[Progress] Modal classes:', modal.className);
}

function showEditGoalModal(goalId) {
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;

  editingGoalId = goalId;
  const modal = document.getElementById('goal-modal');
  const title = document.getElementById('goal-modal-title');
  
  title.textContent = 'Edit Goal';
  
  // Populate form
  document.getElementById('goal-name').value = goal.name;
  document.getElementById('goal-icon').value = goal.icon;
  document.getElementById('goal-color').value = goal.color;
  document.getElementById('goal-hours').value = goal.weeklyHourGoal;
  document.getElementById('goal-tasks').value = goal.weeklyTaskGoal;
  document.getElementById('goal-task-unit').value = goal.taskUnit || 'tasks';
  
  modal.classList.add('active');
}

async function handleSaveGoal() {
  const name = document.getElementById('goal-name').value.trim();
  const icon = document.getElementById('goal-icon').value.trim();
  const color = document.getElementById('goal-color').value;
  const weeklyHours = parseFloat(document.getElementById('goal-hours').value);
  const weeklyTasks = parseInt(document.getElementById('goal-tasks').value);
  const taskUnit = document.getElementById('goal-task-unit').value.trim();

  if (!name || !icon) {
    alert('Please fill in all required fields');
    return;
  }

  const goal = editingGoalId 
    ? { ...goals.find(g => g.id === editingGoalId) }
    : {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        archived: false
      };

  goal.name = name;
  goal.icon = icon;
  goal.color = color;
  goal.weeklyHourGoal = weeklyHours;
  goal.weeklyTaskGoal = weeklyTasks;
  goal.trackHours = true;
  goal.trackTasks = true;
  goal.taskUnit = taskUnit;

  try {
    await saveGoal(goal);
    goals = await getGoals();
    goals = goals.filter(g => !g.archived);
    await renderPage();
    
    document.getElementById('goal-modal').classList.remove('active');
    alert(editingGoalId ? 'Goal updated successfully!' : 'Goal created successfully!');
    editingGoalId = null;
  } catch (error) {
    console.error('[Progress] Error saving goal:', error);
    alert('Error saving goal. Please try again.');
  }
}

function showAddTaskModal(goalId) {
  currentTaskGoalId = goalId;
  const modal = document.getElementById('task-modal');
  const form = document.getElementById('task-form');
  
  form.reset();
  document.getElementById('task-difficulty').value = 'medium';
  
  modal.classList.add('active');
}

async function handleSaveTask() {
  const name = document.getElementById('task-name').value.trim();
  const difficulty = document.getElementById('task-difficulty').value;

  if (!name || !currentTaskGoalId) {
    alert('Please fill in all required fields');
    return;
  }

  const task = {
    id: Date.now().toString(),
    goalId: currentTaskGoalId,
    name: name,
    difficulty: difficulty,
    completed: false,
    createdAt: new Date().toISOString()
  };

  try {
    await saveTask(task);
    tasks = await getTasks();
    renderGoalsManagement();
    
    document.getElementById('task-modal').classList.remove('active');
    currentTaskGoalId = null;
  } catch (error) {
    console.error('[Progress] Error creating task:', error);
    alert('Error creating task. Please try again.');
  }
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', init);
