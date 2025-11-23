const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

let db = null;

/**
 * Initialize and open database connection
 */
async function initDatabase() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(config.database.path);
    await fs.mkdir(dataDir, { recursive: true });

    // Open database connection (disable verbose logging)
    db = new Database(config.database.path);

    // Set journal mode first (before foreign keys to avoid WAL issues)
    try {
      db.pragma('journal_mode = DELETE');
    } catch (err) {
      console.warn('⚠️  Failed to set journal mode, trying to recover...');
      db.close();
      // Delete WAL files if they exist
      try {
        await fs.unlink(config.database.path + '-shm').catch(() => {});
        await fs.unlink(config.database.path + '-wal').catch(() => {});
      } catch (e) {
        // Ignore
      }
      // Reopen
      db = new Database(config.database.path);
      db.pragma('journal_mode = DELETE');
    }

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    console.log('✅ Database connection established');

    // Run initialization script
    const initScript = await fs.readFile(
      path.join(__dirname, '../../database/init.sql'),
      'utf-8'
    );
    db.exec(initScript);

    console.log('✅ Database tables initialized');

    return db;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('✅ Database connection closed');
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
};
