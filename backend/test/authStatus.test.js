const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

function createTempDbPath() {
  const fileName = `issue-analyzor-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  return path.join(os.tmpdir(), fileName);
}

function createResCapture() {
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
  return { res, get statusCode() { return statusCode; }, get body() { return body; } };
}

test('users 表包含 status 字段', async () => {
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
  const hasStatus = columns.some((c) => c.name === 'status');
  await closeDatabase();
  await fs.rm(dbPath, { force: true });

  assert.equal(hasStatus, true);
});

test('注册用户默认状态为 pending，且未通过审核不可登录', async () => {
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

  const registerReq = { body: { username: `pending-user-${Date.now()}`, password: 'pw123' } };
  const registerCapture = createResCapture();
  await authController.register(registerReq, registerCapture.res, () => {});

  assert.equal(registerCapture.statusCode, 201);

  const created = db
    .prepare('SELECT username, role, status FROM users WHERE username = ?')
    .get(registerReq.body.username);
  assert.equal(created.role, 'user');
  assert.equal(created.status, 'pending');

  const loginReq = { body: { username: registerReq.body.username, password: registerReq.body.password } };
  const loginCapture = createResCapture();
  await authController.login(loginReq, loginCapture.res, () => {});

  assert.equal(loginCapture.statusCode, 403);
  assert.equal(loginCapture.body.success, false);
  assert.equal(loginCapture.body.error.code, 'ACCOUNT_PENDING');

  await closeDatabase();
  await fs.rm(dbPath, { force: true });
});

test('被拒绝的用户不可登录', async () => {
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

  const username = `reject-user-${Date.now()}`;
  const registerReq = { body: { username, password: 'pw123' } };
  const registerCapture = createResCapture();
  await authController.register(registerReq, registerCapture.res, () => {});
  assert.equal(registerCapture.statusCode, 201);

  db.prepare('UPDATE users SET status = ? WHERE username = ?').run('rejected', username);

  const loginReq = { body: { username, password: registerReq.body.password } };
  const loginCapture = createResCapture();
  await authController.login(loginReq, loginCapture.res, () => {});

  assert.equal(loginCapture.statusCode, 403);
  assert.equal(loginCapture.body.success, false);
  assert.equal(loginCapture.body.error.code, 'ACCOUNT_REJECTED');

  await closeDatabase();
  await fs.rm(dbPath, { force: true });
});

test('verify 对非 active 用户返回 403', async () => {
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
    .prepare('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)')
    .run(`pending-verify-${Date.now()}`, 'salt:hash', 'user', 'pending');

  const req = { user: { id: insert.lastInsertRowid } };
  const capture = createResCapture();
  await authController.verify(req, capture.res, () => {});

  assert.equal(capture.statusCode, 403);
  assert.equal(capture.body.success, false);
  assert.equal(capture.body.error.code, 'ACCOUNT_PENDING');

  await closeDatabase();
  await fs.rm(dbPath, { force: true });
});

