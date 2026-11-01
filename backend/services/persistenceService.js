const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Check if file persistence is disabled (for production deployment using MongoDB exclusively)
const isFilePersistenceDisabled = () => {
  if (process.env.NODE_ENV === 'production') return true;
  if (process.env.DISABLE_FILE_PERSISTENCE === 'true') return true;
  return false;
};

// Ensure data directory exists if local file mode is active
if (!isFilePersistenceDisabled() && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Save all products from MongoDB to local JSON persistence file
 */
const saveProductsToFile = async () => {
  if (isFilePersistenceDisabled()) return;
  try {
    const Product = require('../models/Product');
    const products = await Product.find().lean();
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
    console.log(`[Persistence] Saved ${products.length} products to products.json`);
  } catch (err) {
    console.error('[Persistence] Error saving products to file:', err.message);
  }
};

/**
 * Load products from local JSON persistence file
 */
const loadProductsFromFile = async () => {
  if (isFilePersistenceDisabled()) return null;
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) return null;
    const fileData = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    const products = JSON.parse(fileData);
    if (Array.isArray(products) && products.length > 0) {
      return products;
    }
  } catch (err) {
    console.error('[Persistence] Error loading products from file:', err.message);
  }
  return null;
};

/**
 * Save all users from MongoDB to local JSON persistence file
 */
const saveUsersToFile = async () => {
  if (isFilePersistenceDisabled()) return;
  try {
    const User = require('../models/User');
    const users = await User.find().lean();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    console.log(`[Persistence] Saved ${users.length} users to users.json`);
  } catch (err) {
    console.error('[Persistence] Error saving users to file:', err.message);
  }
};

/**
 * Load users from local JSON persistence file
 */
const loadUsersFromFile = async () => {
  if (isFilePersistenceDisabled()) return null;
  try {
    if (!fs.existsSync(USERS_FILE)) return null;
    const fileData = fs.readFileSync(USERS_FILE, 'utf-8');
    const users = JSON.parse(fileData);
    if (Array.isArray(users) && users.length > 0) {
      return users;
    }
  } catch (err) {
    console.error('[Persistence] Error loading users from file:', err.message);
  }
  return null;
};

/**
 * Save site settings to local JSON file
 */
const saveSettingsToFile = async () => {
  if (isFilePersistenceDisabled()) return;
  try {
    const SiteSettings = require('../models/SiteSettings');
    const settings = await SiteSettings.findOne().lean();
    if (settings) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
      console.log(`[Persistence] Saved site settings to settings.json`);
    }
  } catch (err) {
    console.error('[Persistence] Error saving settings to file:', err.message);
  }
};

/**
 * Load site settings from local JSON file
 */
const loadSettingsFromFile = async () => {
  if (isFilePersistenceDisabled()) return null;
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return null;
    const fileData = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(fileData);
  } catch (err) {
    console.error('[Persistence] Error loading settings from file:', err.message);
  }
  return null;
};

const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

/**
 * Save all reviews from memory/file to local JSON file
 */
const saveReviewsToFile = async (reviewsArray) => {
  if (isFilePersistenceDisabled()) return;
  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviewsArray, null, 2), 'utf-8');
    console.log(`[Persistence] Saved ${reviewsArray.length} reviews to reviews.json`);
  } catch (err) {
    console.error('[Persistence] Error saving reviews to file:', err.message);
  }
};

/**
 * Load reviews from local JSON persistence file
 */
const loadReviewsFromFile = async () => {
  if (isFilePersistenceDisabled()) return [];
  try {
    if (!fs.existsSync(REVIEWS_FILE)) return [];
    const fileData = fs.readFileSync(REVIEWS_FILE, 'utf-8');
    const reviews = JSON.parse(fileData);
    if (Array.isArray(reviews)) {
      return reviews;
    }
  } catch (err) {
    console.error('[Persistence] Error loading reviews from file:', err.message);
  }
  return [];
};

module.exports = {
  saveProductsToFile,
  loadProductsFromFile,
  saveUsersToFile,
  loadUsersFromFile,
  saveSettingsToFile,
  loadSettingsFromFile,
  saveReviewsToFile,
  loadReviewsFromFile
};

