/**
 * Mocha Study Tracker - Main Popup JavaScript
 *
 * This file handles all the logic for the main popup window.
 * It manages:
 * - Initial loading and redirection to onboarding
 * - Displaying character and goals
 * - Goal creation modal
 * - Starting and managing sessions
 *
 * The code is organized into sections:
 * 1. Imports and Global Variables
 * 2. Initialization
 * 3. Data Loading Functions
 * 4. UI Rendering Functions
 * 5. Event Handlers
 * 6. Modal Functions
 * 7. Session Functions
 * 8. Utility Functions
 */

// ============================================
// 1. IMPORTS
// ============================================

import {
  getCharacter,
  getGoals,
  saveGoal,
  updateGoal,
  deleteGoal,
  getGamification,
  getActiveSession,
  saveActiveSession,
  clearActiveSession,
  getTasks,
  getTasksByGoal,
  getWeeklyProgress,
  saveWeeklyProgress,
  getSessionsByDateRange,
  saveSession,
  updatePoints,
  updateStreak
} from '../utils/storage.js';

import {
  getCurrentWeekRange,
  calculateWeeklyProgress,
  calculatePercentage,
  formatDuration,
  formatTimer,
  calculateElapsedTime,
  formatDate
} from '../utils/calculations.js';

import {
  DEFAULT_COLORS,
  ALL_EMOJIS,
  GOAL_CATEGORIES,
  TASK_UNITS,
  BEAR_SPECIES
} from '../utils/constants.js';

import {
  createGoal,
  createActiveSession,
  createSession
} from '../models/data-models.js';

import {
  calculateSessionPoints,
  estimateSessionPoints,
  POINTS_PER_HOUR
} from '../utils/points.js';

// ============================================
// 2. GLOBAL VARIABLES
// ============================================

// State
let character = null;
let goals = [];
let tasks = [];
let weeklyProgress = null;
let gamification = null;
let activeSession = null;
let timerInterval = null;
let confirmResolve = null; // Promise resolver for confirmation modal
let notesResolve = null; // Promise resolver for notes modal
let pendingSession = null; // Store session while getting notes

// Currently editing goal (for edit modal)
let editingGoalId = null;

// Selected goal for new session
let selectedGoalId = null;

// Goal menu state
let openMenuGoalId = null;

// ============================================
// 3. INITIALIZATION
// ============================================

/**
 * Main initialization function
 * Called when popup opens
 */
async function init() {
  console.log('[Mocha] ===== INITIALIZING POPUP =====');
  console.log('[Mocha] Window loaded:', !!window);
  console.log('[Mocha] Document ready:', document.readyState);

  try {
    // Load character first - if none exists, redirect to onboarding
    character = await getCharacter();
    console.log('[Mocha] Character loaded:', character);

    if (!character || !character.name) {
      console.log('[Mocha] No character found, redirecting to onboarding');
      window.location.href = 'onboarding.html';
      return;
    }

    // Load all data in parallel for faster startup
    const [goalsData, gamificationData, activeSessionData, tasksData] = await Promise.all([
      getGoals(),
      getGamification(),
      getActiveSession(),
      getTasks()
    ]);

    goals = goalsData.filter(g => !g.archived); // Only show active goals
    gamification = gamificationData;
    activeSession = activeSessionData;
    tasks = tasksData;

    console.log('[Mocha] Loaded:', {
      goalsCount: goals.length,
      hasActiveSession: !!activeSession,
      tasksCount: tasks.length
    });

    // Calculate weekly progress
    await loadWeeklyProgress();

    // Render the UI
    console.log('[Mocha] Rendering UI...');
    try {
      renderCharacter();
      console.log('[Mocha] ✓ renderCharacter done');
    } catch (e) {
      console.error('[Mocha] ✗ renderCharacter failed:', e);
    }
    
    try {
      renderPoints();
      console.log('[Mocha] ✓ renderPoints done');
    } catch (e) {
      console.error('[Mocha] ✗ renderPoints failed:', e);
    }
    
    try {
      renderGoals();
      console.log('[Mocha] ✓ renderGoals done');
    } catch (e) {
      console.error('[Mocha] ✗ renderGoals failed:', e);
    }
    
    console.log('[Mocha] Setting up event listeners...');
    try {
      setupEventListeners();
      console.log('[Mocha] ✓ setupEventListeners done');
      
      setupConfirmModal();
      console.log('[Mocha] ✓ setupConfirmModal done');
      
      setupNotesModal();
      console.log('[Mocha] ✓ setupNotesModal done');
    } catch (e) {
      console.error('[Mocha] ✗ setupEventListeners FAILED:', e);
      console.error('[Mocha] Stack:', e.stack);
    }
    
    try {
      setupFormListeners();
      console.log('[Mocha] ✓ setupFormListeners done');
    } catch (e) {
      console.error('[Mocha] ✗ setupFormListeners failed:', e);
    }

    // If there's an active session, show it
    if (activeSession) {
      console.log('[Mocha] Active session detected, showing it');
      showActiveSession();
      startTimerDisplay();
    }

    console.log('[Mocha] ===== POPUP INITIALIZED SUCCESSFULLY =====');
  } catch (error) {
    console.error('[Mocha] CRITICAL ERROR initializing popup:', error);
    console.error('[Mocha] Error stack:', error.stack);
  }
}

