const initSqlJs = require('sql.js');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

let db = null;
let SQL = null;

/**
 * Initialize and open database connection
 */
async function initDatabase() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(config.database.path);
    await fs.mkdir(dataDir, { recursive: true });

    // Initialize SQL.js
    SQL = await initSqlJs();

    // Check if database file exists
    let dbData;
    try {
      dbData = await fs.readFile(config.database.path);
    } catch (err) {
      // Database doesn't exist, create new one
      dbData = null;
    }

    // Open database connection
    db = new SQL.Database(dbData);

    console.log('✅ Database connection established');

    // Run initialization script
    const initScript = await fs.readFile(
      path.join(__dirname, '../../../database/init.sql'),
      'utf-8'
    );
    db.run(initScript);

    console.log('✅ Database tables initialized');

    // Save database to file
    await saveDatabase();

    return db;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Save database to file
 */
async function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    await fs.writeFile(config.database.path, buffer);
  } catch (error) {
    console.error('❌ Failed to save database:', error);
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
  return {
    db,
    // Wrapper functions to match better-sqlite3 API
    prepare: (sql) => {
      return {
        run: (...params) => {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          stmt.step();
          stmt.free();
          const changes = db.getRowsModified();
          let lastInsertRowid;
          try {
            const result = db.exec('SELECT last_insert_rowid()');
            lastInsertRowid = result[0]?.values[0]?.[0];
          } catch (e) {
            lastInsertRowid = undefined;
          }
          // Save database after each write operation
          saveDatabase().catch(err => console.error('Failed to save database:', err));
          return { changes, lastInsertRowid };
        },
        get: (...params) => {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          const result = stmt.step() ? stmt.getAsObject() : undefined;
          stmt.free();
          return result;
        },
        all: (...params) => {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          const results = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        },
      };
    },
    exec: (sql) => {
      db.run(sql);
      return saveDatabase();
    },
    pragma: (pragma) => {
      try {
        db.run(`PRAGMA ${pragma}`);
      } catch (e) {
        console.warn(`⚠️  PRAGMA ${pragma} not supported in sql.js`);
      }
    },
    close: async () => {
      await closeDatabase();
    },
  };
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (db) {
    await saveDatabase();
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
