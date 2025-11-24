const initSqlJs = require('sql.js');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

let db = null;
let SQL = null;
let saveTimer = null; // 防抖定时器
let pendingSave = false; // 是否有待保存的更改

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

    // Run migrations to add missing columns
    await runMigrations();

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
    pendingSave = false;
  } catch (error) {
    console.error('❌ Failed to save database:', error);
    throw error;
  }
}

/**
 * 防抖保存数据库 - 延迟保存以减少文件I/O操作
 * @param {number} delay - 延迟时间（毫秒），默认1000ms
 * @returns {Promise} 返回一个Promise，在延迟后执行保存
 */
function debouncedSaveDatabase(delay = 1000) {
  pendingSave = true;
  
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  
  return new Promise((resolve) => {
    saveTimer = setTimeout(async () => {
      if (pendingSave) {
        await saveDatabase();
      }
      resolve();
    }, delay);
  });
}

/**
 * 立即保存数据库（用于关键操作）
 */
async function forceSaveDatabase() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingSave || db) {
    await saveDatabase();
  }
}

/**
 * Run database migrations to add missing columns
 */
async function runMigrations() {
  try {
    const migrations = [
      // Add sn column if it doesn't exist
      `ALTER TABLE issues ADD COLUMN sn TEXT;`,
      // Add unit_number column if it doesn't exist
      `ALTER TABLE issues ADD COLUMN unit_number TEXT;`,
      // Add failed_cycle_count column if it doesn't exist
      `ALTER TABLE issues ADD COLUMN failed_cycle_count INTEGER;`,
    ];

    for (const migration of migrations) {
      try {
        db.run(migration);
        console.log(`✅ Migration executed: ${migration.substring(0, 50)}...`);
      } catch (error) {
        // Column might already exist, which is fine
        if (error.message && error.message.includes('duplicate column')) {
          console.log(`✅ Column already exists (skipped): ${migration.substring(0, 50)}...`);
        } else {
          console.warn(`⚠️  Migration error: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    // Don't throw - migrations are non-critical
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
          // 使用防抖保存数据库（写操作后延迟保存）
          debouncedSaveDatabase().catch(err => console.error('Failed to save database:', err));
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
      // 使用防抖保存
      return debouncedSaveDatabase();
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
    // 关闭前确保所有更改都已保存
    await forceSaveDatabase();
    db.close();
    db = null;
    console.log('✅ Database connection closed');
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  forceSaveDatabase, // 导出强制保存函数供关键操作使用
};
