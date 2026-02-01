const test = require('node:test');
const assert = require('node:assert/strict');

test('从文件名解析阶段（EVT/DVT/P1）并生成 project_key', async () => {
  const { parsePhaseFromFileName, deriveProjectKeyFromFileName } = require('../src/services/projectNaming');

  assert.equal(parsePhaseFromFileName('Alpha_EVT.xlsx'), 'EVT');
  assert.equal(deriveProjectKeyFromFileName('Alpha_EVT.xlsx'), 'Alpha');

  assert.equal(parsePhaseFromFileName('Alpha-DVT-Report.xls'), 'DVT');
  assert.equal(deriveProjectKeyFromFileName('Alpha-DVT-Report.xls'), 'Alpha');

  assert.equal(parsePhaseFromFileName('Product_P1_build.xlsx'), 'P1');
  assert.equal(deriveProjectKeyFromFileName('Product_P1_build.xlsx'), 'Product');

  assert.equal(parsePhaseFromFileName('M60 P1 REL FA Tracker 20251201.xlsx'), 'P1');
  assert.equal(deriveProjectKeyFromFileName('M60 P1 REL FA Tracker 20251201.xlsx'), 'M60');
});

test('阶段解析不应误判 APP1 为 P1', async () => {
  const { parsePhaseFromFileName } = require('../src/services/projectNaming');
  assert.equal(parsePhaseFromFileName('APP1_build.xlsx'), null);
});
