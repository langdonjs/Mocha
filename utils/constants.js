/**
 * Constants for Mocha Study Tracker
 *
 * This file contains all the constant values used throughout the app.
 * Keeping them in one place makes it easy to update and ensures consistency.
 *
 * Think of this like Python's constants file - values that don't change at runtime.
 */

// ============================================
// CATEGORIES - Types of goals
// ============================================

/**
 * Available goal categories
 * These help users organize their goals and provide smart defaults
 */
export const GOAL_CATEGORIES = [
  { id: 'class', label: 'Class', icon: '📚', defaultTaskUnit: 'assignments' },
  { id: 'coding', label: 'Coding', icon: '💻', defaultTaskUnit: 'problems' },
  { id: 'work', label: 'Work', icon: '💼', defaultTaskUnit: 'tasks' },
  { id: 'personal', label: 'Personal', icon: '🎯', defaultTaskUnit: 'tasks' },
  { id: 'other', label: 'Other', icon: '📝', defaultTaskUnit: 'items' }
];

// ============================================
// DIFFICULTY - Task difficulty levels
// ============================================

/**
 * Task difficulty options
 * Used for points calculation - harder tasks give bonus points
 */
export const TASK_DIFFICULTIES = [
  { id: 'easy', label: 'Easy', points: 5 },
  { id: 'medium', label: 'Medium', points: 10 },
  { id: 'hard', label: 'Hard', points: 15 }
];

// ============================================
// BEAR SPECIES - Character options
// ============================================

/**
 * Available bear species for character creation
 * Each has a unique appearance that will be rendered with CSS/SVG
 */
export const BEAR_SPECIES = [
  { id: 'brown', label: 'Brown Bear', color: '#8B4513', emoji: '🐻' },
  { id: 'black', label: 'Black Bear', color: '#2F2F2F', emoji: '🐻' },
  { id: 'polar', label: 'Polar Bear', color: '#F5F5F5', emoji: '🐻‍❄️' },
  { id: 'panda', label: 'Panda', color: '#FFFFFF', emoji: '🐼' },
  { id: 'grizzly', label: 'Grizzly Bear', color: '#654321', emoji: '🐻' }
];

// ============================================
// COLORS - Preset colors for goals
// ============================================

/**
 * Default color palette for goals
 * Cozy, warm colors matching the lofi aesthetic
 * These are ordered to look good when displayed together
 */
export const DEFAULT_COLORS = [
  '#4A90A4', // Soft blue - calm, studious
  '#6B8E6B', // Sage green - natural, relaxing
  '#D4A574', // Warm tan - cozy, coffee-like
  '#B87333', // Copper - warm, inviting
  '#8E7CC3', // Soft purple - creative, calm
  '#C97B84', // Dusty rose - gentle, warm
  '#7BA3A8', // Teal - focused, refreshing
  '#A67C52', // Mocha brown - on-brand!
  '#6B5B73', // Plum - sophisticated, calm
  '#9CAF88'  // Moss green - natural, grounding
];

// ============================================
// EMOJIS - Quick-pick icons for goals
// ============================================

/**
 * Common emojis for goal icons
 * Organized by category for easy selection
 */
export const DEFAULT_EMOJIS = {
  // Academic
  academic: ['📚', '📖', '📘', '📗', '📙', '📕', '📓', '📒', '✏️', '🎓'],
  // Coding
  coding: ['💻', '🖥️', '⌨️', '🔧', '🛠️', '🐛', '🧩', '📱', '🌐', '🔌'],
  // Work
  work: ['💼', '📊', '📈', '📉', '🗂️', '📁', '📋', '✅', '📝', '🗃️'],
  // Personal
  personal: ['🎯', '🏃', '🧘', '💪', '🎨', '🎸', '📷', '✨', '🌟', '💡'],
  // General
  general: ['🔥', '⚡', '🚀', '💎', '🎪', '🎲', '🧠', '❤️', '🌈', '☕']
};

/**
 * Flat array of all emojis for simple iteration
 */
export const ALL_EMOJIS = Object.values(DEFAULT_EMOJIS).flat();

// ============================================
// TASK UNITS - What to call tasks
// ============================================

/**
 * Common task unit options
 * Users can also enter custom units
 */
export const TASK_UNITS = [
  'assignments',
  'problems',
  'tasks',
  'chapters',
  'projects',
  'exercises',
  'modules',
  'lectures',
  'readings',
  'sections'
];

