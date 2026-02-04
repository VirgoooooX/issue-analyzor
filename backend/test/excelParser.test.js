const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const XLSX = require('xlsx');
const { parseExcelFile } = require('../src/services/excelParser');

test('WF Sample Size 支持 Test-1 / Test - 1 表头识别为测试列', async () => {
  const workbook = XLSX.utils.book_new();

  const systemTFData = [
    ['FA#', 'Open Date', 'WF', 'Config', 'Failed Test', 'Failure Symptom', 'Priority'],
    ['FA-001', '2025-12-01', '1', 'R1CASN', 'TestA', 'SYM1', 'P1'],
  ];
  const systemTFSheet = XLSX.utils.aoa_to_sheet(systemTFData);
  XLSX.utils.book_append_sheet(workbook, systemTFSheet, 'System TF');

  const wfSampleSizeData = [
    ['WF', 'Test-1', 'Test - 2', 'R1CASN'],
    ['1', 'TestA', 'TestB', 12],
  ];
  const wfSampleSizeSheet = XLSX.utils.aoa_to_sheet(wfSampleSizeData);
  XLSX.utils.book_append_sheet(workbook, wfSampleSizeSheet, 'WF Sample Size');

  const tmpFile = path.join(os.tmpdir(), `issue-analyzer-test-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`);
  try {
    XLSX.writeFile(workbook, tmpFile);

    const parsed = await parseExcelFile(tmpFile);
    assert.ok(Array.isArray(parsed.sampleSizes));
    assert.ok(Array.isArray(parsed.configNames));

    assert.deepEqual(parsed.configNames, ['R1CASN']);

    assert.equal(parsed.sampleSizes.length, 1);
    const sample = parsed.sampleSizes[0];
    const tests = JSON.parse(sample.tests);
    assert.deepEqual(
      tests.map((t) => ({ testId: t.testId, testName: t.testName })),
      [
        { testId: 'Test1', testName: 'TestA' },
        { testId: 'Test2', testName: 'TestB' },
      ]
    );
  } finally {
    try {
      await fs.unlink(tmpFile);
    } catch {
      // ignore
    }
  }
});

