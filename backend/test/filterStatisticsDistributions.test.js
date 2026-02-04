const test = require('node:test');
const assert = require('node:assert/strict');
const analysisService = require('../src/services/analysisService');

test('calculateFilterStats 返回 failedTestDistribution 与 failedLocationDistribution（含样本分母）', () => {
  const issues = [
    {
      fa_number: 'FA-1',
      sn: 'SN-1',
      wf: '1',
      config: 'R1CASN',
      symptom: 'SYM-A',
      failure_type: 'Spec.',
      failed_test: 'My Test',
      failed_location: 'LOC-1',
      fa_status: 'open',
    },
    {
      fa_number: 'FA-2',
      sn: 'SN-2',
      wf: '1',
      config: 'R1CASN',
      symptom: 'SYM-A',
      failure_type: 'Strife',
      failed_test: 'My Test',
      failed_location: 'LOC-1',
      fa_status: 'open',
    },
    {
      fa_number: 'FA-3',
      sn: 'SN-3',
      wf: '2',
      config: 'R2CBCN',
      symptom: 'SYM-B',
      failure_type: 'Spec.',
      failed_test: 'Other Test',
      failed_location: 'LOC-2',
      fa_status: 'open',
    },
    {
      fa_number: 'FA-4',
      sn: 'SN-4',
      wf: '2',
      config: 'R2CBCN',
      symptom: 'SYM-B',
      failure_type: 'Spec.',
      failed_test: '',
      failed_location: '',
      fa_status: 'retest pass',
    },
  ];

  const sampleSizes = [
    {
      waterfall: '1',
      tests: [
        { testId: 'Test1', testName: 'My Test' },
        { testId: 'Test2', testName: 'Unrelated' },
      ],
      config_samples: { R1CASN: 10 },
      test_name: '',
    },
    {
      waterfall: '2',
      tests: [{ testId: 'Test1', testName: 'Other Test' }],
      config_samples: { R2CBCN: 20 },
      test_name: '',
    },
  ];

  const wfSampleMap = analysisService.buildWFSampleMap(sampleSizes);
  const result = analysisService.calculateFilterStats(issues, wfSampleMap, {}, false);

  assert.ok(result);
  assert.ok(result.statistics);
  assert.ok(Array.isArray(result.statistics.failedTestDistribution));
  assert.ok(Array.isArray(result.statistics.failedLocationDistribution));

  const byTest = Object.fromEntries(result.statistics.failedTestDistribution.map((x) => [x.testName, x]));
  assert.equal(byTest['My Test'].totalCount, 2);
  assert.equal(byTest['My Test'].specSNCount, 1);
  assert.equal(byTest['My Test'].strifeSNCount, 1);
  assert.equal(byTest['My Test'].totalSamples, 10);

  assert.equal(byTest['Other Test'].totalCount, 1);
  assert.equal(byTest['Other Test'].specSNCount, 1);
  assert.equal(byTest['Other Test'].totalSamples, 20);

  const byLoc = Object.fromEntries(result.statistics.failedLocationDistribution.map((x) => [x.failedLocation, x]));
  assert.equal(byLoc['LOC-1'].totalCount, 2);
  assert.equal(byLoc['LOC-1'].specSNCount, 1);
  assert.equal(byLoc['LOC-1'].strifeSNCount, 1);
  assert.equal(byLoc['LOC-1'].totalSamples, 30);
});

