function normalizeCsvArray(value) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter((v) => v);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter((v) => v);
  return undefined;
}

function buildIssuesWhere(projectId, filters = {}, options = {}) {
  const {
    date_from,
    date_to,
    priorities,
    sample_statuses,
    departments,
    wfs,
    configs,
    failed_tests,
    test_ids,
    failure_types,
    function_cosmetic,
    failed_locations,
    symptoms,
    fa_statuses,
    unit_number,
    sn,
    fa_search,
  } = filters;

  const excludeRetestPass = !!options.excludeRetestPass;

  let where = `project_id = ?`;
  const params = [projectId];

  if (excludeRetestPass) {
    where += ` AND (fa_status IS NULL OR lower(trim(fa_status)) <> 'retest pass')`;
  }

  const priorityList = normalizeCsvArray(priorities);
  const sampleStatusList = normalizeCsvArray(sample_statuses);
  const departmentList = normalizeCsvArray(departments);
  const wfList = normalizeCsvArray(wfs);
  const configList = normalizeCsvArray(configs);
  const failedTestList = normalizeCsvArray(failed_tests);
  const testIdList = normalizeCsvArray(test_ids);
  const failureTypeList = normalizeCsvArray(failure_types);
  const functionCosmeticList = normalizeCsvArray(function_cosmetic);
  const failedLocationList = normalizeCsvArray(failed_locations);
  const symptomList = normalizeCsvArray(symptoms);
  const faStatusList = normalizeCsvArray(fa_statuses);

  if (date_from) {
    where += ` AND CAST(open_date AS TEXT) >= ?`;
    params.push(date_from);
  }
  if (date_to) {
    where += ` AND CAST(open_date AS TEXT) <= ?`;
    params.push(date_to);
  }

  if (priorityList && priorityList.length > 0) {
    where += ` AND priority IN (${priorityList.map(() => '?').join(',')})`;
    params.push(...priorityList);
  }
  if (sampleStatusList && sampleStatusList.length > 0) {
    where += ` AND sample_status IN (${sampleStatusList.map(() => '?').join(',')})`;
    params.push(...sampleStatusList);
  }
  if (departmentList && departmentList.length > 0) {
    where += ` AND department IN (${departmentList.map(() => '?').join(',')})`;
    params.push(...departmentList);
  }
  if (unit_number) {
    where += ` AND raw_data LIKE ?`;
    params.push(`%"Unit#":"%${unit_number}%"%`);
  }
  if (sn) {
    where += ` AND raw_data LIKE ?`;
    params.push(`%"SN":"%${sn}%"%`);
  }
  if (wfList && wfList.length > 0) {
    where += ` AND wf IN (${wfList.map(() => '?').join(',')})`;
    params.push(...wfList);
  }
  if (configList && configList.length > 0) {
    where += ` AND config IN (${configList.map(() => '?').join(',')})`;
    params.push(...configList);
  }
  if (failedTestList && failedTestList.length > 0) {
    where += ` AND failed_test IN (${failedTestList.map(() => '?').join(',')})`;
    params.push(...failedTestList);
  }
  if (testIdList && testIdList.length > 0) {
    where += ` AND test_id IN (${testIdList.map(() => '?').join(',')})`;
    params.push(...testIdList);
  }
  if (failureTypeList && failureTypeList.length > 0) {
    where += ` AND failure_type IN (${failureTypeList.map(() => '?').join(',')})`;
    params.push(...failureTypeList);
  }
  if (functionCosmeticList && functionCosmeticList.length > 0) {
    where += ` AND function_or_cosmetic IN (${functionCosmeticList.map(() => '?').join(',')})`;
    params.push(...functionCosmeticList);
  }
  if (failedLocationList && failedLocationList.length > 0) {
    where += ` AND failed_location IN (${failedLocationList.map(() => '?').join(',')})`;
    params.push(...failedLocationList);
  }
  if (symptomList && symptomList.length > 0) {
    where += ` AND symptom IN (${symptomList.map(() => '?').join(',')})`;
    params.push(...symptomList);
  }
  if (faStatusList && faStatusList.length > 0) {
    where += ` AND fa_status IN (${faStatusList.map(() => '?').join(',')})`;
    params.push(...faStatusList);
  }
  if (fa_search) {
    where += ` AND fa_number LIKE ?`;
    params.push(`%${fa_search}%`);
  }

  return { where, params };
}

module.exports = {
  normalizeCsvArray,
  buildIssuesWhere,
};

