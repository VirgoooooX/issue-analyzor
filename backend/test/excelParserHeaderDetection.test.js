const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const XLSX = require('xlsx');

function createTempXlsxPath() {
  const fileName = `issue-analyzor-test-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`;
  return path.join(os.tmpdir(), fileName);
}

test('parseExcelFile 可识别 System TF 表头在第1行的Excel', async () => {
  const filePath = createTempXlsxPath();

  const wb = XLSX.utils.book_new();
  const systemTfData = [
    ['FA#', 'Open Date', 'WF', 'Config', 'Failure Symptom / Failure Message', 'Failed Test', 'Failure Type', 'FA Status'],
    ['FA-001', '2022-05-13', '10', 'Main', 'SymptomA', 'TestA', 'Spec.', 'Ongoing'],
  ];
  const systemTfSheet = XLSX.utils.aoa_to_sheet(systemTfData);
  XLSX.utils.book_append_sheet(wb, systemTfSheet, 'System TF');

  const sampleSizeData = [
    ['WF', 'Test 1', 'Test 2', 'Main'],
    ['10', 'TestA', 'TestB', 100],
  ];
  const sampleSizeSheet = XLSX.utils.aoa_to_sheet(sampleSizeData);
  XLSX.utils.book_append_sheet(wb, sampleSizeSheet, 'WF Sample Size');

  XLSX.writeFile(wb, filePath);

  const { parseExcelFile } = require('../src/services/excelParser');
  const result = await parseExcelFile(filePath);

  await fs.rm(filePath, { force: true });

  assert.equal(Array.isArray(result.issues), true);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].faNumber, 'FA-001');
  assert.equal(result.issues[0].wf, '10');
  assert.equal(result.issues[0].config, 'Main');
  assert.equal(result.issues[0].failedTest, 'TestA');
});
