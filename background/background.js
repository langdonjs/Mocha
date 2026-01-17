/**
 * Background Service Worker for Mocha Study Tracker
 *
 * This is the "always running" part of the extension that handles:
 * 1. Timer management (keeps running even when popup is closed)
 * 2. Idle detection (auto-pause when user is inactive)
 * 3. Notifications (session reminders, streak alerts)
 * 4. Message passing between popup and background
 *
 * KEY CONCEPT: Service Worker vs Background Page
 * In Manifest V3, background scripts run as service workers, not persistent pages.
 * This means:
 * - They can be terminated when idle and restarted when needed
 * - We can't use setInterval reliably (use chrome.alarms instead)
 * - State must be stored in chrome.storage, not in memory
 *
 * HOW THE TIMER WORKS:
 * 1. Popup sends 'SESSION_STARTED' message
 * 2. We create a chrome.alarm that fires every minute
 * 3. On each alarm tick:
 *    - Get activeSession from storage
 *    - If session exists and not paused, it's still running
 *    - If popup is open, send it a message to update the UI
 * 4. When session stops, we clear the alarm
 *
 * WHY ALARMS INSTEAD OF setInterval?
 * - Alarms persist across service worker restarts
 * - Chrome manages them efficiently
 * - Minimum interval is ~1 minute (we work around this)
 *
 * IDLE DETECTION:
 * - chrome.idle.onStateChanged fires when user goes idle/active
 * - We use this to auto-pause sessions when user walks away
 * - Helps ensure accurate time tracking
 */

import { STORAGE_KEYS } from '../utils/constants.js';

// ============================================
// CONSTANTS
// ============================================

/**
 * Name for our session timer alarm
 * Using a constant prevents typos
 */
const ALARM_NAME_SESSION_TIMER = 'mocha_session_timer';

/**
 * Name for weekly reset alarm (resets pointsThisWeek)
 */
const ALARM_NAME_WEEKLY_RESET = 'mocha_weekly_reset';

/**
 * Idle detection threshold in seconds
 * User is considered "idle" after this many seconds of inactivity
 * Default: 5 minutes (300 seconds)
 */
const IDLE_THRESHOLD_SECONDS = 300;

/**
 * Whether idle auto-pause is enabled
 * Could be made a user setting later
 */
let idleAutoPauseEnabled = true;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Called when service worker starts
 * Sets up listeners and restores state
 */
async function initialize() {
  console.log('[Mocha Background] Service worker initializing...');

  // Set up idle detection threshold
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);

  // Check if there's an active session that needs timer restoration
  const activeSession = await getActiveSession();
  if (activeSession) {
    console.log('[Mocha Background] Found active session, restoring timer');
    startSessionTimer();
  }

  // Set up weekly reset alarm (fires every Monday at midnight)
  setupWeeklyResetAlarm();

  console.log('[Mocha Background] Initialization complete');
}

// ============================================
// STORAGE HELPERS
// ============================================

/**
 * Gets the active session from storage
 * @returns {Promise<Object|null>} Active session or null
 */
async function getActiveSession() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.activeSession);
    return result[STORAGE_KEYS.activeSession] || null;
  } catch (error) {
    console.error('[Mocha Background] Error getting active session:', error);
    return null;
  }
}

/**
 * Saves the active session to storage
 * @param {Object} session - Active session object
 */
async function saveActiveSession(session) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.activeSession]: session });
  } catch (error) {
    console.error('[Mocha Background] Error saving active session:', error);
  }
}

/**
 * Clears the active session from storage
 */
async function clearActiveSession() {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.activeSession);
  } catch (error) {
    console.error('[Mocha Background] Error clearing active session:', error);
  }
}

/**
 * Gets user settings from storage
 * @returns {Promise<Object>} Settings object
 */
async function getSettings() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
    return result[STORAGE_KEYS.settings] || {
      idleDetection: { enabled: true, timeoutMinutes: 5 }
    };
  } catch (error) {
    console.error('[Mocha Background] Error getting settings:', error);
    return { idleDetection: { enabled: true, timeoutMinutes: 5 } };
  }
}

// ============================================
// TIMER MANAGEMENT
// ============================================

/**
 * Starts the session timer alarm
 *
 * Chrome alarms have a minimum period of ~1 minute in production,
 * but we can use periodInMinutes: 1/60 for development (every second).
 *
 * However, for reliability we use 1 minute intervals and calculate
 * elapsed time from timestamps, not by counting alarm ticks.
 */
