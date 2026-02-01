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

test('WF Sample Size 支持最新模板（WF + 多列Test + 多Config列）', async () => {
  const filePath = createTempXlsxPath();

  const wb = XLSX.utils.book_new();
  const systemTfData = [
    ['FA#', 'Open Date', 'WF', 'Config', 'Failure Symptom / Failure Message'],
    ['FA-001', '2022-05-13', '10', 'Main', 'SymptomA'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(systemTfData), 'System TF');

  const sampleSizeData = [
    ['WF', 'Test 1', 'Test 2', 'Main', 'Rel'],
    ['10', 'TestA', 'TestB', 123, 77],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sampleSizeData), 'WF Sample Size');

  XLSX.writeFile(wb, filePath);

  const { parseExcelFile } = require('../src/services/excelParser');
  const result = await parseExcelFile(filePath);

  await fs.rm(filePath, { force: true });

  assert.equal(result.sampleSizes.length, 1);
  assert.deepEqual(result.configNames, ['Main', 'Rel']);
});
