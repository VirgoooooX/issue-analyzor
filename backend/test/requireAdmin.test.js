const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

function createTempDbPath() {
  const fileName = `issue-analyzor-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  return path.join(os.tmpdir(), fileName);
}

function createMockRes() {
  let statusCode = 200;
  let body;
  return {
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return payload;
    },
  };
}

function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

test('非 admin 被 requireAdmin 拒绝', async () => {
  const dbPath = createTempDbPath();
  process.env.DATABASE_PATH = dbPath;
  process.env.AUTH_ENABLED = 'true';
  process.env.AUTH_TOKEN_SECRET = 'test-secret';

  const { initDatabase, closeDatabase, getDatabase } = require('../src/models/database');

  await initDatabase();
  const db = getDatabase();
  const username = uniqueName('user');
  const insert = db
    .prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
    .run(username, 'salt:hash', 'user');

  let requireAdmin;
  try {
    requireAdmin = require('../src/middleware/requireAdmin');
  } catch (e) {
    assert.fail(e);
  }

  const req = { user: { id: insert.lastInsertRowid, username } };
  const res = createMockRes();
  let nextCalled = false;
  await requireAdmin(req, res, () => {
    nextCalled = true;
  });

  await closeDatabase();
  await fs.rm(dbPath, { force: true });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('admin 通过 requireAdmin', async () => {
  const dbPath = createTempDbPath();
  process.env.DATABASE_PATH = dbPath;
  process.env.AUTH_ENABLED = 'true';
  process.env.AUTH_TOKEN_SECRET = 'test-secret';

  const { initDatabase, closeDatabase, getDatabase } = require('../src/models/database');

  await initDatabase();
  const db = getDatabase();
  const username = uniqueName('admin');
  const insert = db
    .prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
    .run(username, 'salt:hash', 'admin');

  let requireAdmin;
  try {
    requireAdmin = require('../src/middleware/requireAdmin');
  } catch (e) {
    assert.fail(e);
  }

  const req = { user: { id: insert.lastInsertRowid, username } };
  const res = createMockRes();
  let nextCalled = false;
  await requireAdmin(req, res, () => {
    nextCalled = true;
  });

  await closeDatabase();
  await fs.rm(dbPath, { force: true });

  assert.equal(nextCalled, true);
});
