const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

function createTempDbPath() {
  const fileName = `issue-analyzor-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  return path.join(os.tmpdir(), fileName);
}

test('users 表包含 role 字段', async () => {
  const dbPath = createTempDbPath();
  process.env.DATABASE_PATH = dbPath;
  process.env.AUTH_ENABLED = 'true';
  process.env.AUTH_USERNAME = 'admin';
  process.env.AUTH_PASSWORD = 'password123';
  process.env.AUTH_TOKEN_SECRET = 'test-secret';

  const { initDatabase, closeDatabase, getDatabase } = require('../src/models/database');

  await initDatabase();
  const db = getDatabase();
  const columns = db.prepare('PRAGMA table_info(users)').all();
  const hasRole = columns.some((c) => c.name === 'role');
  await closeDatabase();
  await fs.rm(dbPath, { force: true });

  assert.equal(hasRole, true);
});

test('/api/auth/verify 返回 role', async () => {
  const dbPath = createTempDbPath();
  process.env.DATABASE_PATH = dbPath;
  process.env.AUTH_ENABLED = 'true';
  process.env.AUTH_USERNAME = 'admin';
  process.env.AUTH_PASSWORD = 'password123';
  process.env.AUTH_TOKEN_SECRET = 'test-secret';

  const { initDatabase, closeDatabase, getDatabase } = require('../src/models/database');
  const authController = require('../src/controllers/authController');

  await initDatabase();
  const db = getDatabase();
  const insert = db
    .prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
    .run('admin', 'salt:hash', 'admin');
  const userId = insert.lastInsertRowid;

  const req = { user: { id: userId, username: 'admin' } };
  let statusCode = 200;
  let body;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return payload;
    },
  };

  await authController.verify(req, res, () => {});

  assert.equal(statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.role, 'admin');
  await closeDatabase();
  await fs.rm(dbPath, { force: true });
});
