const XLSX = require('xlsx');
const config = require('../config');

/**
 * Parse Excel file and extract data
 * @param {string} filePath - Path to Excel file
 * @returns {Object} Parsed data including issues and sample sizes
 */
async function parseExcelFile(filePath) {
  try {
    // Read Excel file
    const workbook = XLSX.readFile(filePath);

    // Parse System TF sheet (Sheet 1)
    const systemTFSheet = workbook.Sheets[workbook.SheetNames[config.excel.systemTFSheetIndex]];
    const issues = parseSystemTF(systemTFSheet);

    // Parse WF Sample size sheet (Sheet 5)
    const sampleSizeSheet = workbook.Sheets[workbook.SheetNames[config.excel.sampleSizeSheetIndex]];
    const { sampleSizes, configNames } = parseSampleSizes(sampleSizeSheet);

    // Match Failed Test with Test IDs
    const issuesWithTestId = matchFailedTests(issues, sampleSizes);

    // Generate validation report
    const validationReport = generateValidationReport(issuesWithTestId, sampleSizes, configNames);

    return {
      issues: issuesWithTestId,
      sampleSizes,
      configNames,
      validationReport,
    };
  } catch (error) {
    console.error('Excel parsing error:', error);
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
}

/**
 * Parse System TF sheet to extract issues
 * @param {Object} sheet - XLSX sheet object
 * @returns {Array} Array of issue objects
 */
function parseSystemTF(sheet) {
  const issues = [];
  const range = XLSX.utils.decode_range(sheet['!ref']);

  // 读取表头行并构建动态映射
  const headerRow = config.excel.headerRow - 1;
  const columnMapping = {};
  
  console.log('📋 System TF Sheet - Building column mapping:');
  for (let colNum = 0; colNum <= range.e.c; colNum++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: colNum });
    const cell = sheet[cellAddress];
    const headerValue = cell ? String(cell.v).trim() : null;
    
    if (headerValue) {
      const fieldName = getFieldNameByHeader(headerValue);
      if (fieldName) {
        columnMapping[colNum] = fieldName;
        console.log(`  Col ${colNum} "${headerValue}" -> ${fieldName}`);
      }
    }
  }

  // Start from data row (row 8, 0-indexed as 7)
  for (let rowNum = config.excel.dataStartRow - 1; rowNum <= range.e.r; rowNum++) {
    const row = {};
    let hasData = false;

    // 使用动态映射读取数据
    for (let colNum = 0; colNum <= range.e.c; colNum++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
      const cell = sheet[cellAddress];
      const value = cell ? cell.v : null;

      if (value !== null && value !== undefined && value !== '') {
        hasData = true;
      }

      const fieldName = columnMapping[colNum];
      if (fieldName) {
        row[fieldName] = value;
      }
    }

    // Only add row if it has data
    if (hasData && row.faNumber) {
      issues.push(parseIssueRow(row));
    }
  }

  console.log(`✅ Parsed ${issues.length} issues from System TF`);
  if (issues.length > 0) {
    console.log('Sample issue:', {
      faNumber: issues[0].faNumber,
      wf: issues[0].wf,
      config: issues[0].config,
      symptom: issues[0].symptom
    });
  }

  return issues;
}

/**
 * Get field name by column index
 */
function getFieldNameByIndex(index) {
  const fieldMap = [
    'faNumber',              // 0: FA#
    'openDate',              // 1: Open Date
    'priority',              // 2: Priority
    'masterRadar',           // 3: Master Radar#
    'subRadar',              // 4: Sub Radar#
    'owner',                 // 5: Jabil FA DRI
    'sampleStatus',          // 6: Sample Status
    'department',            // 7: Department
    'unitNumber',            // 8: Unit#
    'sn',                    // 9: SN
    'wf',                    // 10: WF
    'config',                // 11: Config
    'testHistory',           // 12: Test History
    'failedTest',            // 13: Failed Test
    'failedCycleCount',      // 14: Failed Cycle Count
    'failureType',           // 15: Failure Type
    'functionOrCosmetic',    // 16: Function or Cosmetic
    'failedLocation',        // 17: Failed Location
    'symptom',               // 18: Failure Symptom / Failure Message
    'faStatus',              // 19: FA Status
    'followUpActions',       // 20: Follow Up Actions
    'rootCause',             // 21: Root Cause
    'multiComponent',        // 22: Multiple Component failureMode
  ];

  return fieldMap[index] || `field${index}`;
}

