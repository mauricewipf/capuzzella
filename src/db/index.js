import { Database } from 'bun:sqlite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SALT_ROUNDS = 10;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/capuzzella.db');

let db = null;

/**
 * Get or create database connection
 * @returns {Database}
 */
export function getDb() {
  if (!db) {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);

    // Enable foreign keys
    db.exec('PRAGMA foreign_keys = ON');

    // Initialize schema
    initializeSchema();

    // Seed default admin user if no users exist
    seedDefaultUser();
  }

  return db;
}

/**
 * Initialize database schema
 */
function initializeSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  db.exec(schema);
}

/**
 * Seed default admin user if no users exist
 */
async function seedDefaultUser() {
  const userCount = db.query('SELECT COUNT(*) as count FROM users').get();

  if (userCount.count === 0) {
    const username = 'admin';
    const password = crypto.randomBytes(12).toString('base64').slice(0, 16);
    const passwordHash = await Bun.password.hash(password, {
      algorithm: 'bcrypt',
      cost: SALT_ROUNDS
    });

    // Set must_change_password = 1 for generated passwords
    db.query('INSERT INTO users (username, password_hash, must_change_password) VALUES (?, ?, 1)').run(username, passwordHash);

    console.log('');
    console.log('='.repeat(50));
    console.log('Default admin user created!');
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log('  (You will be prompted to change this password on first login)');
    console.log('='.repeat(50));
    console.log('');
  }
}

/**
 * Close database connection
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
