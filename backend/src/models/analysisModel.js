const { getDatabase } = require('./database');

/**
 * Analysis Model - Database operations for data querying and analysis
 */
class AnalysisModel {
  /**
   * Get issues for a project with filters
   * Supports 15 filter dimensions as per P1 requirements
   */
  async getIssues(projectId, filters = {}) {
    const db = getDatabase();
    const {
      // Date range
      date_from,
      date_to,
      // Multi-select filters
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
      // Text search filters
      unit_number,
      sn,
      fa_search,
      // Pagination
      page = 1,
      limit = 100,
      sort_by = 'open_date',
      sort_order = 'DESC',
    } = filters;

    let query = `SELECT * FROM issues WHERE project_id = ?`;
    const params = [projectId];

    // Helper function to parse comma-separated values
    const parseArray = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      return value.split(',').map(v => v.trim()).filter(v => v);
    };

    // Date range filter
    if (date_from) {
      query += ` AND open_date >= ?`;
      params.push(date_from);
    }
    if (date_to) {
      query += ` AND open_date <= ?`;
      params.push(date_to);
    }

    // Priority filter
    const priorityList = parseArray(priorities);
    if (priorityList && priorityList.length > 0) {
      query += ` AND priority IN (${priorityList.map(() => '?').join(',')})`;
      params.push(...priorityList);
    }

    // Sample Status filter (from raw_data JSON)
    const sampleStatusList = parseArray(sample_statuses);
    if (sampleStatusList && sampleStatusList.length > 0) {
      query += ` AND sample_status IN (${sampleStatusList.map(() => '?').join(',')})`;
      params.push(...sampleStatusList);
    }

    // Department filter
    const departmentList = parseArray(departments);
    if (departmentList && departmentList.length > 0) {
      query += ` AND department IN (${departmentList.map(() => '?').join(',')})`;
      params.push(...departmentList);
    }

    // Unit# filter (fuzzy search in raw_data)
    if (unit_number) {
      query += ` AND raw_data LIKE ?`;
      params.push(`%"Unit#":"%${unit_number}%"%`);
    }

    // SN filter (fuzzy search in raw_data)
    if (sn) {
      query += ` AND raw_data LIKE ?`;
      params.push(`%"SN":"%${sn}%"%`);
    }

    // WF filter
    const wfList = parseArray(wfs);
    if (wfList && wfList.length > 0) {
      query += ` AND wf IN (${wfList.map(() => '?').join(',')})`;
      params.push(...wfList);
    }

    // Config filter
    const configList = parseArray(configs);
    if (configList && configList.length > 0) {
      query += ` AND config IN (${configList.map(() => '?').join(',')})`;
      params.push(...configList);
    }

    // Failed Test filter
    const failedTestList = parseArray(failed_tests);
    if (failedTestList && failedTestList.length > 0) {
      query += ` AND failed_test IN (${failedTestList.map(() => '?').join(',')})`;
      params.push(...failedTestList);
    }

    // Test ID filter
    const testIdList = parseArray(test_ids);
    if (testIdList && testIdList.length > 0) {
      query += ` AND test_id IN (${testIdList.map(() => '?').join(',')})`;
      params.push(...testIdList);
    }

    // Failure Type filter
    const failureTypeList = parseArray(failure_types);
    if (failureTypeList && failureTypeList.length > 0) {
      query += ` AND failure_type IN (${failureTypeList.map(() => '?').join(',')})`;
      params.push(...failureTypeList);
    }

    // Function or Cosmetic filter
    const functionCosmeticList = parseArray(function_cosmetic);
    if (functionCosmeticList && functionCosmeticList.length > 0) {
      query += ` AND function_or_cosmetic IN (${functionCosmeticList.map(() => '?').join(',')})`;
      params.push(...functionCosmeticList);
    }

    // Failed Location filter
    const failedLocationList = parseArray(failed_locations);
    if (failedLocationList && failedLocationList.length > 0) {
      query += ` AND failed_location IN (${failedLocationList.map(() => '?').join(',')})`;
      params.push(...failedLocationList);
    }