/**
 * Loads and calculates weekly progress
 */
async function loadWeeklyProgress() {
  const { start, end } = getCurrentWeekRange();

  // Try to get cached progress first
  weeklyProgress = await getWeeklyProgress();

  // If no cache or different week, recalculate
  if (!weeklyProgress || weeklyProgress.weekStart !== start) {
    const sessions = await getSessionsByDateRange(start, end);
    weeklyProgress = calculateWeeklyProgress(sessions, tasks, goals, start);
    await saveWeeklyProgress(weeklyProgress);
  }
}

// ============================================
// 4. DATA LOADING FUNCTIONS
// ============================================

/**
 * Reloads goals from storage and re-renders
 */
async function reloadGoals() {
  console.log('[Mocha] Reloading goals...');
  
  goals = (await getGoals()).filter(g => !g.archived);
  tasks = await getTasks();
  
  // Force recalculation of weekly progress after session completion
  const { start, end } = getCurrentWeekRange();
  const sessions = await getSessionsByDateRange(start, end);
  
  console.log('[Mocha] Sessions in current week:', sessions.length);
  console.log('[Mocha] Session details:', sessions);
  
  weeklyProgress = calculateWeeklyProgress(sessions, tasks, goals, start);
  
  console.log('[Mocha] Calculated weekly progress:', weeklyProgress);
  
  await saveWeeklyProgress(weeklyProgress);
  
  renderGoals();
}

/**
 * Reloads gamification data and updates points display
 */
async function reloadGamification() {
  gamification = await getGamification();
  renderPoints();
}

// ============================================
// 5. UI RENDERING FUNCTIONS
// ============================================

/**
 * Renders the character section
 */
function renderCharacter() {
  // Character greeting removed from homepage - no longer needed
  console.log('[Mocha] Character:', character?.name);
}

/**
 * Renders the points display in header
 */
function renderPoints() {
  const pointsValueEl = document.getElementById('points-value');
  if (gamification) {
    pointsValueEl.textContent = gamification.totalPoints.toLocaleString();
  }
}

/**
 * Renders the goals list
 */
function renderGoals() {
  const goalsListEl = document.getElementById('goals-list');
  
  // If goals list doesn't exist (Callie-style home), skip rendering
  if (!goalsListEl) {
    console.log('[Mocha] Goals list not found - using Callie-style home');
    return;
  }
  
  const emptyStateEl = document.getElementById('empty-goals-state');

  // Clear existing goal cards (but keep empty state)
  const existingCards = goalsListEl.querySelectorAll('.goal-card');
  existingCards.forEach(card => card.remove());

  if (goals.length === 0) {
    if (emptyStateEl) emptyStateEl.style.display = 'block';
    return;
  }

  if (emptyStateEl) emptyStateEl.style.display = 'none';

  // Create a card for each goal
  goals.forEach(goal => {
    const card = createGoalCard(goal);
    goalsListEl.appendChild(card);
  });
}

/**
 * Creates a goal card element
 * @param {import('../models/data-models.js').Goal} goal
 * @returns {HTMLElement}
 */
function createGoalCard(goal) {
  const card = document.createElement('div');
  card.className = 'goal-card';
  card.style.borderLeftColor = goal.color;
  card.dataset.goalId = goal.id;

  // Get progress for this goal
  const progress = weeklyProgress?.goals[goal.id] || { hoursCompleted: 0, tasksCompleted: 0 };

  // Calculate percentages
  const hoursPercent = calculatePercentage(progress.hoursCompleted, goal.weeklyHourGoal);
  const tasksPercent = calculatePercentage(progress.tasksCompleted, goal.weeklyTaskGoal);

  // Build progress HTML
  let progressHtml = '';

  if (goal.trackHours && goal.weeklyHourGoal) {
    progressHtml += `
      <div class="progress-row">
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${hoursPercent}%; background: linear-gradient(90deg, ${goal.color} 0%, ${goal.color}99 100%);"></div>
        </div>
        <span class="progress-text">${progress.hoursCompleted.toFixed(1)}/${goal.weeklyHourGoal}h (${hoursPercent}%)</span>
      </div>
    `;
  }

  if (goal.trackTasks && goal.weeklyTaskGoal) {
    progressHtml += `
      <div class="progress-row">
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${tasksPercent}%; background: linear-gradient(90deg, ${goal.color} 0%, ${goal.color}99 100%);"></div>
        </div>
        <span class="progress-text">${progress.tasksCompleted}/${goal.weeklyTaskGoal} ${goal.taskUnit} (${tasksPercent}%)</span>
      </div>
    `;
  }

  // Get last session date for this goal
  const goalTasks = tasks.filter(t => t.goalId === goal.id && t.completed);
  let recentText = 'No recent activity';
  if (goalTasks.length > 0) {
    const lastTask = goalTasks.sort((a, b) =>
      new Date(b.completedAt) - new Date(a.completedAt)
    )[0];
    recentText = `${lastTask.name} (${formatDate(lastTask.completedAt, 'relative')})`;
  }

  card.innerHTML = `
    <div class="goal-card-header">
      <div class="goal-card-title">
        <span class="goal-icon">${goal.icon}</span>
        <span class="goal-name">${goal.name}</span>
      </div>
      <button class="goal-menu-btn" data-goal-id="${goal.id}" title="Options">⋮</button>
    </div>
    <div class="goal-progress">
      ${progressHtml || '<span class="text-muted">No tracking configured</span>'}
    </div>
    <div class="goal-card-footer">
      <span class="goal-recent">${recentText}</span>
      <button class="btn btn-small btn-secondary goal-start-btn" data-goal-id="${goal.id}">
        Start Session
      </button>
    </div>
  `;

  return card;
}

