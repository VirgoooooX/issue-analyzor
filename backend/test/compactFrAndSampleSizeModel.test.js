const test = require('node:test');
const assert = require('node:assert/strict');

test('getCompactFailureRate 与 getCompactSampleSize 返回最简结构且口径正确', async () => {
  const { initDatabase, closeDatabase, getDatabase } = require('../src/models/database');
  const analysisModel = require('../src/models/analysisModel');

  await initDatabase();
  const db = getDatabase();

  const projectId = 900000000 + Math.round(Math.random() * 1000000);
  db.prepare(`INSERT INTO projects (id, name, project_key, phase) VALUES (?, ?, ?, ?)`).run(
    projectId,
    'P1',
    'P1',
    'SIT'
  );

  db.prepare(
    `INSERT INTO sample_sizes (project_id, waterfall, tests, config_samples, test_name) VALUES (?, ?, ?, ?, ?)`
  ).run(
    projectId,
    '1',
    JSON.stringify([{ testId: 'T1', testName: 'Alpha' }]),
    JSON.stringify({ CFG_A: 10, CFG_B: 5 }),
    ''
  );
  db.prepare(
    `INSERT INTO sample_sizes (project_id, waterfall, tests, config_samples, test_name) VALUES (?, ?, ?, ?, ?)`
  ).run(
    projectId,
    '2',
    JSON.stringify([{ testId: 'T2', testName: 'Beta' }]),
    JSON.stringify({ CFG_A: 20 }),
    ''
  );

  const ins = db.prepare(
    `INSERT INTO issues (project_id, fa_number, sn, open_date, wf, config, failed_test, failure_type, fa_status, failed_location, raw_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  ins.run(projectId, 'FA-1', 'SN-1', '2026-01-01', '1', 'CFG_A', 'Alpha', 'Spec.', 'open', 'LOC-1', '{}');
  ins.run(projectId, 'FA-2', 'SN-1', '2026-01-01', '1', 'CFG_A', 'Alpha', 'Spec.', 'open', 'LOC-1', '{}');
  ins.run(projectId, 'FA-3', 'SN-2', '2026-01-01', '1', 'CFG_B', 'Alpha', 'Strife', 'open', 'LOC-2', '{}');
  ins.run(projectId, 'FA-4', 'SN-3', '2026-01-01', '2', 'CFG_A', 'Beta', 'Spec.', 'retest pass', 'LOC-3', '{}');

  const byConfig = await analysisModel.getCompactFailureRate(projectId, {
    groupBy: 'config',
    numerator: 'spec',
    filters: {},
    offset: 0,
    limit: 10,
  });

  assert.equal(byConfig.groupBy, 'config');
  assert.equal(byConfig.numerator, 'spec');
  assert.ok(Array.isArray(byConfig.keys));
  assert.ok(Array.isArray(byConfig.failures));
  assert.ok(Array.isArray(byConfig.totalSamples));

  const idxA = byConfig.keys.indexOf('CFG_A');
  assert.ok(idxA >= 0);
  assert.equal(byConfig.failures[idxA], 1);
  assert.equal(byConfig.totalSamples[idxA], 30);

  const none = await analysisModel.getCompactFailureRate(projectId, {
    groupBy: 'none',
    numerator: 'spec',
    filters: {},
  });
  assert.equal(none.failures, 1);
  assert.equal(none.totalSamples, 35);

  const sampleByTest = await analysisModel.getCompactSampleSize(projectId, { groupBy: 'failed_test', offset: 0, limit: 100 });
  const testIdxAlpha = sampleByTest.keys.indexOf('Alpha');
  const testIdxBeta = sampleByTest.keys.indexOf('Beta');
  assert.ok(testIdxAlpha >= 0);
  assert.ok(testIdxBeta >= 0);
  assert.equal(sampleByTest.totalSamples[testIdxAlpha], 15);
  assert.equal(sampleByTest.totalSamples[testIdxBeta], 20);

  db.prepare(`DELETE FROM issues WHERE project_id = ?`).run(projectId);
  db.prepare(`DELETE FROM sample_sizes WHERE project_id = ?`).run(projectId);
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);

  await closeDatabase();
});