function startSessionTimer() {
  // Create alarm that fires every minute
  // The actual elapsed time is calculated from startTime, not alarm ticks
  chrome.alarms.create(ALARM_NAME_SESSION_TIMER, {
    periodInMinutes: 1 / 60, // Approximately every second (Chrome may throttle this)
    delayInMinutes: 1 / 60
  });

  console.log('[Mocha Background] Session timer started');
}

/**
 * Stops the session timer alarm
 */
async function stopSessionTimer() {
  await chrome.alarms.clear(ALARM_NAME_SESSION_TIMER);
  console.log('[Mocha Background] Session timer stopped');
}

/**
 * Handles session timer tick
 * Called every time the alarm fires
 */
async function handleSessionTimerTick() {
  const activeSession = await getActiveSession();

  if (!activeSession) {
    // No active session, stop the timer
    console.log('[Mocha Background] No active session found, stopping timer');
    await stopSessionTimer();
    return;
  }

  // If session is paused, don't update
  if (activeSession.pausedAt) {
    return;
  }

  // Calculate current elapsed time
  const elapsed = calculateElapsedTime(activeSession);

  // Notify any open popup to update its display
  // We use chrome.runtime.sendMessage but catch errors if popup isn't open
  try {
    await chrome.runtime.sendMessage({
      type: 'TIMER_TICK',
      elapsed: elapsed,
      session: activeSession
    });
  } catch (error) {
    // This error is expected when popup isn't open - no need to log
    // The popup will recalculate elapsed time when it opens
  }
}

/**
 * Calculates elapsed time for an active session
 * Matches the logic in calculations.js
 *
 * @param {Object} activeSession - Active session object
 * @returns {number} Elapsed seconds
 */
function calculateElapsedTime(activeSession) {
  if (!activeSession || !activeSession.startTime) {
    return 0;
  }

  const now = Date.now();
  const startTime = new Date(activeSession.startTime).getTime();

  // Total time since session started
  let elapsed = (now - startTime) / 1000;

  // Subtract accumulated pause time
  elapsed -= activeSession.totalPausedDuration || 0;

  // If currently paused, subtract time since pause started
  if (activeSession.pausedAt) {
    const pauseStart = new Date(activeSession.pausedAt).getTime();
    const currentPauseDuration = (now - pauseStart) / 1000;
    elapsed -= currentPauseDuration;
  }

  return Math.max(0, Math.floor(elapsed));
}

// ============================================
// IDLE DETECTION
// ============================================

/**
 * Handles changes in user idle state
 * States: 'active', 'idle', 'locked'
 *
 * @param {string} state - New idle state
 */
async function handleIdleStateChange(state) {
  console.log('[Mocha Background] Idle state changed to:', state);

  const settings = await getSettings();
  if (!settings.idleDetection?.enabled) {
    return;
  }

  const activeSession = await getActiveSession();
  if (!activeSession) {
    return;
  }

  if (state === 'idle' || state === 'locked') {
    // User went idle - auto-pause if not already paused
    if (!activeSession.pausedAt) {
      console.log('[Mocha Background] Auto-pausing session due to idle');
      activeSession.pausedAt = new Date().toISOString();
      activeSession.autoPaused = true; // Track that this was an auto-pause
      await saveActiveSession(activeSession);

      // Notify popup if open
      try {
        await chrome.runtime.sendMessage({
          type: 'SESSION_AUTO_PAUSED',
          session: activeSession
        });
      } catch (error) {
        // Popup not open
      }

      // Show notification
      showNotification(
        'Session Auto-Paused',
        'Your study session was paused due to inactivity.',
        'idle_pause'
      );
    }
  } else if (state === 'active') {
    // User became active - offer to resume if auto-paused
    if (activeSession.pausedAt && activeSession.autoPaused) {
      console.log('[Mocha Background] User active, session was auto-paused');

      // Show notification asking if they want to resume
      showNotification(
        'Welcome Back!',
        'Your study session is still paused. Open Mocha to resume.',
        'idle_resume'
      );

      // Note: We don't auto-resume here. User should manually resume
      // to confirm they're actually back at their desk.
    }
  }
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Shows a Chrome notification
 *
 * @param {string} title - Notification title
 * @param {string} message - Notification body
 * @param {string} id - Unique notification ID (for replacing/clearing)
 */
function showNotification(title, message, id = 'mocha_notification') {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
    title: title,
    message: message,
    priority: 1
  });
}

/**
 * Handles notification clicks
 * Opens the popup when user clicks a notification
 *
 * @param {string} notificationId - ID of clicked notification
 */
function handleNotificationClick(notificationId) {
  console.log('[Mocha Background] Notification clicked:', notificationId);

  // Open the popup by simulating a click on the extension icon
  // Note: We can't directly open popup, but we can open a new tab with our pages
  if (notificationId === 'idle_resume') {
    // Just clear the notification - user will click extension icon
    chrome.notifications.clear(notificationId);
  }
}

