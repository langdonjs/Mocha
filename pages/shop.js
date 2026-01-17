/**
 * Shop Page JavaScript
 *
 * This page allows users to:
 * - Browse items by category
 * - Purchase items with points
 * - Equip owned items
 * - Preview character with different items
 */

import {
  getCharacter,
  saveCharacter,
  getGamification,
  updatePoints
} from '../utils/storage.js';

import { SHOP_ITEMS, BEAR_SPECIES } from '../utils/constants.js';

// ============================================
// STATE
// ============================================

let character = null;
let gamification = null;
let currentCategory = 'outfits';
let selectedItem = null;

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  console.log('[Shop] Initializing...');

  try {
    // Load data
    [character, gamification] = await Promise.all([
      getCharacter(),
      getGamification()
    ]);

    // Set up event listeners
    setupEventListeners();

    // Render the page
    renderCharacterPreview();
    renderPoints();
    renderShopGrid();

    console.log('[Shop] Initialization complete');
  } catch (error) {
    console.error('[Shop] Error initializing:', error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Back to popup button
  const backBtn = document.getElementById('back-to-popup');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      chrome.action.openPopup();
      window.close();
    });
  }

  // Category tabs
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentCategory = tab.dataset.category;
      updateCategoryTabs();
      renderShopGrid();
    });
  });

  // Purchase modal
  document.getElementById('close-modal').addEventListener('click', closePurchaseModal);
  document.getElementById('cancel-purchase').addEventListener('click', closePurchaseModal);
  document.getElementById('confirm-purchase').addEventListener('click', handlePurchase);

  // Equip modal
  document.getElementById('close-equip-modal').addEventListener('click', closeEquipModal);
  document.getElementById('cancel-equip').addEventListener('click', closeEquipModal);
  document.getElementById('confirm-equip').addEventListener('click', handleEquip);
  document.getElementById('unequip-btn').addEventListener('click', handleUnequip);

  // Close modals on overlay click
  document.getElementById('purchase-modal').addEventListener('click', (e) => {
    if (e.target.id === 'purchase-modal') closePurchaseModal();
  });
  document.getElementById('equip-modal').addEventListener('click', (e) => {
    if (e.target.id === 'equip-modal') closeEquipModal();
  });
}

// ============================================
// RENDERING
// ============================================

function renderCharacterPreview() {
  if (!character) return;

  // Get species emoji
  const species = BEAR_SPECIES.find(s => s.id === character.species);
  const emoji = species ? species.emoji : '🐻';

  document.querySelector('.character-emoji').textContent = emoji;
  document.getElementById('character-name').textContent = character.name;

  // Show equipped items
  const equipped = [];
  if (character.customization.outfit) {
    const outfit = findItem('outfits', character.customization.outfit);
    if (outfit) equipped.push(outfit.name);
  }
  if (character.customization.accessories.length > 0) {
    equipped.push(`${character.customization.accessories.length} accessory`);
  }
  if (character.customization.background) {
    const bg = findItem('backgrounds', character.customization.background);
    if (bg) equipped.push(bg.name);
  }

  document.getElementById('character-equipped').textContent =
    equipped.length > 0 ? `Equipped: ${equipped.join(', ')}` : 'No items equipped';
}

function renderPoints() {
  const points = gamification?.totalPoints || 0;
  document.getElementById('user-points').textContent = points.toLocaleString();
}

function updateCategoryTabs() {
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === currentCategory);
  });
}

