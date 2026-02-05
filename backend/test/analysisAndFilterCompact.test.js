const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase, getDatabase } = require('../src/models/database');
const analysisModel = require('../src/models/analysisModel');

test('getAnalysisCompact/getFilterStatisticsCompact 返回 topK + 两数字数组结构', async () => {
  await initDatabase();
  const db = getDatabase();

  const projectId = 910000000 + Math.round(Math.random() * 1000000);
  db.prepare(`INSERT INTO projects (id, name, project_key, phase) VALUES (?, ?, ?, ?)`).run(
    projectId,
    'P2',
    'P2',
    'DVT'
  );

  db.prepare(
    `INSERT INTO sample_sizes (project_id, waterfall, tests, config_samples, test_name) VALUES (?, ?, ?, ?, ?)`
  ).run(projectId, '1', JSON.stringify([{ testId: 'T1', testName: 'Alpha' }]), JSON.stringify({ C1: 10, C2: 5 }), '');
  db.prepare(
    `INSERT INTO sample_sizes (project_id, waterfall, tests, config_samples, test_name) VALUES (?, ?, ?, ?, ?)`
  ).run(projectId, '2', JSON.stringify([{ testId: 'T2', testName: 'Beta' }]), JSON.stringify({ C1: 20 }), '');

  const ins = db.prepare(
    `INSERT INTO issues (project_id, fa_number, sn, open_date, wf, config, failed_test, failure_type, fa_status, failed_location, symptom, raw_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  ins.run(projectId, 'FA-1', 'SN-1', '2026-01-01', '1', 'C1', 'Alpha', 'Spec.', 'open', 'L1', 'S1', '{}');
  ins.run(projectId, 'FA-2', 'SN-2', '2026-01-01', '1', 'C2', 'Alpha', 'Spec.', 'open', 'L2', 'S2', '{}');
  ins.run(projectId, 'FA-3', 'SN-3', '2026-01-01', '2', 'C1', 'Beta', 'Strife', 'open', 'L3', 'S1', '{}');

  const analysis = await analysisModel.getAnalysisCompact(projectId, {}, { top: 2, numerator: 'spec', sortBy: 'ppm' });
  assert.ok(analysis.overview);
  assert.equal(analysis.top, 2);
  assert.ok(analysis.distributions);
  assert.ok(Array.isArray(analysis.distributions.symptoms.keys));
  assert.ok(Array.isArray(analysis.distributions.symptoms.failures));
  assert.ok(typeof analysis.distributions.symptoms.totalSamples === 'number');
  assert.ok(analysis.distributions.symptoms.keys.length <= 2);

  const stats = await analysisModel.getFilterStatisticsCompact(projectId, {}, { top: 2, numerator: 'spec', sortBy: 'ppm' });
  assert.ok(stats.distributions.failedLocations);
  assert.ok(Array.isArray(stats.distributions.failedLocations.keys));
  assert.ok(Array.isArray(stats.distributions.failedLocations.failures));
  assert.ok(typeof stats.distributions.failedLocations.totalSamples === 'number');
  assert.ok(stats.distributions.failedLocations.keys.length <= 2);

  db.prepare(`DELETE FROM issues WHERE project_id = ?`).run(projectId);
  db.prepare(`DELETE FROM sample_sizes WHERE project_id = ?`).run(projectId);
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);

  await closeDatabase();
});