    // Symptom filter
    const symptomList = parseArray(symptoms);
    if (symptomList && symptomList.length > 0) {
      query += ` AND symptom IN (${symptomList.map(() => '?').join(',')})`;
      params.push(...symptomList);
    }

    // FA Status filter
    const faStatusList = parseArray(fa_statuses);
    if (faStatusList && faStatusList.length > 0) {
      query += ` AND fa_status IN (${faStatusList.map(() => '?').join(',')})`;
      params.push(...faStatusList);
    }

    // FA# search filter
    if (fa_search) {
      query += ` AND fa_number LIKE ?`;
      params.push(`%${fa_search}%`);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countStmt = db.prepare(countQuery);
    const countResult = countStmt.get(...params);

    // Add sorting and pagination
    const validSortColumns = ['open_date', 'fa_number', 'wf', 'config', 'priority', 'symptom'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'open_date';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const stmt = db.prepare(query);
    const issues = stmt.all(...params);

    return {
      issues,
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit),
    };
  }

  /**
   * Get sample sizes for a project
   */
  async getSampleSizes(projectId) {
    const db = getDatabase();

    const samples = db.prepare(
      `SELECT * FROM sample_sizes WHERE project_id = ? ORDER BY waterfall`
    ).all(projectId);

    return samples.map((s) => ({
      ...s,
      tests: s.tests ? JSON.parse(s.tests) : [],
      config_samples: s.config_samples ? JSON.parse(s.config_samples) : {},
    }));
  }

  /**
   * Get unique values for filter options
   * Returns all 15 filter dimensions
   */
  async getFilterOptions(projectId) {
    const db = getDatabase();

    // Query all distinct values
    const priorities = db.prepare(
      `SELECT DISTINCT priority FROM issues WHERE project_id = ? AND priority IS NOT NULL AND priority != '' ORDER BY priority`
    ).all(projectId);
    
    const sampleStatuses = db.prepare(
      `SELECT DISTINCT sample_status FROM issues WHERE project_id = ? AND sample_status IS NOT NULL AND sample_status != '' ORDER BY sample_status`
    ).all(projectId);
    
    const departments = db.prepare(
      `SELECT DISTINCT department FROM issues WHERE project_id = ? AND department IS NOT NULL AND department != '' ORDER BY department`
    ).all(projectId);
    
    const wfs = db.prepare(
      `SELECT DISTINCT wf FROM issues WHERE project_id = ? AND wf IS NOT NULL AND wf != '' ORDER BY wf`
    ).all(projectId);
    
    const configs = db.prepare(
      `SELECT DISTINCT config FROM issues WHERE project_id = ? AND config IS NOT NULL AND config != '' ORDER BY config`
    ).all(projectId);
    
    const failedTests = db.prepare(
      `SELECT DISTINCT failed_test FROM issues WHERE project_id = ? AND failed_test IS NOT NULL AND failed_test != '' ORDER BY failed_test`
    ).all(projectId);
    
    const testIds = db.prepare(
      `SELECT DISTINCT test_id FROM issues WHERE project_id = ? AND test_id IS NOT NULL AND test_id != '' ORDER BY test_id`
    ).all(projectId);
    
    const failureTypes = db.prepare(
      `SELECT DISTINCT failure_type FROM issues WHERE project_id = ? AND failure_type IS NOT NULL AND failure_type != '' ORDER BY failure_type`
    ).all(projectId);
    
    const functionCosmetic = db.prepare(
      `SELECT DISTINCT function_or_cosmetic FROM issues WHERE project_id = ? AND function_or_cosmetic IS NOT NULL AND function_or_cosmetic != '' ORDER BY function_or_cosmetic`
    ).all(projectId);
    
    const failedLocations = db.prepare(
      `SELECT DISTINCT failed_location FROM issues WHERE project_id = ? AND failed_location IS NOT NULL AND failed_location != '' ORDER BY failed_location`
    ).all(projectId);
    
    const symptoms = db.prepare(
      `SELECT DISTINCT symptom FROM issues WHERE project_id = ? AND symptom IS NOT NULL AND symptom != '' ORDER BY symptom`
    ).all(projectId);
    
    const faStatuses = db.prepare(
      `SELECT DISTINCT fa_status FROM issues WHERE project_id = ? AND fa_status IS NOT NULL AND fa_status != '' ORDER BY fa_status`
    ).all(projectId);

    return {
      priorities: priorities.map((r) => r.priority),
      sampleStatuses: sampleStatuses.map((r) => r.sample_status),
      departments: departments.map((r) => r.department),
      wfs: wfs.map((r) => r.wf),
      configs: configs.map((r) => r.config),
      failedTests: failedTests.map((r) => r.failed_test),
      testIds: testIds.map((r) => r.test_id),
      failureTypes: failureTypes.map((r) => r.failure_type),
      functionCosmetic: functionCosmetic.map((r) => r.function_or_cosmetic),
      failedLocations: failedLocations.map((r) => r.failed_location),
      symptoms: symptoms.map((r) => r.symptom),
      faStatuses: faStatuses.map((r) => r.fa_status),
    };
  }

