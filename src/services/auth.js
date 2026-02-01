import { getDb } from '../db/index.js';

const SALT_ROUNDS = 10;

/**
 * Authenticate a user with username and password
 * 
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{id: number, username: string, mustChangePassword: boolean} | null>}
 */
export async function authenticateUser(username, password) {
  const db = getDb();

  const user = db.query('SELECT id, username, password_hash, must_change_password FROM users WHERE username = ?').get(username);

  if (!user) {
    return null;
  }

  const isValid = await Bun.password.verify(password, user.password_hash);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    mustChangePassword: !!user.must_change_password
  };
}

/**
 * Create a new user
 * 
 * @param {string} username
 * @param {string} password
 * @param {boolean} mustChangePassword - Set to true if password is generated
 * @returns {Promise<{id: number, username: string, mustChangePassword: boolean}>}
 */
export async function createUser(username, password, mustChangePassword = false) {
  const db = getDb();

  const passwordHash = await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: SALT_ROUNDS
  });

  const stmt = db.query('INSERT INTO users (username, password_hash, must_change_password) VALUES (?, ?, ?)');
  stmt.run(username, passwordHash, mustChangePassword ? 1 : 0);

  // Get the last inserted row ID
  const lastRow = db.query('SELECT last_insert_rowid() as id').get();

  return {
    id: lastRow.id,
    username,
    mustChangePassword
  };
}

/**
 * Get a user by ID
 * 
 * @param {number} id
 * @returns {{id: number, username: string} | null}
 */
export function getUserById(id) {
  const db = getDb();

  const user = db.query('SELECT id, username FROM users WHERE id = ?').get(id);

  return user || null;
}

/**
 * Check if a username is already taken
 * 
 * @param {string} username
 * @returns {boolean}
 */
export function usernameExists(username) {
  const db = getDb();

  const user = db.query('SELECT id FROM users WHERE username = ?').get(username);

  return !!user;
}

/**
 * Update a user's password
 * 
 * @param {number} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updatePassword(userId, currentPassword, newPassword) {
  const db = getDb();

  const user = db.query('SELECT id, password_hash FROM users WHERE id = ?').get(userId);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const isValid = await Bun.password.verify(currentPassword, user.password_hash);

  if (!isValid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters' };
  }

  const newPasswordHash = await Bun.password.hash(newPassword, {
    algorithm: 'bcrypt',
    cost: SALT_ROUNDS
  });

  // Clear must_change_password flag when user updates their password
  db.query('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newPasswordHash, userId);

  return { success: true };
}
