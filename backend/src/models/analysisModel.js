const { getDatabase } = require('./database');
const analysisService = require('../services/analysisService');

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
   * 每个维度查询时会排除自己的筛选条件，但保留其他维度的筛选
   */
  async getFilterOptions(projectId, currentFilters = {}) {
    const db = getDatabase();

    // Helper function to build WHERE clause excluding a specific field
    const buildWhereClause = (excludeField = null) => {
      let whereConditions = ['project_id = ?'];
      let params = [projectId];

      const addArrayFilter = (field, values) => {
        if (field !== excludeField && values && values.length > 0) {
          whereConditions.push(`${field} IN (${values.map(() => '?').join(',')})`);
          params.push(...values);
        }
      };

      // 添加其他维度的筛选条件（排除当前查询的维度）
      if (currentFilters.symptoms && currentFilters.symptoms.length > 0) {
        addArrayFilter('symptom', currentFilters.symptoms);
      }
      if (currentFilters.failed_locations && currentFilters.failed_locations.length > 0) {
        addArrayFilter('failed_location', currentFilters.failed_locations);
      }
      if (currentFilters.wfs && currentFilters.wfs.length > 0) {
        addArrayFilter('wf', currentFilters.wfs);
      }
      if (currentFilters.failed_tests && currentFilters.failed_tests.length > 0) {
        addArrayFilter('failed_test', currentFilters.failed_tests);
      }
      if (currentFilters.configs && currentFilters.configs.length > 0) {
        addArrayFilter('config', currentFilters.configs);
      }
      if (currentFilters.priorities && currentFilters.priorities.length > 0) {
        addArrayFilter('priority', currentFilters.priorities);
      }
      if (currentFilters.fa_statuses && currentFilters.fa_statuses.length > 0) {
        addArrayFilter('fa_status', currentFilters.fa_statuses);
      }
      if (currentFilters.failure_types && currentFilters.failure_types.length > 0) {
        addArrayFilter('failure_type', currentFilters.failure_types);
      }
      if (currentFilters.function_cosmetic && currentFilters.function_cosmetic.length > 0) {
        addArrayFilter('function_or_cosmetic', currentFilters.function_cosmetic);
      }
      if (currentFilters.test_ids && currentFilters.test_ids.length > 0) {
        addArrayFilter('test_id', currentFilters.test_ids);
      }
      if (currentFilters.sample_statuses && currentFilters.sample_statuses.length > 0) {
        addArrayFilter('sample_status', currentFilters.sample_statuses);
      }
      if (currentFilters.departments && currentFilters.departments.length > 0) {
        addArrayFilter('department', currentFilters.departments);
      }

      return { whereClause: whereConditions.join(' AND '), params };
    };

    // 查询每个维度的选项，排除该维度自己的筛选条件
    const { whereClause: prioritiesWhere, params: prioritiesParams } = buildWhereClause('priority');
    const priorities = db.prepare(
      `SELECT DISTINCT priority FROM issues WHERE ${prioritiesWhere} AND priority IS NOT NULL AND priority != '' ORDER BY priority`
    ).all(...prioritiesParams);
    
    const { whereClause: sampleStatusesWhere, params: sampleStatusesParams } = buildWhereClause('sample_status');
    const sampleStatuses = db.prepare(
      `SELECT DISTINCT sample_status FROM issues WHERE ${sampleStatusesWhere} AND sample_status IS NOT NULL AND sample_status != '' ORDER BY sample_status`
    ).all(...sampleStatusesParams);
    
    const { whereClause: departmentsWhere, params: departmentsParams } = buildWhereClause('department');
    const departments = db.prepare(
      `SELECT DISTINCT department FROM issues WHERE ${departmentsWhere} AND department IS NOT NULL AND department != '' ORDER BY department`
    ).all(...departmentsParams);
    
    const { whereClause: wfsWhere, params: wfsParams } = buildWhereClause('wf');
    const wfs = db.prepare(
      `SELECT DISTINCT wf FROM issues WHERE ${wfsWhere} AND wf IS NOT NULL AND wf != '' ORDER BY CAST(wf AS INTEGER), wf`
    ).all(...wfsParams);
    
    const { whereClause: configsWhere, params: configsParams } = buildWhereClause('config');
    const configs = db.prepare(
      `SELECT DISTINCT config FROM issues WHERE ${configsWhere} AND config IS NOT NULL AND config != '' ORDER BY config`
    ).all(...configsParams);
    
    const { whereClause: failedTestsWhere, params: failedTestsParams } = buildWhereClause('failed_test');
    const failedTests = db.prepare(
      `SELECT DISTINCT failed_test FROM issues WHERE ${failedTestsWhere} AND failed_test IS NOT NULL AND failed_test != '' ORDER BY failed_test`
    ).all(...failedTestsParams);
    
    const { whereClause: testIdsWhere, params: testIdsParams } = buildWhereClause('test_id');
    const testIds = db.prepare(
      `SELECT DISTINCT test_id FROM issues WHERE ${testIdsWhere} AND test_id IS NOT NULL AND test_id != '' ORDER BY test_id`
    ).all(...testIdsParams);
    
    const { whereClause: failureTypesWhere, params: failureTypesParams } = buildWhereClause('failure_type');
    const failureTypes = db.prepare(
      `SELECT DISTINCT failure_type FROM issues WHERE ${failureTypesWhere} AND failure_type IS NOT NULL AND failure_type != '' ORDER BY failure_type`
    ).all(...failureTypesParams);
    
    const { whereClause: functionCosmeticWhere, params: functionCosmeticParams } = buildWhereClause('function_or_cosmetic');
    const functionCosmetic = db.prepare(
      `SELECT DISTINCT function_or_cosmetic FROM issues WHERE ${functionCosmeticWhere} AND function_or_cosmetic IS NOT NULL AND function_or_cosmetic != '' ORDER BY function_or_cosmetic`
    ).all(...functionCosmeticParams);
    
    const { whereClause: failedLocationsWhere, params: failedLocationsParams } = buildWhereClause('failed_location');
    const failedLocations = db.prepare(
      `SELECT DISTINCT failed_location FROM issues WHERE ${failedLocationsWhere} AND failed_location IS NOT NULL AND failed_location != '' ORDER BY failed_location`
    ).all(...failedLocationsParams);
    
    const { whereClause: symptomsWhere, params: symptomsParams } = buildWhereClause('symptom');
    const symptoms = db.prepare(
      `SELECT DISTINCT symptom FROM issues WHERE ${symptomsWhere} AND symptom IS NOT NULL AND symptom != '' ORDER BY symptom`
    ).all(...symptomsParams);
    
    const { whereClause: faStatusesWhere, params: faStatusesParams } = buildWhereClause('fa_status');
    const faStatuses = db.prepare(
      `SELECT DISTINCT fa_status FROM issues WHERE ${faStatusesWhere} AND fa_status IS NOT NULL AND fa_status != '' ORDER BY fa_status`
    ).all(...faStatusesParams);

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
   * Get test analysis (Failed Test failure rates)
   * Group by failed_test, calculate total samples from all WFs containing this test
   * 根据筛选条件计算统一的样本总数
   */
  async getTestAnalysis(projectId, filters = {}) {
    // Get issues and sample sizes
    const [issuesResult, sampleSizes] = await Promise.all([
      this.getIssues(projectId, { ...filters, page: 1, limit: 100000 }),
      this.getSampleSizes(projectId),
    ]);

    const issues = issuesResult.issues.filter(issue => 
      issue.fa_status && issue.fa_status.toLowerCase() !== 'retest pass'
    );

    // Use analysisService to calculate test stats
    const wfSampleMap = analysisService.buildWFSampleMap(sampleSizes);
    const testStats = analysisService.calculateTestStats(issues, wfSampleMap, filters);

    // Format for API response
    return testStats.map(stat => ({
      testName: stat.testName,
      testId: stat.testId,
      wfs: stat.wfs,
      failureCount: stat.failureCount,
      specCount: stat.specCount,
      strifeCount: stat.strifeCount,
      specSNCount: stat.specSNCount,  // 用于FR计算的去重SN数量
      strifeSNCount: stat.strifeSNCount,  // 用于FR计算的去重SN数量
      totalSamples: stat.totalSamples,
      failureRate: stat.failureRate,
      specFailureRate: stat.specFailureRate,
      strifeFailureRate: stat.strifeFailureRate,
      percentage: stat.percentage,
    }));
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

  /**
   * Get cross analysis data (dimension1 × dimension2)
   * Supports dimensions: symptom, config, wf, failed_test, failed_location
   */
  async getCrossAnalysis(projectId, dimension1, dimension2, filters = {}) {
    // Validate dimensions
    const validDimensions = ['symptom', 'config', 'wf', 'failed_test', 'failed_location'];
    if (!validDimensions.includes(dimension1) || !validDimensions.includes(dimension2)) {
      throw new Error('Invalid dimension. Allowed: symptom, config, wf, failed_test, failed_location');
    }
    
    if (dimension1 === dimension2) {
      throw new Error('Dimension1 and dimension2 must be different');
    }

    // Get filtered issues
    const issuesResult = await this.getIssues(projectId, { ...filters, limit: 999999 });
    const issues = issuesResult.issues;

    // Get sample sizes
    const sampleSizes = await this.getSampleSizes(projectId);
    
    // Use analysisService to calculate cross stats
    const wfSampleMap = analysisService.buildWFSampleMap(sampleSizes);
    const matrix = analysisService.calculateCrossStats(issues, wfSampleMap, dimension1, dimension2, filters);

    // Collect dimension values
    const dimension1Values = new Set();
    const dimension2Values = new Set();
    matrix.forEach((cell) => {
      dimension1Values.add(cell.dimension1Value);
      dimension2Values.add(cell.dimension2Value);
    });

    // 排序函数：如果是 WF 维度则按数字升序，否则按字母排序
    const sortDimensionValues = (values, dimensionName) => {
      const valuesArray = Array.from(values);
      if (dimensionName === 'wf') {
        return valuesArray.sort((a, b) => {
          const numA = parseInt(a) || 0;
          const numB = parseInt(b) || 0;
          return numA - numB;
        });
      }
      return valuesArray.sort();
    };

    return {
      dimension1,
      dimension2,
      matrix,
      dimension1Values: sortDimensionValues(dimension1Values, dimension1),
      dimension2Values: sortDimensionValues(dimension2Values, dimension2),
    };
  }

  /**
   * Get filter statistics for筛选结果页面
   */
  async getFilterStatistics(projectId, filters = {}, includeTrend = false) {
    // Get filtered issues
    const issuesResult = await this.getIssues(projectId, { ...filters, limit: 999999 });
    const issues = issuesResult.issues;

    // Get sample sizes
    const sampleSizes = await this.getSampleSizes(projectId);
    
    // Use analysisService to calculate filter stats
    const wfSampleMap = analysisService.buildWFSampleMap(sampleSizes);
    return analysisService.calculateFilterStats(issues, wfSampleMap, filters, includeTrend);
  }

  /**
   * 获取失败率矩阵数据：按 WF/Test/Config 维度
   * 返回结构：{ wfs: [...], tests: [...], configs: [...], matrix: {...} }
   * matrix 格式：{ "wf-testIndex": { "config": "failureCount/totalSamples" } }
   */
  async getFailureRateMatrix(projectId, filters = {}) {
    const db = getDatabase();

    // 获取所有 issues（支持筛选）
    const issuesResult = await this.getIssues(projectId, { ...filters, page: 1, limit: 100000 });
    const issues = issuesResult.issues;

    // 获取 sample sizes（包含 tests 信息）
    const sampleSizes = await this.getSampleSizes(projectId);

    // 按 WF 排序
    const sortedSampleSizes = sampleSizes.sort((a, b) => {
      const numA = parseInt(a.waterfall) || 0;
      const numB = parseInt(b.waterfall) || 0;
      return numA - numB;
    });

    // 收集所有 WFs 和 Tests
    const wfs = sortedSampleSizes.map(s => s.waterfall);
    const testsSet = new Set();
    const testsByWf = {}; // { wf: [{ testId, testName }] }

    sortedSampleSizes.forEach(sample => {
      testsByWf[sample.waterfall] = sample.tests || [];
      (sample.tests || []).forEach(test => {
        testsSet.add(test.testName);
      });
    });

    const tests = Array.from(testsSet);
    const configs = ['R1CASN', 'R2CBCN', 'R3CBCN', 'R4FNSN'];

    // 构建失败数据映射：{ "wf-testName-config": { spec: count, strife: count } }
    // 打造一个一轃一应表：{ testName: wf }
    const testToWfMap = {}; // { testName: wf }
    sortedSampleSizes.forEach(sample => {
      const tests = sample.tests || [];
      tests.forEach(testObj => {
        testToWfMap[testObj.testName] = sample.waterfall;
      });
    });

    // 构建失败数据映射：{ "wf-testName-config": { spec: SNs Set, strife: SNs Set } }
    // 关键：一个issue只计算一次，不要重复统计，基于SN去重
    const failureMap = {};
    const processedIssues = new Set(); // 防止重复计算
    
    issues.forEach(issue => {
      if (!issue.failed_test || !issue.config) return;
      
      // 创建唯一的issue标识，防止同一个issue被多次统计
      const issueId = issue.fa_number;
      if (processedIssues.has(issueId)) return;
      processedIssues.add(issueId);
      
      // 通过 failed_test 查找对应的 WF（该test属于的WF）
      const wf = testToWfMap[issue.failed_test];
      if (!wf) {
        // 如果找不到对应 WF，说明数据不一致，跳过
        return;
      }
      
      const key = `${issue.wf}-${issue.failed_test}-${issue.config}`;
      if (!failureMap[key]) {
        failureMap[key] = { specSNs: new Set(), strifeSNs: new Set() };
      }
      
      // 按失败类型统计，基于SN去重
      const sn = issue.sn || issue.fa_number;
      const failureType = issue.failure_type ? String(issue.failure_type).trim() : '';
      if ((failureType === 'Spec.' || failureType === 'Spec') && sn) {
        failureMap[key].specSNs.add(sn);
      } else if (failureType === 'Strife' && sn) {
        failureMap[key].strifeSNs.add(sn);
      }
    });
    
    console.log('=== Failure Rate Matrix Debug ===');
    console.log('Issues count:', issues.length);
    console.log('Processed issues:', processedIssues.size);
    console.log('failureMap entries:', Object.keys(failureMap).length);
    console.log('Sample failureMap entries:', Object.entries(failureMap).slice(0, 3));
    console.log('testToWfMap:', Object.keys(testToWfMap).length, 'tests mapped');
    console.log('Sample testToWfMap:', Object.entries(testToWfMap).slice(0, 3));

    // 构建矩阵数据
    const matrix = {};
    
    wfs.forEach(wf => {
      const wfTests = testsByWf[wf] || [];
      const sampleSize = sortedSampleSizes.find(s => s.waterfall === wf);
      const configSamples = sampleSize?.config_samples || {};

      // 为每个 Test 建立映射（按顺序）
      wfTests.forEach((testObj, testIdx) => {
        const testName = testObj.testName;
        const matrixKey = `${wf}-${testIdx}`; // 使用索引作为 key
        matrix[matrixKey] = {
          testName,
          testId: testObj.testId,
          configs: {}
        };

        // 为每个 Config 填充数据
        configs.forEach(config => {
          const failureKey = `${wf}-${testName}-${config}`;
          const failureCounts = failureMap[failureKey] || { specSNs: new Set(), strifeSNs: new Set() };
          const totalSamples = configSamples[config] || 0;
          
          // 优先显示 Spec Failure，其次是 Strife
          const specCount = failureCounts.specSNs.size || 0;
          const strifeCount = failureCounts.strifeSNs.size || 0;
          
          if (specCount > 0) {
            // 有 Spec Failure：显示为 xxF/xxT
            matrix[matrixKey].configs[config] = {
              text: `${specCount}F/${totalSamples}T`,
              type: 'spec',
            };
          } else if (strifeCount > 0) {
            // 仅有 Strife：显示为 xxSF/xxT
            matrix[matrixKey].configs[config] = {
              text: `${strifeCount}SF/${totalSamples}T`,
              type: 'strife',
            };
          } else if (totalSamples > 0) {
            // 没有失败，但有样本：0F/xxT
            matrix[matrixKey].configs[config] = {
              text: `0F/${totalSamples}T`,
              type: 'none',
            };
          } else {
            // 没有任何数据
            matrix[matrixKey].configs[config] = null;
          }
        });
      });
    });

    return {
      wfs,
      tests: ['Test1', 'Test2', 'Test3'], // 固定 3 个测试分组
      configs,
      matrix,
      testsByWf, // 保留 WF 和 Test 的映射关系
    };
  }
}

module.exports = new AnalysisModel();