  /**
   * Get test analysis (Test ID failure rates by WF)
   */
  async getTestAnalysis(projectId, filters = {}) {
    const db = getDatabase();

    // Get all issues for the project (with filters if provided)
    const issuesResult = await this.getIssues(projectId, { ...filters, page: 1, limit: 100000 });
    const issues = issuesResult.issues;

    // Get sample sizes
    const sampleSizes = await this.getSampleSizes(projectId);

    // Create a map: WF -> { tests, totalSamples, configSamples }
    const wfSampleMap = {};
    sampleSizes.forEach((sample) => {
      const totalSamples = Object.values(sample.config_samples).reduce((sum, val) => sum + val, 0);
      wfSampleMap[sample.waterfall] = {
        tests: sample.tests,
        totalSamples,
        configSamples: sample.config_samples,
      };
    });

    // Group issues by WF and Test ID
    const testStats = {};
    issues.forEach((issue) => {
      if (!issue.test_id || !issue.wf) return;

      const key = `${issue.wf}||${issue.test_id}`;
      if (!testStats[key]) {
        testStats[key] = {
          wf: issue.wf,
          testId: issue.test_id,
          testName: issue.failed_test || '',
          failureCount: 0,
          symptomCounts: {},
        };
      }

      testStats[key].failureCount++;
      
      // Count symptoms
      if (issue.symptom) {
        testStats[key].symptomCounts[issue.symptom] = 
          (testStats[key].symptomCounts[issue.symptom] || 0) + 1;
      }
    });

    // Calculate failure rates and format results
    const results = Object.values(testStats).map((stat) => {
      const wfData = wfSampleMap[stat.wf];
      const totalSamples = wfData ? wfData.totalSamples : 0;
      const failureRate = totalSamples > 0 ? (stat.failureCount / totalSamples) * 1000000 : 0;
      const percentage = issues.length > 0 ? (stat.failureCount / issues.length) * 100 : 0;

      // Get top symptoms
      const topSymptoms = Object.entries(stat.symptomCounts)
        .map(([symptom, count]) => ({ symptom, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      return {
        wf: stat.wf,
        testId: stat.testId,
        testName: stat.testName,
        failureCount: stat.failureCount,
        totalSamples,
        failureRate: Math.round(failureRate),
        percentage: parseFloat(percentage.toFixed(2)),
        topSymptoms,
      };
    });

    // Sort by failure rate descending
    results.sort((a, b) => b.failureRate - a.failureRate);

    return results;
  }

  /**
   * Get or create analysis cache
   */
  async getAnalysisCache(projectId, cacheType) {
    const db = getDatabase();

    const cache = db.prepare(
      `SELECT cache_data FROM analysis_cache WHERE project_id = ? AND cache_type = ?`
    ).get(projectId, cacheType);

    return cache ? JSON.parse(cache.cache_data) : null;
  }

  /**
   * Save analysis cache
   */
  async saveAnalysisCache(projectId, cacheType, cacheData) {
    const db = getDatabase();

    db.prepare(
      `INSERT OR REPLACE INTO analysis_cache (project_id, cache_type, cache_data, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(projectId, cacheType, JSON.stringify(cacheData));
  }
}

module.exports = new AnalysisModel();