// ============================================
// 6. EVENT HANDLERS
// ============================================

/**
 * Sets up all event listeners
 */
function setupEventListeners() {
  // Navigation buttons - Home stays in popup, Progress/Shop open in new tabs
  const navHome = document.getElementById('nav-home');
  const navProgress = document.getElementById('nav-progress');
  const navShop = document.getElementById('nav-shop');
  const navSettings = document.getElementById('nav-settings');
  
  if (navHome) {
    navHome.addEventListener('click', () => {
      console.log('[Mocha] Home clicked');
      switchPage('home');
    });
  }
  if (navProgress) {
    navProgress.addEventListener('click', () => {
      console.log('[Mocha] Progress clicked - opening in new tab');
      chrome.tabs.create({ url: chrome.runtime.getURL('pages/progress.html') });
    });
  }
  if (navShop) {
    navShop.addEventListener('click', () => {
      console.log('[Mocha] Shop clicked - opening in new tab');
      chrome.tabs.create({ url: chrome.runtime.getURL('pages/shop.html') });
    });
  }
  if (navSettings) {
    navSettings.addEventListener('click', () => {
      console.log('[Mocha] Settings clicked');
      switchPage('settings');
    });
  }

  // Quick action buttons (removed - only start session on home)
  const startSessionSmallBtn = document.getElementById('start-session-btn-small');
  if (startSessionSmallBtn) {
    console.log('[Mocha] Start session small button found');
    startSessionSmallBtn.addEventListener('click', () => {
      console.log('[Mocha] START SESSION BUTTON CLICKED!');
      showStartSessionModal();
    });
  }

  // Session bar controls
  const sessionBarPauseBtn = document.getElementById('session-bar-pause-btn');
  const sessionBarStopBtn = document.getElementById('session-bar-stop-btn');
  if (sessionBarPauseBtn) sessionBarPauseBtn.addEventListener('click', handlePauseSession);
  if (sessionBarStopBtn) sessionBarStopBtn.addEventListener('click', handleStopSession);

  // Start exploration/session button (legacy)
  const startExpBtn = document.getElementById('start-exploration-btn');
  if (startExpBtn) {
    console.log('[Mocha] Start button found, attaching listener');
    startExpBtn.addEventListener('click', () => {
      console.log('[Mocha] START BUTTON CLICKED!');
      showStartSessionModal();
    });
  } else {
    console.log('[Mocha] Start button not found');
  }

  // Add Goal buttons (kept for modals)
  const addGoalBtn = document.getElementById('add-goal-btn');
  const addFirstGoalBtn = document.getElementById('add-first-goal-btn');
  if (addGoalBtn) addGoalBtn.addEventListener('click', showAddGoalModal);
  if (addFirstGoalBtn) addFirstGoalBtn.addEventListener('click', showAddGoalModal);

  // Start Session button (legacy)
  const startSessionBtn = document.getElementById('start-session-btn');
  if (startSessionBtn) startSessionBtn.addEventListener('click', showStartSessionModal);

  // Modal close buttons
  const closeGoalModal = document.getElementById('close-goal-modal');
  const cancelGoalBtn = document.getElementById('cancel-goal-btn');
  const closeSessionModal = document.getElementById('close-session-modal');
  const cancelSessionBtn = document.getElementById('cancel-session-btn');
  
  if (closeGoalModal) closeGoalModal.addEventListener('click', hideAddGoalModal);
  if (cancelGoalBtn) cancelGoalBtn.addEventListener('click', hideAddGoalModal);
  if (closeSessionModal) closeSessionModal.addEventListener('click', hideStartSessionModal);
  if (cancelSessionBtn) cancelSessionBtn.addEventListener('click', hideStartSessionModal);

  // Click outside modal to close
  const addGoalModalEl = document.getElementById('add-goal-modal');
  const startSessionModalEl = document.getElementById('start-session-modal');
  
  if (addGoalModalEl) {
    addGoalModalEl.addEventListener('click', (e) => {
      if (e.target.id === 'add-goal-modal') hideAddGoalModal();
    });
  }
  
  if (startSessionModalEl) {
    startSessionModalEl.addEventListener('click', (e) => {
      if (e.target.id === 'start-session-modal') hideStartSessionModal();
    });
  }

  // Goal form submission
  const goalForm = document.getElementById('goal-form');
  if (goalForm) goalForm.addEventListener('submit', handleGoalFormSubmit);

  // Begin session button
  const beginSessionBtn = document.getElementById('begin-session-btn');
  if (beginSessionBtn) beginSessionBtn.addEventListener('click', handleBeginSession);

  // Session controls (new overlay buttons)
  const pauseBtnNew = document.getElementById('pause-session-btn-new');
  const stopBtnNew = document.getElementById('stop-session-btn-new');
  if (pauseBtnNew) pauseBtnNew.addEventListener('click', handlePauseSession);
  if (stopBtnNew) stopBtnNew.addEventListener('click', handleStopSession);

  // Session controls (legacy - kept for backward compatibility)
  const pauseBtn = document.getElementById('pause-session-btn');
  const stopBtn = document.getElementById('stop-session-btn');
  if (pauseBtn) pauseBtn.addEventListener('click', handlePauseSession);
  if (stopBtn) stopBtn.addEventListener('click', handleStopSession);

  // Goal menu items
  const editGoalItem = document.getElementById('edit-goal-item');
  const archiveGoalItem = document.getElementById('archive-goal-item');
  const deleteGoalItem = document.getElementById('delete-goal-item');
  
  if (editGoalItem) editGoalItem.addEventListener('click', handleEditGoal);
  if (archiveGoalItem) archiveGoalItem.addEventListener('click', handleArchiveGoal);
  if (deleteGoalItem) deleteGoalItem.addEventListener('click', handleDeleteGoal);

  // Goal list event delegation (only if goals list exists)
  const goalsList = document.getElementById('goals-list');
  if (goalsList) {
    goalsList.addEventListener('click', (e) => {
      // Handle menu button clicks
      if (e.target.classList.contains('goal-menu-btn')) {
        e.stopPropagation();
        const goalId = e.target.dataset.goalId;
        showGoalMenu(goalId, e.target);
      }

      // Handle start session button clicks
      if (e.target.classList.contains('goal-start-btn')) {
        const goalId = e.target.dataset.goalId;
        showStartSessionModal(goalId);
      }
    });
  }

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (openMenuGoalId && !e.target.closest('.dropdown-menu') && !e.target.classList.contains('goal-menu-btn')) {
      hideGoalMenu();
    }
  });
}