/**
 * Get field name by header name (dynamic mapping)
 */
function getFieldNameByHeader(headerName) {
  const normalized = headerName.toLowerCase().trim();
  
  const headerMapping = {
    'fa#': 'faNumber',
    'open date': 'openDate',
    'priority': 'priority',
    'master radar#': 'masterRadar',
    'sub radar#': 'subRadar',
    'jabil fa dri': 'owner',
    'sample status': 'sampleStatus',
    'abc fa dri': 'abcFaDri',
    'department': 'department',
    'unit#': 'unitNumber',
    'sn': 'sn',
    'wf': 'wf',
    'config': 'config',
    'test history': 'testHistory',
    'failed test': 'failedTest',
    'failed cycle count': 'failedCycleCount',
    'failure type': 'failureType',
    'function or cosmetic': 'functionOrCosmetic',
    'failed location': 'failedLocation',
    'fa status': 'faStatus',
    'follow up actions': 'followUpActions',
    'root cause': 'rootCause',
    'multiple component failuremode (y/n)': 'multiComponent',
    'root cause category i': 'rootCauseCategoryI',
    'root cause category ii': 'rootCauseCategoryII',
    'radar status': 'radarStatus',
    'ca': 'ca',
    'remark': 'remark'
  };
  
  // 处理包含换行符的表头
  if (normalized.includes('failure symptom') || normalized.includes('failure message')) {
    return 'symptom';
  }
  if (normalized.includes('failure type') && normalized.includes('spec')) {
    return 'failureType';
  }
  
  return headerMapping[normalized] || null;
}

/**
 * Parse issue row to standardized format
 */
function parseIssueRow(row) {
  return {
    faNumber: row.faNumber ? String(row.faNumber).trim() : null,
    openDate: row.openDate ? parseExcelDate(row.openDate) : null,
    wf: row.wf ? String(row.wf).trim() : null,
    config: row.config ? String(row.config).trim() : null,
    symptom: row.symptom ? String(row.symptom).trim() : null,
    failedTest: row.failedTest ? String(row.failedTest).trim() : null,
    priority: row.priority ? String(row.priority).trim() : null,
    failureType: row.failureType ? String(row.failureType).trim() : null,
    rootCause: row.rootCause ? String(row.rootCause).trim() : null,
    faStatus: row.faStatus ? String(row.faStatus).trim() : null,
    department: row.department ? String(row.department).trim() : null,
    owner: row.owner ? String(row.owner).trim() : null,
    sampleStatus: row.sampleStatus ? String(row.sampleStatus).trim() : null,
    failedLocation: row.failedLocation ? String(row.failedLocation).trim() : null,
    functionOrCosmetic: row.functionOrCosmetic ? String(row.functionOrCosmetic).trim() : null,
    multiComponent: row.multiComponent ? String(row.multiComponent).trim() : null,
    rawData: JSON.stringify(row), // Store all 30 fields as JSON
  };
}

/**
 * Parse WF Sample size sheet
 * @param {Object} sheet - XLSX sheet object
 * @returns {Object} Sample sizes and config names
 */
