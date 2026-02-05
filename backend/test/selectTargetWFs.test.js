const test = require('node:test');
const assert = require('node:assert/strict');
const analysisService = require('../src/services/analysisService');

test('selectTargetWFs respects failed_tests and wfs intersection', () => {
  const sampleSizes = [
    {
      waterfall: '1',
      tests: [
        { testId: 'T1', testName: 'Alpha' },
        { testId: 'T2', testName: 'Beta' },
      ],
      config_samples: { R1: 10 },
      test_name: '',
    },
    {
      waterfall: '2',
      tests: [
        { testId: 'T3', testName: 'Gamma' },
        { testId: 'T2', testName: 'Beta' },
      ],
      config_samples: { R1: 20 },
      test_name: '',
    },
    {
      waterfall: '3',
      tests: [{ testId: 'T4', testName: 'Delta' }],
      config_samples: { R2: 30 },
      test_name: '',
    },
  ];

  const wfSampleMap = analysisService.buildWFSampleMap(sampleSizes);

  const wfs1 = analysisService.selectTargetWFs(wfSampleMap, { failed_tests: ['Beta'] });
  assert.deepEqual(Array.from(wfs1).sort(), ['1', '2']);

  const wfs2 = analysisService.selectTargetWFs(wfSampleMap, { failed_tests: ['Beta'], wfs: ['2'] });
  assert.deepEqual(Array.from(wfs2).sort(), ['2']);

  const wfs3 = analysisService.selectTargetWFs(wfSampleMap, { wfs: ['3'] });
  assert.deepEqual(Array.from(wfs3).sort(), ['3']);

  const wfs4 = analysisService.selectTargetWFs(wfSampleMap, {});
  assert.deepEqual(Array.from(wfs4).sort(), ['1', '2', '3']);
});

