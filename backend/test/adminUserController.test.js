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

test('管理员可创建/查询/修改/删除用户（删除级联 saved_filters）', async () => {
  const dbPath = createTempDbPath();
  process.env.DATABASE_PATH = dbPath;
  process.env.AUTH_ENABLED = 'true';
  process.env.AUTH_TOKEN_SECRET = 'test-secret';

  const { initDatabase, closeDatabase, getDatabase } = require('../src/models/database');
  await initDatabase();
  const db = getDatabase();

  const projectInsert = db
    .prepare('INSERT INTO projects (name) VALUES (?)')
    .run(uniqueName('project'));
  const projectId = projectInsert.lastInsertRowid;

  const adminUserInsert = db
    .prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
    .run(uniqueName('admin'), 'salt:hash', 'admin');
  const adminId = adminUserInsert.lastInsertRowid;

  let controller;
  try {
    controller = require('../src/controllers/adminUserController');
  } catch (e) {
    assert.fail(e);
  }

  const username = uniqueName('user');

  {
    const req = { user: { id: adminId }, body: { username, password: 'p@ss', role: 'user' } };
    const res = createMockRes();
    await controller.createUser(req, res, () => {});
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.username, username);
    assert.equal(res.body.data.role, 'user');
    assert.equal(res.body.data.status, 'active');
  }

  const created = db.prepare('SELECT id, role, status FROM users WHERE username = ?').get(username);
  assert.ok(created?.id);
  assert.equal(created.role, 'user');
  assert.equal(created.status, 'active');

  {
    const req = { user: { id: adminId }, query: {} };
    const res = createMockRes();
    await controller.listUsers(req, res, () => {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.users));
    assert.ok(res.body.data.users.some((u) => u.username === username));
    assert.ok(res.body.data.users.every((u) => !('password' in u)));
    assert.ok(res.body.data.users.every((u) => 'status' in u));
  }

  {
    const req = { user: { id: adminId }, params: { id: created.id }, body: { role: 'admin' } };
    const res = createMockRes();
    await controller.updateUser(req, res, () => {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.role, 'admin');
  }

  {
    const pendingUsername = uniqueName('pending');
    const insertPending = db
      .prepare('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)')
      .run(pendingUsername, 'salt:hash', 'user', 'pending');
    const pendingId = insertPending.lastInsertRowid;
    const req = { user: { id: adminId }, params: { id: pendingId }, body: { status: 'active' } };
    const res = createMockRes();
    await controller.updateUser(req, res, () => {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'active');
  }

  db
    .prepare('INSERT INTO saved_filters (user_id, project_id, name, filters) VALUES (?, ?, ?, ?)')
    .run(created.id, projectId, 'f1', JSON.stringify({ wf: ['A'] }));
  const filterCountBefore = db
    .prepare('SELECT COUNT(1) as cnt FROM saved_filters WHERE user_id = ?')
    .get(created.id).cnt;
  assert.equal(filterCountBefore, 1);

  {
    const req = { user: { id: adminId }, params: { id: created.id } };
    const res = createMockRes();
    await controller.deleteUser(req, res, () => {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  }

  const userAfter = db.prepare('SELECT id FROM users WHERE id = ?').get(created.id);
  const filterCountAfter = db
    .prepare('SELECT COUNT(1) as cnt FROM saved_filters WHERE user_id = ?')
    .get(created.id).cnt;
  assert.equal(userAfter, undefined);
  assert.equal(filterCountAfter, 0);

  await closeDatabase();
  await fs.rm(dbPath, { force: true });
});