// ============================================
// WEEKLY RESET
// ============================================

/**
 * Sets up the weekly reset alarm
 * This fires at the start of each week to reset pointsThisWeek
 */
function setupWeeklyResetAlarm() {
  // Calculate time until next Monday at midnight
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);

  const delayMinutes = (nextMonday.getTime() - now.getTime()) / (1000 * 60);

  chrome.alarms.create(ALARM_NAME_WEEKLY_RESET, {
    delayInMinutes: delayMinutes,
    periodInMinutes: 60 * 24 * 7 // Repeat every week
  });

  console.log('[Mocha Background] Weekly reset alarm set for', nextMonday.toISOString());
}

/**
 * Handles the weekly reset
 * Resets pointsThisWeek to 0
 */
async function handleWeeklyReset() {
  console.log('[Mocha Background] Performing weekly reset');

  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.gamification);
    const gamification = result[STORAGE_KEYS.gamification];

    if (gamification) {
      gamification.pointsThisWeek = 0;
      await chrome.storage.local.set({ [STORAGE_KEYS.gamification]: gamification });
      console.log('[Mocha Background] Weekly points reset complete');
    }
  } catch (error) {
    console.error('[Mocha Background] Error resetting weekly points:', error);
  }
}

// ============================================
// MESSAGE HANDLERS
// ============================================

/**
 * Handles messages from the popup
 *
 * @param {Object} message - Message object with type property
 * @param {Object} sender - Sender info
 * @param {Function} sendResponse - Response callback
 * @returns {boolean} True to indicate async response
 */
function handleMessage(message, sender, sendResponse) {
  console.log('[Mocha Background] Received message:', message.type);

  switch (message.type) {
    case 'SESSION_STARTED':
      // Popup started a new session
      startSessionTimer();
      sendResponse({ success: true });
      break;

    case 'SESSION_PAUSED':
      // Session was paused (manually or auto)
      // Timer keeps running but we skip updates while paused
      sendResponse({ success: true });
      break;

    case 'SESSION_RESUMED':
      // Session was resumed
      sendResponse({ success: true });
      break;

    case 'SESSION_STOPPED':
      // Session ended
      stopSessionTimer();
      sendResponse({ success: true });
      break;

    case 'GET_ACTIVE_SESSION':
      // Popup requesting current session state
      getActiveSession().then(session => {
        sendResponse({ session: session });
      });
      return true; // Async response

    case 'GET_ELAPSED_TIME':
      // Popup requesting current elapsed time
      getActiveSession().then(session => {
        const elapsed = session ? calculateElapsedTime(session) : 0;
        sendResponse({ elapsed: elapsed });
      });
      return true; // Async response

    case 'PING':
      // Simple ping to check if background is alive
      sendResponse({ pong: true, timestamp: Date.now() });
      break;

    default:
      console.log('[Mocha Background] Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }

  return false; // Sync response (unless we returned true above)
}

// ============================================
// ALARM HANDLER
// ============================================

/**
 * Handles all alarm events
 *
 * @param {Object} alarm - Alarm object with name property
 */
function handleAlarm(alarm) {
  switch (alarm.name) {
    case ALARM_NAME_SESSION_TIMER:
      handleSessionTimerTick();
      break;

    case ALARM_NAME_WEEKLY_RESET:
      handleWeeklyReset();
      break;

    default:
      console.log('[Mocha Background] Unknown alarm:', alarm.name);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Listen for messages from popup
chrome.runtime.onMessage.addListener(handleMessage);

// Listen for alarm events
chrome.alarms.onAlarm.addListener(handleAlarm);

// Listen for idle state changes
chrome.idle.onStateChanged.addListener(handleIdleStateChange);

// Listen for notification clicks
chrome.notifications.onClicked.addListener(handleNotificationClick);

// Listen for extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Mocha Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First time install - could show onboarding
    console.log('[Mocha Background] First time install');
  } else if (details.reason === 'update') {
    // Extension was updated
    console.log('[Mocha Background] Updated from version', details.previousVersion);
  }

  // Initialize regardless
  initialize();
});

// Listen for service worker startup
// This is called when the service worker wakes up
chrome.runtime.onStartup.addListener(() => {
  console.log('[Mocha Background] Service worker started (browser startup)');
  initialize();
});

// Initialize on script load
// This handles the case where the service worker is loaded for the first time
initialize();

// ============================================
// EXPORTED FOR TESTING (if needed)
// ============================================

// In service workers, we can't easily export, but we can expose on globalThis
// globalThis.mochaBackground = { calculateElapsedTime, handleSessionTimerTick };
