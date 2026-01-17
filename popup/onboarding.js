/**
 * Onboarding Flow for Mocha Study Tracker
 *
 * This script handles the 3-step onboarding wizard:
 * 1. Welcome screen - introduces the app
 * 2. Choose your bear - select species
 * 3. Name your bear - give it a name
 *
 * After completion, creates a Character and redirects to main popup.
 */

import { saveCharacter, initializeStorage } from '../utils/storage.js';
import { createCharacter } from '../models/data-models.js';
import { BEAR_SPECIES } from '../utils/constants.js';

// ============================================
// STATE
// ============================================

let currentStep = 1;
let selectedSpecies = 'brown';
let bearName = '';

// ============================================
// INITIALIZATION
// ============================================

function init() {
  console.log('[Mocha Onboarding] Initializing...');

  setupEventListeners();
  updateStepIndicator();
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Step 1: Start button
  document.getElementById('start-btn').addEventListener('click', () => {
    goToStep(2);
  });

  // Step 2: Bear selection
  document.querySelectorAll('.bear-option').forEach(option => {
    option.addEventListener('click', () => {
      selectBear(option.dataset.species);
    });
  });

  document.getElementById('back-to-1').addEventListener('click', () => {
    goToStep(1);
  });

  document.getElementById('to-step-3').addEventListener('click', () => {
    goToStep(3);
  });

  // Step 3: Name input
  const nameInput = document.getElementById('bear-name-input');
  nameInput.addEventListener('input', (e) => {
    updateName(e.target.value);
  });

  // Name suggestions
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const name = chip.dataset.name;
      nameInput.value = name;
      updateName(name);
    });
  });

  document.getElementById('back-to-2').addEventListener('click', () => {
    goToStep(2);
  });

  document.getElementById('finish-btn').addEventListener('click', () => {
    finishOnboarding();
  });

  // Allow Enter key to submit on name input
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && bearName.length > 0) {
      finishOnboarding();
    }
  });
}

// ============================================
// NAVIGATION
// ============================================

function goToStep(step) {
  // Hide all steps
  document.querySelectorAll('.onboarding-step').forEach(el => {
    el.classList.add('hidden');
  });

  // Show target step
  document.getElementById(`step-${step}`).classList.remove('hidden');

  // Update state
  currentStep = step;
  updateStepIndicator();

  // Focus name input on step 3
  if (step === 3) {
    updateSelectedBearDisplay();
    document.getElementById('bear-name-input').focus();
  }
}

function updateStepIndicator() {
  document.querySelectorAll('.step').forEach(el => {
    const stepNum = parseInt(el.dataset.step);
    el.classList.remove('active', 'completed');

    if (stepNum === currentStep) {
      el.classList.add('active');
    } else if (stepNum < currentStep) {
      el.classList.add('completed');
    }
  });
}

// ============================================
// BEAR SELECTION
// ============================================

function selectBear(species) {
  selectedSpecies = species;

  // Update UI
  document.querySelectorAll('.bear-option').forEach(option => {
    option.classList.remove('selected');
    if (option.dataset.species === species) {
      option.classList.add('selected');
    }
  });
}

function updateSelectedBearDisplay() {
  const species = BEAR_SPECIES.find(s => s.id === selectedSpecies);
  const emoji = species ? species.emoji : '🐻';

  document.getElementById('selected-bear-display').innerHTML = `
    <span class="selected-bear-emoji">${emoji}</span>
  `;
}

// ============================================
// NAME INPUT
// ============================================

function updateName(name) {
  bearName = name.trim();

  // Update character count
  document.getElementById('char-count').textContent = name.length;

  // Enable/disable finish button
  const finishBtn = document.getElementById('finish-btn');
  finishBtn.disabled = bearName.length === 0;
}

// ============================================
// FINISH ONBOARDING
// ============================================

async function finishOnboarding() {
  if (bearName.length === 0) return;

  // Show loading state
  document.querySelectorAll('.onboarding-step').forEach(el => {
    el.classList.add('hidden');
  });
  document.getElementById('loading-step').classList.remove('hidden');

  try {
    // Initialize storage with defaults
    await initializeStorage();

    // Create and save character
    const character = createCharacter(bearName, selectedSpecies);
    await saveCharacter(character);

    console.log('[Mocha Onboarding] Character created:', character);

    // Short delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Redirect to main popup
    window.location.href = 'popup.html';
  } catch (error) {
    console.error('[Mocha Onboarding] Error creating character:', error);
    alert('Something went wrong. Please try again.');
    goToStep(3);
  }
}

// ============================================
// INITIALIZE ON LOAD
// ============================================

document.addEventListener('DOMContentLoaded', init);