function parseSampleSizes(sheet) {
  const sampleSizes = [];
  const range = XLSX.utils.decode_range(sheet['!ref']);

  // Extract config names from header row (row 1, 0-indexed as 0)
  const configNames = [];
  for (let colNum = 2; colNum <= range.e.c; colNum++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colNum });
    const cell = sheet[cellAddress];
    if (cell && cell.v) {
      configNames.push(String(cell.v).trim());
    }
  }

  // Parse data rows (starting from row 2, 0-indexed as 1)
  for (let rowNum = 1; rowNum <= range.e.r; rowNum++) {
    const wfCell = sheet[XLSX.utils.encode_cell({ r: rowNum, c: 0 })];
    const testNameCell = sheet[XLSX.utils.encode_cell({ r: rowNum, c: 1 })];

    if (!wfCell || !wfCell.v) continue;

    const waterfall = String(wfCell.v).trim();
    const testName = testNameCell && testNameCell.v ? String(testNameCell.v).trim() : '';

    // Split Test Name by "+" and trim each test
    const tests = testName
      .split('+')
      .map((test, index) => ({
        testId: `Test${index + 1}`,
        testName: test.trim(),
        index,
      }))
      .filter((test) => test.testName);

    // Extract config samples
    const configSamples = {};
    configNames.forEach((configName, index) => {
      const colNum = 2 + index;
      const cell = sheet[XLSX.utils.encode_cell({ r: rowNum, c: colNum })];
      configSamples[configName] = cell && cell.v ? Number(cell.v) : 0;
    });

    sampleSizes.push({
      waterfall,
      testName,
      tests: JSON.stringify(tests),
      configSamples: JSON.stringify(configSamples),
    });
  }

  return { sampleSizes, configNames };
}

/**
 * Match failed tests with test IDs from sample sizes
 * @param {Array} issues - Array of issues
 * @param {Array} sampleSizes - Array of sample sizes
 * @returns {Array} Issues with testId matched
 */
function matchFailedTests(issues, sampleSizes) {
  const wfTestMap = new Map();

  // Build WF -> Tests mapping
  sampleSizes.forEach((sample) => {
    wfTestMap.set(sample.waterfall, JSON.parse(sample.tests));
  });

  // Match each issue's failed test
  return issues.map((issue) => {
    if (!issue.failedTest || !issue.wf) {
      return { ...issue, testId: null };
    }

    const tests = wfTestMap.get(issue.wf) || [];
    const matchedTest = tests.find((test) => test.testName === issue.failedTest);

    return {
      ...issue,
      testId: matchedTest ? matchedTest.testId : null,
    };
  });
}

/**
 * Generate validation report
 */
function generateValidationReport(issues, sampleSizes, configNames) {
  const report = {
    totalIssues: issues.length,
    validIssues: issues.filter((i) => i.faNumber && i.wf && i.config && i.symptom).length,
    warnings: [],
  };

  // Check for issues without test ID match
  const unmatchedTests = issues.filter((i) => i.failedTest && !i.testId);
  if (unmatchedTests.length > 0) {
    report.warnings.push({
      level: 'warning',
      type: 'test_mismatch',
      message: `${unmatchedTests.length} issues have Failed Test that doesn't match any test in WF Sample size`,
      affectedCount: unmatchedTests.length,
    });
  }

  // Check for missing WF in sample sizes
  const wfSet = new Set(sampleSizes.map((s) => s.waterfall));
  const missingWFs = [...new Set(issues.map((i) => i.wf))].filter((wf) => wf && !wfSet.has(wf));
  if (missingWFs.length > 0) {
    report.warnings.push({
      level: 'error',
      type: 'wf_missing',
      message: `${missingWFs.length} WFs in issues don't have sample size data`,
      affectedCount: missingWFs.length,
      details: missingWFs,
    });
  }

  return report;
}

/**
 * Parse Excel date to ISO string
 */
function parseExcelDate(excelDate) {
  if (typeof excelDate === 'number') {
    const date = XLSX.SSF.parse_date_code(excelDate);
    return new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
  }
  return excelDate;
}

module.exports = {
  parseExcelFile,
};
