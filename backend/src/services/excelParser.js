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
    
    // Log all available sheets
    console.log('📊 Available sheets in Excel file:', workbook.SheetNames);

    // Parse System TF sheet (find by name: 'System TF')
    const systemTFSheetName = findSheetByName(workbook.SheetNames, ['System TF', 'SystemTF', 'System']);
    if (!systemTFSheetName) {
      throw new Error(`Could not find "System TF" sheet in Excel file. Available sheets: ${workbook.SheetNames.join(', ')}`);
    }
    console.log('✅ Found System TF sheet:', systemTFSheetName);
    const systemTFSheet = workbook.Sheets[systemTFSheetName];
    const issues = parseSystemTF(systemTFSheet);

    // Parse WF Sample size sheet (find by name: 'WF Sample Size' or similar)
    const sampleSizeSheetName = findSheetByName(workbook.SheetNames, ['WF Sample Size', 'WF Sample Sizes', 'Sample Size', 'WF']);
    if (!sampleSizeSheetName) {
      throw new Error(`Could not find "WF Sample Size" sheet in Excel file. Available sheets: ${workbook.SheetNames.join(', ')}`);
    }
    console.log('✅ Found WF Sample Size sheet:', sampleSizeSheetName);
    const sampleSizeSheet = workbook.Sheets[sampleSizeSheetName];
    const { sampleSizes, configNames: rawConfigNames } = parseSampleSizes(sampleSizeSheet);
    const configNames =
      rawConfigNames.length === 0 ? Array.from(new Set(issues.map((i) => i.config).filter(Boolean))).sort() : rawConfigNames;

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

  const headerRow = detectSystemTFHeaderRow(sheet, range);
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
      } else {
        console.log(`  Col ${colNum} "${headerValue}" -> (not mapped)`);
      }
    }
  }

  for (let rowNum = headerRow + 1; rowNum <= range.e.r; rowNum++) {
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

function detectSystemTFHeaderRow(sheet, range) {
  const maxRow = Math.min(range.e.r, 60);
  let bestRow = config.excel.headerRow - 1;
  let bestScore = -1;
  for (let rowNum = 0; rowNum <= maxRow; rowNum++) {
    const mapped = new Set();
    for (let colNum = 0; colNum <= range.e.c; colNum++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
      const cell = sheet[cellAddress];
      const headerValue = cell ? String(cell.v).trim() : null;
      if (!headerValue) continue;
      const fieldName = getFieldNameByHeader(headerValue);
      if (fieldName) mapped.add(fieldName);
    }
    const score = mapped.size;
    if (score > bestScore && mapped.has('faNumber') && score >= 5) {
      bestScore = score;
      bestRow = rowNum;
    }
  }
  console.log(`📍 System TF detected header row: ${bestRow + 1}`);
  return bestRow;
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
    sn: row.sn ? String(row.sn).trim() : null,
    unitNumber: row.unitNumber ? String(row.unitNumber).trim() : null,
    failedCycleCount: row.failedCycleCount ? String(row.failedCycleCount).trim() : null,
    rawData: JSON.stringify(row), // Store all 30 fields as JSON
  };
}

/**
 * Find sheet by name (case-insensitive, supports multiple naming variations)
 * @param {Array} sheetNames - List of sheet names from workbook
 * @param {Array} possibleNames - Possible names to search for
 * @returns {string} The matching sheet name, or null if not found
 */
function findSheetByName(sheetNames, possibleNames) {
  const normalizedSheets = sheetNames.map(name => ({
    original: name,
    normalized: name.toLowerCase().trim()
  }));

  for (const possibleName of possibleNames) {
    const normalized = possibleName.toLowerCase().trim();
    const match = normalizedSheets.find(sheet => sheet.normalized === normalized);
    if (match) {
      console.log(`📍 Matched sheet name "${possibleName}" -> "${match.original}"`);
      return match.original;
    }
  }

  console.log(`⚠️ Sheet not found. Searched for: ${possibleNames.join(', ')}`);
  return null;
}

