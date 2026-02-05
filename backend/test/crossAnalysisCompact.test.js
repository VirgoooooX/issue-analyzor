const test = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase, getDatabase } = require('../src/models/database');
const analysisModel = require('../src/models/analysisModel');

test('getCrossAnalysisCompact 返回稀疏 cells + denomByDim2（无重复字段）', async () => {
  await initDatabase();
  const db = getDatabase();

  const projectId = 920000000 + Math.round(Math.random() * 1000000);
  db.prepare(`INSERT INTO projects (id, name, project_key, phase) VALUES (?, ?, ?, ?)`).run(
    projectId,
    'P3',
    'P3',
    'P1'
  );

  db.prepare(
    `INSERT INTO sample_sizes (project_id, waterfall, tests, config_samples, test_name) VALUES (?, ?, ?, ?, ?)`
  ).run(projectId, '1', JSON.stringify([{ testId: 'T1', testName: 'Alpha' }]), JSON.stringify({ C1: 10, C2: 5 }), '');

  const ins = db.prepare(
    `INSERT INTO issues (project_id, fa_number, sn, open_date, wf, config, failed_test, failure_type, fa_status, failed_location, symptom, raw_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  ins.run(projectId, 'FA-1', 'SN-1', '2026-01-01', '1', 'C1', 'Alpha', 'Spec.', 'open', 'Power', 'Rattle Lv3', '{}');
  ins.run(projectId, 'FA-2', 'SN-2', '2026-01-01', '1', 'C2', 'Alpha', 'Strife', 'open', 'Volume', 'Rattle Lv3', '{}');

  const out = await analysisModel.getCrossAnalysisCompact(
    projectId,
    'config',
    'failed_location',
    { symptoms: 'Rattle Lv3' },
    { top: 100, sortBy: 'specSN' }
  );

  assert.equal(out.dimension1, 'config');
  assert.equal(out.dimension2, 'failed_location');
  assert.ok(Array.isArray(out.dimension1Values));
  assert.ok(Array.isArray(out.dimension2Values));
  assert.ok(Array.isArray(out.denomByDim2));
  assert.ok(Array.isArray(out.cells));
  assert.equal(out.denomPerCell, false);
  assert.ok(out.cells.length > 0);

  const cell = out.cells[0];
  assert.ok(cell.length === 5);

  db.prepare(`DELETE FROM issues WHERE project_id = ?`).run(projectId);
  db.prepare(`DELETE FROM sample_sizes WHERE project_id = ?`).run(projectId);
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);

  await closeDatabase();
});