/**
 * Sets up form-specific listeners
 */
function setupFormListeners() {
  try {
    // Icon picker
    const iconPicker = document.getElementById('icon-picker');
    if (iconPicker) {
      const defaultIcons = ['📚', '💻', '📊', '🎯', '📖', '💼', '🧠', '✏️', '📝', '🔬'];
      defaultIcons.forEach(icon => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-option';
        btn.textContent = icon;
        if (icon === '📚') btn.classList.add('selected');
        btn.addEventListener('click', () => selectIcon(icon, btn));
        iconPicker.appendChild(btn);
      });
    }

    // Color picker
    const colorPicker = document.getElementById('color-picker');
    if (colorPicker) {
      DEFAULT_COLORS.forEach((color, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-option';
        btn.style.backgroundColor = color;
        if (index === 0) btn.classList.add('selected');
        btn.addEventListener('click', () => selectColor(color, btn));
        colorPicker.appendChild(btn);
      });
    }

    // Track hours checkbox
    const trackHours = document.getElementById('track-hours');
    if (trackHours) {
      trackHours.addEventListener('change', (e) => {
        const container = document.getElementById('hours-input-container');
        if (container) container.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    // Track tasks checkbox
    const trackTasks = document.getElementById('track-tasks');
    if (trackTasks) {
      trackTasks.addEventListener('change', (e) => {
        const container = document.getElementById('tasks-input-container');
        if (container) container.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    // Category change - update suggested icon
    document.querySelectorAll('input[name="category"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const category = GOAL_CATEGORIES.find(c => c.id === e.target.value);
        if (category) {
          selectIcon(category.icon, document.querySelector(`.icon-option[textContent="${category.icon}"]`));

          // Update task unit suggestion
          const taskUnitSelect = document.getElementById('task-unit');
          if (taskUnitSelect) taskUnitSelect.value = category.defaultTaskUnit;
        }
      });
    });
  } catch (error) {
    console.error('[Mocha] Error in setupFormListeners:', error);
  }
}

/**
 * Selects an icon in the picker
 */
function selectIcon(icon, btn) {
  document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  document.getElementById('goal-icon').value = icon;
}

/**
 * Selects a color in the picker
 */
function selectColor(color, btn) {
  document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  document.getElementById('goal-color').value = color;
}

// ============================================
// 7. MODAL FUNCTIONS
// ============================================

/**
 * Shows the Add Goal modal
 */
function showAddGoalModal() {
  editingGoalId = null;
  resetGoalForm();
  document.getElementById('add-goal-modal').style.display = 'flex';
  document.getElementById('goal-name').focus();
}

/**
 * Hides the Add Goal modal
 */
function hideAddGoalModal() {
  document.getElementById('add-goal-modal').style.display = 'none';
  resetGoalForm();
}

/**
 * Resets the goal form to defaults
 */
function resetGoalForm() {
  document.getElementById('goal-form').reset();
  document.getElementById('goal-icon').value = '📚';
  document.getElementById('goal-color').value = DEFAULT_COLORS[0];

  // Reset visual selections
  document.querySelectorAll('.icon-option').forEach((b, i) => {
    b.classList.toggle('selected', i === 0);
  });
  document.querySelectorAll('.color-option').forEach((b, i) => {
    b.classList.toggle('selected', i === 0);
  });

  // Reset conditional inputs
  document.getElementById('hours-input-container').style.display = 'block';
  document.getElementById('tasks-input-container').style.display = 'none';
  document.getElementById('track-hours').checked = true;
  document.getElementById('track-tasks').checked = false;

  // Clear errors
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
}

/**
 * Handles goal form submission
 */
async function handleGoalFormSubmit(e) {
  e.preventDefault();

  // Get form values
  const name = document.getElementById('goal-name').value.trim();
  const category = document.querySelector('input[name="category"]:checked').value;
  const icon = document.getElementById('goal-icon').value;
  const color = document.getElementById('goal-color').value;
  const trackHours = document.getElementById('track-hours').checked;
  const trackTasks = document.getElementById('track-tasks').checked;
  const weeklyHourGoal = trackHours ? parseInt(document.getElementById('weekly-hour-goal').value) : null;
  const weeklyTaskGoal = trackTasks ? parseInt(document.getElementById('weekly-task-goal').value) : null;
  const taskUnit = document.getElementById('task-unit').value;

  // Validation
  let hasError = false;

  if (!name) {
    document.getElementById('goal-name-error').textContent = 'Please enter a goal name';
    hasError = true;
  } else {
    document.getElementById('goal-name-error').textContent = '';
  }

  if (!trackHours && !trackTasks) {
    document.getElementById('form-error').textContent = 'Please select at least one tracking option';
    hasError = true;
  } else {
    document.getElementById('form-error').textContent = '';
  }

  if (trackHours && (!weeklyHourGoal || weeklyHourGoal < 1)) {
    document.getElementById('form-error').textContent = 'Please enter a valid hours goal (at least 1)';
    hasError = true;
  }

  if (trackTasks && (!weeklyTaskGoal || weeklyTaskGoal < 1)) {
    document.getElementById('form-error').textContent = 'Please enter a valid tasks goal (at least 1)';
    hasError = true;
  }

  if (hasError) return;

  try {
    if (editingGoalId) {
      // Update existing goal
      await updateGoal(editingGoalId, {
        name,
        category,
        icon,
        color,
        trackHours,
        weeklyHourGoal,
        trackTasks,
        weeklyTaskGoal,
        taskUnit
      });
      showToast('Goal updated!', 'success');
    } else {
      // Create new goal
      const goal = createGoal({
        name,
        category,
        icon,
        color,
        trackHours,
        weeklyHourGoal,
        trackTasks,
        weeklyTaskGoal,
        taskUnit
      });

      await saveGoal(goal);
      showToast('Goal created!', 'success');
    }

    hideAddGoalModal();
    await reloadGoals();
  } catch (error) {
    console.error('[Mocha] Error saving goal:', error);
    showToast('Error saving goal', 'error');
  }
}

/**
 * Shows the Start Session modal
 * @param {string} [preselectedGoalId] - Goal to preselect
 */
function showStartSessionModal(preselectedGoalId = null) {
  console.log('[Mocha] showStartSessionModal called');
  console.log('[Mocha] Number of goals:', goals.length);
  
  if (goals.length === 0) {
    showToast('Please create a goal first!', 'warning');
    return;
  }

  const goalSelectList = document.getElementById('goal-select-list');
  goalSelectList.innerHTML = '';

  goals.forEach(goal => {
    const item = document.createElement('div');
    item.className = 'goal-select-item';
    if (goal.id === preselectedGoalId) {
      item.classList.add('selected');
      selectedGoalId = goal.id;
    }
    item.dataset.goalId = goal.id;
    item.innerHTML = `
      <span class="goal-select-icon">${goal.icon}</span>
      <span class="goal-select-name">${goal.name}</span>
      <span class="goal-select-check">✓</span>
    `;
    item.addEventListener('click', () => selectGoalForSession(goal.id, item));
    goalSelectList.appendChild(item);
  });

  // Select first goal if none preselected
  if (!preselectedGoalId && goals.length > 0) {
    const firstItem = goalSelectList.firstChild;
    firstItem.classList.add('selected');
    selectedGoalId = goals[0].id;
  }

  const modal = document.getElementById('start-session-modal');
  console.log('[Mocha] Showing modal, element exists:', !!modal);
  modal.style.display = 'flex';
}

/**
 * Hides the Start Session modal
 */
function hideStartSessionModal() {
  document.getElementById('start-session-modal').style.display = 'none';
  selectedGoalId = null;
}

/**
 * Selects a goal for the session
 */
function selectGoalForSession(goalId, itemEl) {
  document.querySelectorAll('.goal-select-item').forEach(item => {
    item.classList.remove('selected');
  });
  itemEl.classList.add('selected');
  selectedGoalId = goalId;
}

/**
 * Shows the goal context menu
 */
function showGoalMenu(goalId, buttonEl) {
  openMenuGoalId = goalId;
  const menu = document.getElementById('goal-menu');
  const rect = buttonEl.getBoundingClientRect();

  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left - 100}px`;
  menu.style.display = 'block';
}

/**
 * Hides the goal context menu
 */
function hideGoalMenu() {
  document.getElementById('goal-menu').style.display = 'none';
  openMenuGoalId = null;
}

/**
 * Handles Edit Goal menu action
 */
async function handleEditGoal() {
  if (!openMenuGoalId) return;

  const goal = goals.find(g => g.id === openMenuGoalId);
  if (!goal) return;

  hideGoalMenu();

  // Populate form with goal data
  editingGoalId = goal.id;
  document.getElementById('goal-name').value = goal.name;
  document.querySelector(`input[name="category"][value="${goal.category}"]`).checked = true;
  document.getElementById('goal-icon').value = goal.icon;
  document.getElementById('goal-color').value = goal.color;
  document.getElementById('track-hours').checked = goal.trackHours;
  document.getElementById('track-tasks').checked = goal.trackTasks;

  if (goal.trackHours) {
    document.getElementById('hours-input-container').style.display = 'block';
    document.getElementById('weekly-hour-goal').value = goal.weeklyHourGoal || 10;
  } else {
    document.getElementById('hours-input-container').style.display = 'none';
  }

  if (goal.trackTasks) {
    document.getElementById('tasks-input-container').style.display = 'block';
    document.getElementById('weekly-task-goal').value = goal.weeklyTaskGoal || 3;
    document.getElementById('task-unit').value = goal.taskUnit || 'tasks';
  } else {
    document.getElementById('tasks-input-container').style.display = 'none';
  }

  // Update visual selections
  selectIcon(goal.icon, null);
  selectColor(goal.color, null);

  document.getElementById('add-goal-modal').style.display = 'flex';
}

/**
 * Handles Archive Goal menu action
 */
async function handleArchiveGoal() {
  if (!openMenuGoalId) return;

  const goal = goals.find(g => g.id === openMenuGoalId);
  if (!goal) return;

  if (confirm(`Archive "${goal.name}"? You can restore it later from Settings.`)) {
    await updateGoal(openMenuGoalId, { archived: true });
    hideGoalMenu();
    await reloadGoals();
    showToast('Goal archived', 'success');
  } else {
    hideGoalMenu();
  }
}

/**
 * Handles Delete Goal menu action
 */
async function handleDeleteGoal() {
  if (!openMenuGoalId) return;

  const goal = goals.find(g => g.id === openMenuGoalId);
  if (!goal) return;

  if (confirm(`Delete "${goal.name}"? This will also delete all associated tasks and cannot be undone.`)) {
    await deleteGoal(openMenuGoalId);
    hideGoalMenu();
    await reloadGoals();
    showToast('Goal deleted', 'success');
  } else {
    hideGoalMenu();
  }
}

// ============================================
// 8. SESSION FUNCTIONS
// ============================================

/**
 * Handles beginning a new session
 */
async function handleBeginSession() {
  console.log('[Mocha] handleBeginSession called');
  console.log('[Mocha] Selected goal ID:', selectedGoalId);
  
  if (!selectedGoalId) {
    document.getElementById('session-goal-error').textContent = 'Please select a goal';
    return;
  }

  const mode = document.querySelector('input[name="session-mode"]:checked').value;
  const taskId = document.getElementById('task-select').value || null;

  console.log('[Mocha] Creating session with mode:', mode);

  // Create active session
  const session = createActiveSession({
    goalId: selectedGoalId,
    taskId: taskId,
    mode: mode
  });

  console.log('[Mocha] Session created:', session);

  await saveActiveSession(session);
  activeSession = session;

  console.log('[Mocha] Session saved, hiding modal');

  hideStartSessionModal();
  
  console.log('[Mocha] Calling showActiveSession');
  showActiveSession();
  
  console.log('[Mocha] Calling startTimerDisplay');
  startTimerDisplay();

  // Notify background script
  chrome.runtime.sendMessage({ type: 'SESSION_STARTED', session: session });

  showToast('Session started! Good luck!', 'success');
}

/**
 * Shows the active session banner
 */
function showActiveSession() {
  if (!activeSession) return;

  const goal = goals.find(g => g.id === activeSession.goalId);
  if (!goal) return;

  console.log('[Mocha] Showing active session for goal:', goal.name);

  // Show session bar at bottom
  const sessionBar = document.getElementById('session-bar');
  if (sessionBar) sessionBar.style.display = 'block';

  // Update session bar content
  const iconEl = document.getElementById('session-bar-icon');
  const goalEl = document.getElementById('session-bar-goal');
  
  if (iconEl) iconEl.textContent = goal.icon;
  if (goalEl) goalEl.textContent = goal.name;

  // Update pause button state
  const pauseBtn = document.getElementById('session-bar-pause-btn');
  if (pauseBtn) {
    if (activeSession.pausedAt) {
      pauseBtn.textContent = '▶️';
      pauseBtn.classList.add('paused');
    } else {
      pauseBtn.textContent = '⏸️';
      pauseBtn.classList.remove('paused');
    }
  }

  // Hide legacy elements
  const startButtonContainer = document.getElementById('start-button-container');
  if (startButtonContainer) startButtonContainer.style.display = 'none';
  
  const sessionOverlay = document.getElementById('session-controls-overlay');
  if (sessionOverlay) sessionOverlay.style.display = 'none';
}

/**
 * Hides the active session banner
 */
function hideActiveSession() {
  // Hide session bar
  const sessionBar = document.getElementById('session-bar');
  if (sessionBar) sessionBar.style.display = 'none';

  // Show legacy elements if they exist
  const startButtonContainer = document.getElementById('start-button-container');
  const sessionOverlay = document.getElementById('session-controls-overlay');
  
  if (startButtonContainer) startButtonContainer.style.display = 'block';
  if (sessionOverlay) sessionOverlay.style.display = 'none';
}

/**
 * Starts the timer display update loop
 */
function startTimerDisplay() {
  // Clear any existing interval
  if (timerInterval) clearInterval(timerInterval);

  const timerEl = document.getElementById('session-bar-timer');
  
  if (!timerEl || !activeSession) {
    console.warn('[Mocha] Cannot start timer display - missing elements');
    return;
  }

  // Update immediately
  const elapsed = calculateElapsedTime(activeSession);
  const timerText = formatTimer(elapsed);
  timerEl.textContent = timerText;

  // Update every second
  timerInterval = setInterval(() => {
    if (!activeSession || activeSession.pausedAt) return;

    const elapsed = calculateElapsedTime(activeSession);
    const timerText = formatTimer(elapsed);
    
    if (timerEl) {
      timerEl.textContent = timerText;
    }
  }, 1000);
  
  console.log('[Mocha] Timer display started');
}

/**
 * Handles pause/resume session
 */
async function handlePauseSession() {
  if (!activeSession) return;

  const pauseBtn = document.getElementById('session-bar-pause-btn');
  
  if (activeSession.pausedAt) {
    // Resume
    const pausedDuration = (Date.now() - new Date(activeSession.pausedAt).getTime()) / 1000;
    activeSession.totalPausedDuration += pausedDuration;
    activeSession.pausedAt = null;

    if (pauseBtn) {
      pauseBtn.textContent = '⏸️';
      pauseBtn.classList.remove('paused');
    }
    
    // Restart timer
    startTimerDisplay();
  } else {
    // Pause
    activeSession.pausedAt = new Date().toISOString();

    if (pauseBtn) {
      pauseBtn.textContent = '▶️';
      pauseBtn.classList.add('paused');
    }
  }

  await saveActiveSession(activeSession);
  chrome.runtime.sendMessage({ type: 'SESSION_PAUSED', session: activeSession });
}

/**
 * Handles stopping the session
 */
async function handleStopSession() {
  if (!activeSession) return;

  // Confirm if session is long
  const elapsed = calculateElapsedTime(activeSession);
  console.log('[Mocha] Stopping session. Elapsed time (seconds):', elapsed);
  
  if (elapsed > 60) { // More than 1 minute
    const confirmed = await showConfirmDialog(
      'End Study Session?',
      'Are you sure you want to end this study session? Your progress will be saved.',
      '🛑'
    );
    if (!confirmed) return;
  }

  // Clear timer
  if (timerInterval) clearInterval(timerInterval);

  // Calculate final duration and points
  const finalDuration = calculateElapsedTime(activeSession);
  const pointsEarned = calculateSessionPoints(finalDuration, false, null);
  
  console.log('[Mocha] Final duration:', finalDuration, 'seconds');
  console.log('[Mocha] Points earned:', pointsEarned);

  // Ask for notes
  const notes = await showNotesModal();
  console.log('[Mocha] Session notes:', notes || 'none');

  // Create completed session
  const completedSession = createSession({
    goalId: activeSession.goalId,
    startTime: activeSession.startTime,
    endTime: new Date().toISOString(),
    duration: finalDuration,
    mode: activeSession.mode,
    pomodorosCompleted: activeSession.pomodorosCompleted,
    taskId: activeSession.taskId,
    taskCompleted: false,
    pointsEarned: pointsEarned,
    pausedDuration: activeSession.totalPausedDuration,
    isManual: false,
    notes: notes || ''
  });
  
  console.log('[Mocha] Completed session:', completedSession);

  // Save completed session
  await saveSession(completedSession);
  console.log('[Mocha] Session saved to storage');

  // Update points
  await updatePoints(pointsEarned);

  // Update streak
  await updateStreak();

  // Clear active session
  await clearActiveSession();
  activeSession = null;

  // Notify background script
  chrome.runtime.sendMessage({ type: 'SESSION_STOPPED' });

  // Update UI
  hideActiveSession();
  await reloadGoals();
  await reloadGamification();

  showToast(`Session complete! +${pointsEarned} points`, 'success');
}

// ============================================
// 9. UTILITY FUNCTIONS
// ============================================

/**
 * Switches between different pages in the popup
 * @param {string} pageName - Page to switch to ('home', 'progress', 'shop', 'settings')
 */
// ============================================
// CONFIRMATION MODAL
// ============================================

function setupConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  const overlay = document.getElementById('confirm-modal-overlay');
  const cancelBtn = document.getElementById('confirm-cancel');
  const okBtn = document.getElementById('confirm-ok');

  if (!modal || !overlay || !cancelBtn || !okBtn) {
    console.warn('[Mocha] Confirm modal elements not found');
    return;
  }

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
    const iconEl = document.getElementById('confirm-icon');
    
    if (!modal || !titleEl || !messageEl || !iconEl) {
      console.warn('[Mocha] Confirm modal elements not found, using default confirm');
      resolve(confirm(`${title}\n\n${message}`));
      return;
    }
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    iconEl.textContent = icon;
    
    modal.classList.add('active');
  });
}

function setupNotesModal() {
  const modal = document.getElementById('notes-modal');
  const overlay = document.getElementById('notes-modal-overlay');
  const closeBtn = document.getElementById('notes-modal-close');
  const skipBtn = document.getElementById('notes-skip');
  const saveBtn = document.getElementById('notes-save');
  const textarea = document.getElementById('session-notes-input');

  if (!modal || !overlay || !closeBtn || !skipBtn || !saveBtn) {
    console.warn('[Mocha] Notes modal elements not found');
    return;
  }

  const closeModal = (notes = null) => {
    modal.classList.remove('active');
    textarea.value = '';
    if (notesResolve) {
      notesResolve(notes);
      notesResolve = null;
    }
  };

  overlay.addEventListener('click', () => closeModal(null));
  closeBtn.addEventListener('click', () => closeModal(null));
  skipBtn.addEventListener('click', () => closeModal(null));
  saveBtn.addEventListener('click', () => {
    const notes = textarea.value.trim();
    closeModal(notes || null);
  });
}

function showNotesModal() {
  return new Promise((resolve) => {
    notesResolve = resolve;
    
    const modal = document.getElementById('notes-modal');
    const textarea = document.getElementById('session-notes-input');
    
    if (!modal || !textarea) {
      console.warn('[Mocha] Notes modal not found');
      resolve(null);
      return;
    }
    
    textarea.value = '';
    modal.classList.add('active');
    setTimeout(() => textarea.focus(), 100);
  });
}

// ============================================
// PAGE SWITCHING
// ============================================

function switchPage(pageName) {
  console.log('[Mocha] Switching to page:', pageName);
  
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  // Remove active class from all nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show the selected page
  const pageId = `${pageName}-page`;
  const pageEl = document.getElementById(pageId);
  if (pageEl) {
    pageEl.classList.add('active');
    console.log('[Mocha] Page activated:', pageId);
  } else {
    console.error('[Mocha] Page not found:', pageId);
  }

  // Activate the corresponding nav button
  const navBtn = document.getElementById(`nav-${pageName}`);
  if (navBtn) {
    navBtn.classList.add('active');
  }
}

/**
 * Shows a toast notification
 * @param {string} message - Message to show
 * @param {'success'|'error'|'warning'|'info'} type - Toast type
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toast-icon');
  const toastMessage = document.getElementById('toast-message');

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toastIcon.textContent = icons[type] || icons.info;
  toastMessage.textContent = message;

  toast.classList.remove('toast-out');
  toast.style.display = 'flex';

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => {
      toast.style.display = 'none';
      toast.classList.remove('toast-out');
    }, 250);
  }, 3000);
}

// ============================================
// MESSAGE LISTENER - Receives messages from background worker
// ============================================

/**
 * Listens for messages from the background service worker
 *
 * The background worker sends:
 * - TIMER_TICK: Periodic updates with elapsed time
 * - SESSION_AUTO_PAUSED: When session is auto-paused due to idle
 *
 * This allows the popup to stay in sync even if it was closed
 * and reopened while a session was running.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'TIMER_TICK':
      // Update the timer display with elapsed time from background
      if (activeSession && !activeSession.pausedAt) {
        const timerEl = document.getElementById('session-timer');
        if (timerEl) {
          timerEl.textContent = formatTimer(message.elapsed);
        }
      }
      break;

    case 'SESSION_AUTO_PAUSED':
      // Session was auto-paused due to idle
      activeSession = message.session;
      if (activeSession) {
        document.getElementById('pause-session-btn').textContent = '▶️';
        document.getElementById('pause-session-btn').title = 'Resume';
        showToast('Session paused (idle detected)', 'info');
      }
      break;

    case 'SESSION_RESUMED_FROM_IDLE':
      // Session was resumed after idle
      activeSession = message.session;
      if (activeSession) {
        document.getElementById('pause-session-btn').textContent = '⏸️';
        document.getElementById('pause-session-btn').title = 'Pause';
      }
      break;
  }

  // Always send a response to avoid "The message port closed" errors
  sendResponse({ received: true });
  return false;
});

// ============================================
// INITIALIZE ON LOAD
// ============================================

document.addEventListener('DOMContentLoaded', init);