/**
 * Parse WF Sample size sheet
 * @param {Object} sheet - XLSX sheet object
 * @returns {Object} Sample sizes and config names
 */
function parseSampleSizes(sheet) {
  const sampleSizes = [];
  const range = XLSX.utils.decode_range(sheet['!ref']);

  const headerRow = detectWFSampleSizeHeaderRow(sheet, range);
  const headerValues = [];
  for (let colNum = 0; colNum <= range.e.c; colNum++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c: colNum })];
    headerValues.push(cell?.v ? String(cell.v).trim() : '');
  }

  const testColumnIndexes = [];
  for (let colNum = 1; colNum <= range.e.c; colNum++) {
    const header = headerValues[colNum];
    if (!header) break;
    if (/^test\s*\d+$/i.test(header)) {
      testColumnIndexes.push(colNum);
      continue;
    }
    break;
  }

  const configStartCol = testColumnIndexes.length > 0 ? testColumnIndexes[testColumnIndexes.length - 1] + 1 : 1;
  const configNames = headerValues.slice(configStartCol).filter(Boolean);

  for (let rowNum = headerRow + 1; rowNum <= range.e.r; rowNum++) {
    const wfCell = sheet[XLSX.utils.encode_cell({ r: rowNum, c: 0 })];
    if (!wfCell?.v) continue;
    const waterfall = String(wfCell.v).trim();
    if (!waterfall) continue;

    const tests = testColumnIndexes
      .map((colNum, index) => {
        const cell = sheet[XLSX.utils.encode_cell({ r: rowNum, c: colNum })];
        const value = cell?.v ? String(cell.v).trim() : '';
        if (!value || value === '/') return null;
        return { testId: `Test${index + 1}`, testName: value, index };
      })
      .filter(Boolean);

    const configSamples = {};
    configNames.forEach((configName, idx) => {
      const colNum = configStartCol + idx;
      const cell = sheet[XLSX.utils.encode_cell({ r: rowNum, c: colNum })];
      const value = cell?.v;
      configSamples[configName] = value === null || value === undefined || value === '' ? 0 : Number(value);
    });

    sampleSizes.push({
      waterfall,
      testName: tests.map((t) => t.testName).join('+'),
      tests: JSON.stringify(tests),
      configSamples: JSON.stringify(configSamples),
    });
  }

  return { sampleSizes, configNames };
}

function detectWFSampleSizeHeaderRow(sheet, range) {
  const maxRow = Math.min(range.e.r, 20);
  for (let rowNum = 0; rowNum <= maxRow; rowNum++) {
    const a = sheet[XLSX.utils.encode_cell({ r: rowNum, c: 0 })]?.v;
    const b = sheet[XLSX.utils.encode_cell({ r: rowNum, c: 1 })]?.v;
    const c = sheet[XLSX.utils.encode_cell({ r: rowNum, c: 2 })]?.v;
    const v0 = a ? String(a).trim().toLowerCase() : '';
    const v1 = b ? String(b).trim().toLowerCase() : '';
    const v2 = c ? String(c).trim().toLowerCase() : '';
    if (v0 === 'wf' && v1.startsWith('test') && v2.startsWith('test')) {
      return rowNum;
    }
  }
  return 0;
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
 * Parse Excel date to ISO string (YYYY-MM-DD)
 * Avoids timezone conversion issues by working directly with date components
 */
function parseExcelDate(excelDate) {
  if (typeof excelDate === 'number') {
    const date = XLSX.SSF.parse_date_code(excelDate);
    // Format: YYYY-MM-DD (pad month and day with zeros)
    const year = date.y.toString().padStart(4, '0');
    const month = String(date.m).padStart(2, '0');
    const day = String(date.d).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (excelDate instanceof Date) {
    const year = String(excelDate.getFullYear()).padStart(4, '0');
    const month = String(excelDate.getMonth() + 1).padStart(2, '0');
    const day = String(excelDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return excelDate;
}

module.exports = {
  parseExcelFile,
};
