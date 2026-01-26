import bcrypt from 'bcrypt';
import { getDb } from '../db/index.js';

const SALT_ROUNDS = 10;

/**
 * Authenticate a user with username and password
 * 
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{id: number, username: string} | null>}
 */
export async function authenticateUser(username, password) {
  const db = getDb();
  
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username);
  
  if (!user) {
    return null;
  }
  
  const isValid = await bcrypt.compare(password, user.password_hash);
  
  if (!isValid) {
    return null;
  }
  
  return {
    id: user.id,
    username: user.username
  };
}

/**
 * Create a new user
 * 
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{id: number, username: string}>}
 */
export async function createUser(username, password) {
  const db = getDb();
  
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
  
  return {
    id: result.lastInsertRowid,
    username
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
  
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
  
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
  
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  
  return !!user;
}