function renderShopGrid() {
  const container = document.getElementById('shop-grid');
  const emptyState = document.getElementById('empty-shop-state');

  const items = SHOP_ITEMS[currentCategory] || [];

  if (items.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = '';

  items.forEach(item => {
    const isOwned = checkIfOwned(currentCategory, item.id);
    const isEquipped = checkIfEquipped(currentCategory, item.id);
    const canAfford = (gamification?.totalPoints || 0) >= item.price;

    const itemEl = document.createElement('div');
    itemEl.className = `shop-item ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}`;
    itemEl.dataset.itemId = item.id;

    // Determine price display
    let priceClass = '';
    let priceText = `🏆 ${item.price}`;

    if (item.price === 0) {
      priceClass = 'free';
      priceText = 'Free';
    } else if (isOwned) {
      priceText = 'Owned';
    } else if (!canAfford) {
      priceClass = 'cant-afford';
    }

    // Badge
    let badgeHtml = '';
    if (isEquipped) {
      badgeHtml = '<span class="shop-item-badge equipped-badge">Equipped</span>';
    } else if (isOwned) {
      badgeHtml = '<span class="shop-item-badge owned-badge">Owned</span>';
    }

    itemEl.innerHTML = `
      ${badgeHtml}
      <span class="shop-item-icon">${getItemIcon(currentCategory, item.id)}</span>
      <div class="shop-item-name">${item.name}</div>
      <div class="shop-item-description">${item.description}</div>
      <div class="shop-item-price ${priceClass}">${priceText}</div>
    `;

    itemEl.addEventListener('click', () => handleItemClick(currentCategory, item));
    container.appendChild(itemEl);
  });
}

// ============================================
// ITEM HELPERS
// ============================================

function findItem(category, itemId) {
  return SHOP_ITEMS[category]?.find(i => i.id === itemId);
}

function getItemIcon(category, itemId) {
  // Return emoji based on category and item
  const icons = {
    outfits: {
      outfit_default: '🐻',
      outfit_hoodie_blue: '🔵',
      outfit_hoodie_green: '🟢',
      outfit_sweater: '🧶',
      outfit_graduation: '🎓',
      outfit_pajamas: '😴'
    },
    accessories: {
      acc_glasses: '👓',
      acc_headphones: '🎧',
      acc_coffee: '☕',
      acc_pencil: '✏️',
      acc_scarf: '🧣',
      acc_bowtie: '🎀'
    },
    decorations: {
      deco_plant: '🪴',
      deco_books: '📚',
      deco_lamp: '💡',
      deco_poster: '🖼️',
      deco_rug: '🟫',
      deco_shelf: '📦'
    },
    backgrounds: {
      bg_default: '🏠',
      bg_library: '📖',
      bg_cafe: '☕',
      bg_window: '🌧️',
      bg_garden: '🌳',
      bg_night: '🌙'
    }
  };

  return icons[category]?.[itemId] || '📦';
}

function checkIfOwned(category, itemId) {
  if (!character) return false;

  // Default items are always owned
  if (itemId.includes('_default')) return true;

  const inventory = character.inventory;
  switch (category) {
    case 'outfits':
      return inventory.outfits.includes(itemId);
    case 'accessories':
      return inventory.accessories.includes(itemId);
    case 'decorations':
      return inventory.decorations.includes(itemId);
    case 'backgrounds':
      return inventory.backgrounds.includes(itemId);
    default:
      return false;
  }
}

function checkIfEquipped(category, itemId) {
  if (!character) return false;

  const customization = character.customization;
  switch (category) {
    case 'outfits':
      return customization.outfit === itemId || (itemId === 'outfit_default' && !customization.outfit);
    case 'accessories':
      return customization.accessories.includes(itemId);
    case 'backgrounds':
      return customization.background === itemId || (itemId === 'bg_default' && !customization.background);
    default:
      return false;
  }
}

// ============================================
// ITEM CLICK HANDLER
// ============================================

function handleItemClick(category, item) {
  selectedItem = { category, item };

  const isOwned = checkIfOwned(category, item.id);

  if (isOwned) {
    openEquipModal(category, item);
  } else {
    openPurchaseModal(category, item);
  }
}

// ============================================
// PURCHASE MODAL
// ============================================

function openPurchaseModal(category, item) {
  const modal = document.getElementById('purchase-modal');
  const canAfford = (gamification?.totalPoints || 0) >= item.price;

  document.getElementById('modal-title').textContent = 'Purchase Item';
  document.getElementById('item-preview').innerHTML = `<span class="item-preview-icon">${getItemIcon(category, item.id)}</span>`;
  document.getElementById('item-preview-name').textContent = item.name;
  document.getElementById('item-preview-description').textContent = item.description;
  document.getElementById('item-price').textContent = `${item.price} pts`;

  const balanceEl = document.getElementById('user-balance');
  balanceEl.textContent = `${gamification?.totalPoints || 0} pts`;
  balanceEl.classList.toggle('insufficient', !canAfford);

  const messageEl = document.getElementById('purchase-message');
  const confirmBtn = document.getElementById('confirm-purchase');

  if (!canAfford) {
    messageEl.textContent = `You need ${item.price - (gamification?.totalPoints || 0)} more points`;
    messageEl.className = 'purchase-message error';
    confirmBtn.disabled = true;
  } else {
    messageEl.textContent = '';
    messageEl.className = 'purchase-message';
    confirmBtn.disabled = false;
  }

  modal.classList.remove('hidden');
}

function closePurchaseModal() {
  document.getElementById('purchase-modal').classList.add('hidden');
  selectedItem = null;
}

async function handlePurchase() {
  if (!selectedItem) return;

  const { category, item } = selectedItem;

  // Deduct points
  await updatePoints(-item.price);

  // Add to inventory
  if (!character.inventory[category]) {
    character.inventory[category] = [];
  }
  character.inventory[category].push(item.id);
  await saveCharacter(character);

  // Reload gamification
  gamification = await getGamification();

  // Update UI
  renderPoints();
  renderShopGrid();
  closePurchaseModal();

  // Show success
  alert(`You purchased ${item.name}!`);
}

// ============================================
// EQUIP MODAL
// ============================================

function openEquipModal(category, item) {
  const modal = document.getElementById('equip-modal');
  const isEquipped = checkIfEquipped(category, item.id);

  document.getElementById('equip-item-preview').innerHTML = `<span class="item-preview-icon">${getItemIcon(category, item.id)}</span>`;
  document.getElementById('equip-item-name').textContent = item.name;
  document.getElementById('equip-item-description').textContent = isEquipped
    ? 'This item is currently equipped.'
    : 'Equip this item to customize your bear!';

  const equipBtn = document.getElementById('confirm-equip');
  const unequipBtn = document.getElementById('unequip-btn');

  if (isEquipped) {
    equipBtn.classList.add('hidden');
    // Only show unequip for non-default items
    if (!item.id.includes('_default')) {
      unequipBtn.classList.remove('hidden');
    } else {
      unequipBtn.classList.add('hidden');
    }
  } else {
    equipBtn.classList.remove('hidden');
    unequipBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function closeEquipModal() {
  document.getElementById('equip-modal').classList.add('hidden');
  selectedItem = null;
}

async function handleEquip() {
  if (!selectedItem) return;

  const { category, item } = selectedItem;

  // Update customization based on category
  switch (category) {
    case 'outfits':
      character.customization.outfit = item.id === 'outfit_default' ? null : item.id;
      break;
    case 'accessories':
      if (!character.customization.accessories.includes(item.id)) {
        character.customization.accessories.push(item.id);
      }
      break;
    case 'backgrounds':
      character.customization.background = item.id === 'bg_default' ? null : item.id;
      break;
  }

  await saveCharacter(character);

  renderCharacterPreview();
  renderShopGrid();
  closeEquipModal();
}

async function handleUnequip() {
  if (!selectedItem) return;

  const { category, item } = selectedItem;

  switch (category) {
    case 'outfits':
      character.customization.outfit = null;
      break;
    case 'accessories':
      character.customization.accessories = character.customization.accessories.filter(
        id => id !== item.id
      );
      break;
    case 'backgrounds':
      character.customization.background = null;
      break;
  }

  await saveCharacter(character);

  renderCharacterPreview();
  renderShopGrid();
  closeEquipModal();
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', init);
