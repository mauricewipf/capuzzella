#!/usr/bin/env bun

/**
 * Script to create a new user in the Capuzzella database
 * 
 * Usage: bun run scripts/create-user.js <username> <password>
 */

import { getDb, closeDb } from '../src/db/index.js';
import { createUser, usernameExists } from '../src/services/auth.js';

async function main() {
  const [,, username, password] = process.argv;
  
  if (!username || !password) {
    console.error('Usage: bun run scripts/create-user.js <username> <password>');
    process.exit(1);
  }
  
  if (password.length < 6) {
    console.error('Error: Password must be at least 6 characters');
    process.exit(1);
  }
  
  try {
    // Initialize database connection
    getDb();
    
    // Check if username already exists
    if (usernameExists(username)) {
      console.error(`Error: Username "${username}" already exists`);
      process.exit(1);
    }
    
    // Create the user
    const user = await createUser(username, password);
    
    console.log(`✓ User created successfully!`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    
  } catch (error) {
    console.error('Error creating user:', error.message);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
