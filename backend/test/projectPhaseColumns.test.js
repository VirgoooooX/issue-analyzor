const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

function createTempDbPath() {
  const fileName = `issue-analyzor-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  return path.join(os.tmpdir(), fileName);
}

test('projects 表包含 project_key 与 phase 字段', async () => {
  const dbPath = createTempDbPath();
  process.env.DATABASE_PATH = dbPath;
  process.env.AUTH_ENABLED = 'true';
  process.env.AUTH_TOKEN_SECRET = 'test-secret';

  const { initDatabase, closeDatabase, getDatabase } = require('../src/models/database');

  await initDatabase();
  const db = getDatabase();
  const columns = db.prepare('PRAGMA table_info(projects)').all();
  const hasProjectKey = columns.some((c) => c.name === 'project_key');
  const hasPhase = columns.some((c) => c.name === 'phase');
  const hasLastIssueDate = columns.some((c) => c.name === 'last_issue_date');
  await closeDatabase();
  await fs.rm(dbPath, { force: true });

  assert.equal(hasProjectKey, true);
  assert.equal(hasPhase, true);
  assert.equal(hasLastIssueDate, true);
});