// ============================================
// SHOP ITEMS - Purchasable items
// ============================================

/**
 * Shop items organized by category
 * Each item has an id, name, description, price, and image reference
 *
 * Note: We'll add more items later. Starting with a small collection.
 */
export const SHOP_ITEMS = {
  outfits: [
    { id: 'outfit_default', name: 'Default', description: 'Your bear\'s natural look', price: 0, owned: true },
    { id: 'outfit_hoodie_blue', name: 'Blue Hoodie', description: 'Cozy study vibes', price: 50 },
    { id: 'outfit_hoodie_green', name: 'Green Hoodie', description: 'Forest explorer', price: 50 },
    { id: 'outfit_sweater', name: 'Knit Sweater', description: 'Warm and fuzzy', price: 75 },
    { id: 'outfit_graduation', name: 'Graduation Cap & Gown', description: 'Scholar bear!', price: 200 },
    { id: 'outfit_pajamas', name: 'Pajamas', description: 'Late night study sessions', price: 100 }
  ],
  accessories: [
    { id: 'acc_glasses', name: 'Reading Glasses', description: 'Smart bear look', price: 30 },
    { id: 'acc_headphones', name: 'Headphones', description: 'Lofi beats to study to', price: 45 },
    { id: 'acc_coffee', name: 'Coffee Mug', description: 'Essential fuel', price: 25 },
    { id: 'acc_pencil', name: 'Pencil Behind Ear', description: 'Always ready to write', price: 20 },
    { id: 'acc_scarf', name: 'Cozy Scarf', description: 'Library aesthetic', price: 35 },
    { id: 'acc_bowtie', name: 'Bow Tie', description: 'Distinguished scholar', price: 40 }
  ],
  decorations: [
    { id: 'deco_plant', name: 'Potted Plant', description: 'Add some green', price: 30 },
    { id: 'deco_books', name: 'Stack of Books', description: 'Knowledge display', price: 40 },
    { id: 'deco_lamp', name: 'Desk Lamp', description: 'Warm lighting', price: 50 },
    { id: 'deco_poster', name: 'Motivational Poster', description: 'You can do it!', price: 35 },
    { id: 'deco_rug', name: 'Cozy Rug', description: 'Soft and warm', price: 60 },
    { id: 'deco_shelf', name: 'Floating Shelf', description: 'Display treasures', price: 45 }
  ],
  backgrounds: [
    { id: 'bg_default', name: 'Cozy Room', description: 'Your bear\'s home', price: 0, owned: true },
    { id: 'bg_library', name: 'Library', description: 'Surrounded by books', price: 100 },
    { id: 'bg_cafe', name: 'Coffee Shop', description: 'Cafe study session', price: 100 },
    { id: 'bg_window', name: 'Window Seat', description: 'Rainy day vibes', price: 125 },
    { id: 'bg_garden', name: 'Garden', description: 'Nature study spot', price: 125 },
    { id: 'bg_night', name: 'Night Sky', description: 'Late night mode', price: 150 }
  ]
};

// ============================================
// UI CONSTANTS
// ============================================

/**
 * Popup dimensions (Chrome extension popup)
 */
export const POPUP_WIDTH = 400;
export const POPUP_HEIGHT = 600;

/**
 * Animation durations in milliseconds
 */
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500
};

/**
 * Storage keys - used to access chrome.storage
 * Centralized here to avoid typos
 */
export const STORAGE_KEYS = {
  character: 'mocha_character',
  goals: 'mocha_goals',
  tasks: 'mocha_tasks',
  sessions: 'mocha_sessions',
  activeSession: 'mocha_active_session',
  gamification: 'mocha_gamification',
  weeklyProgress: 'mocha_weekly_progress',
  settings: 'mocha_settings'
};

// ============================================
// TIME CONSTANTS
// ============================================

/**
 * Time-related constants
 */
export const TIME = {
  secondsPerMinute: 60,
  minutesPerHour: 60,
  hoursPerDay: 24,
  daysPerWeek: 7,
  secondsPerHour: 3600,
  millisecondsPerSecond: 1000
};

/**
 * Days of the week (for week start calculation)
 * JavaScript's getDay() returns 0 for Sunday, 1 for Monday, etc.
 */
export const DAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};
