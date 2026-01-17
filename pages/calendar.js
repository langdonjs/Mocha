/**
 * Calendar Page JavaScript
 *
 * This page shows a monthly calendar view with:
 * - Study days highlighted
 * - Day detail sidebar
 * - Streak statistics
 */

import {
  getSessions,
  getGoals,
  getGamification
} from '../utils/storage.js';

import {
  formatDuration,
  calculateStreak
} from '../utils/calculations.js';

import { TIME } from '../utils/constants.js';

// ============================================
// STATE
// ============================================

let sessions = [];
let goals = [];
let gamification = null;
let currentDate = new Date();
let selectedDate = null;

// Map of date strings to session arrays
let sessionsByDate = {};

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  console.log('[Calendar] Initializing...');

  try {
    // Load data
    [sessions, goals, gamification] = await Promise.all([
      getSessions(),
      getGoals(),
      getGamification()
    ]);

    // Build sessions by date map
    buildSessionsMap();

    // Set up event listeners
    setupEventListeners();

    // Render the page
    renderCalendar();
    renderStreakStats();

    // Select today by default
    selectDate(new Date());

    console.log('[Calendar] Initialization complete');
  } catch (error) {
    console.error('[Calendar] Error initializing:', error);
  }
}

// ============================================
// HELPERS
// ============================================

function buildSessionsMap() {
  sessionsByDate = {};

  sessions.forEach(session => {
    const dateKey = new Date(session.startTime).toISOString().split('T')[0];
    if (!sessionsByDate[dateKey]) {
      sessionsByDate[dateKey] = [];
    }
    sessionsByDate[dateKey].push(session);
  });
}

function getDateKey(date) {
  return date.toISOString().split('T')[0];
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
}

// ============================================
// CALENDAR RENDERING
// ============================================

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Update month label
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('month-label').textContent = monthName;

  // Get first day of month and total days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();

  // Get day of week for first day (0 = Sunday, adjust for Monday start)
  let startDayOfWeek = firstDay.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  // Get days from previous month to fill first row
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const container = document.getElementById('calendar-days');
  container.innerHTML = '';

  const today = getDateKey(new Date());
  const selectedKey = selectedDate ? getDateKey(selectedDate) : null;

  // Previous month days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const date = new Date(year, month - 1, day);
    createDayElement(container, date, day, true);
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day);
    createDayElement(container, date, day, false);
  }

  // Next month days to fill the grid
  const totalCells = container.children.length;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  for (let day = 1; day <= remainingCells; day++) {
    const date = new Date(year, month + 1, day);
    createDayElement(container, date, day, true);
  }
}

function createDayElement(container, date, dayNumber, isOtherMonth) {
  const dateKey = getDateKey(date);
  const today = getDateKey(new Date());
  const selectedKey = selectedDate ? getDateKey(selectedDate) : null;
  const daySessions = sessionsByDate[dateKey] || [];
  const hasSessions = daySessions.length > 0;

  const dayEl = document.createElement('div');
  dayEl.className = 'calendar-day';
  dayEl.dataset.date = dateKey;

  if (isOtherMonth) dayEl.classList.add('other-month');
  if (dateKey === today) dayEl.classList.add('today');
  if (dateKey === selectedKey) dayEl.classList.add('selected');
  if (hasSessions) dayEl.classList.add('has-sessions');

  // Calculate hours for this day
  const dayHours = daySessions.reduce((sum, s) => sum + s.duration, 0) / TIME.secondsPerHour;

  let innerHTML = `<span class="day-number">${dayNumber}</span>`;

  if (hasSessions) {
    innerHTML += `<span class="study-indicator"></span>`;
    if (dayHours >= 0.5) {
      innerHTML += `<span class="day-hours">${dayHours.toFixed(1)}h</span>`;
    }
  }

  dayEl.innerHTML = innerHTML;

  dayEl.addEventListener('click', () => {
    selectDate(date);
  });

  container.appendChild(dayEl);
}

// ============================================
// DATE SELECTION
// ============================================

function selectDate(date) {
  selectedDate = date;

  // Update calendar selection
  document.querySelectorAll('.calendar-day').forEach(el => {
    el.classList.remove('selected');
    if (el.dataset.date === getDateKey(date)) {
      el.classList.add('selected');
    }
  });

  // Update sidebar
  renderDayDetails(date);
}

function renderDayDetails(date) {
  const dateKey = getDateKey(date);
  const daySessions = sessionsByDate[dateKey] || [];

  // Update header
  const dayName = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  document.getElementById('selected-day-title').textContent = dayName;

  const isToday = dateKey === getDateKey(new Date());
  document.getElementById('selected-day-subtitle').textContent =
    isToday ? 'Today' : date.toLocaleDateString('en-US', { year: 'numeric' });

  // Calculate stats
  const totalHours = daySessions.reduce((sum, s) => sum + s.duration, 0) / TIME.secondsPerHour;
  const totalPoints = daySessions.reduce((sum, s) => sum + (s.pointsEarned || 0), 0);

  const statsEl = document.getElementById('day-stats');
  const noSessionsEl = document.getElementById('no-sessions-day');
  const sessionsListEl = document.getElementById('day-sessions-list');

  if (daySessions.length === 0) {
    statsEl.style.display = 'none';
    noSessionsEl.style.display = 'block';

    // Clear session items
    sessionsListEl.querySelectorAll('.day-session-item').forEach(el => el.remove());
    return;
  }

  statsEl.style.display = 'flex';
  noSessionsEl.style.display = 'none';

  document.getElementById('day-hours').textContent = `${totalHours.toFixed(1)}h`;
  document.getElementById('day-sessions').textContent = daySessions.length;
  document.getElementById('day-points').textContent = totalPoints;

  // Render sessions list
  sessionsListEl.querySelectorAll('.day-session-item').forEach(el => el.remove());

  daySessions
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .forEach(session => {
      const goal = goals.find(g => g.id === session.goalId);
      const startTime = new Date(session.startTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });

      const itemEl = document.createElement('div');
      itemEl.className = 'day-session-item';

      itemEl.innerHTML = `
        <span class="day-session-icon">${goal?.icon || '📚'}</span>
        <div class="day-session-content">
          <div class="day-session-goal">${goal?.name || 'Unknown Goal'}</div>
          <div class="day-session-time">${startTime}</div>
        </div>
        <span class="day-session-duration">${formatDuration(session.duration)}</span>
      `;

      sessionsListEl.appendChild(itemEl);
    });
}

// ============================================
// STREAK STATS
// ============================================

function renderStreakStats() {
  const { current, longest } = calculateStreak(sessions);

  document.getElementById('current-streak').textContent = current;
  document.getElementById('longest-streak').textContent = gamification?.longestStreak || longest;

  // Calculate total study days
  const uniqueDays = new Set(sessions.map(s => getDateKey(new Date(s.startTime))));
  document.getElementById('total-study-days').textContent = uniqueDays.size;

  // Calculate this month's study days
  const thisMonth = new Date();
  const thisMonthKey = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthDays = Array.from(uniqueDays).filter(d => d.startsWith(thisMonthKey)).length;
  document.getElementById('this-month-days').textContent = thisMonthDays;
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', init);
