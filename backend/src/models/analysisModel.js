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
      `SELECT DISTINCT wf FROM issues WHERE ${wfsWhere} AND wf IS NOT NULL AND wf != '' ORDER BY wf`
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
    const db = getDatabase();

    // Get all issues for the project (with filters if provided)
    const issuesResult = await this.getIssues(projectId, { ...filters, page: 1, limit: 100000 });
    const issues = issuesResult.issues;

    // Get sample sizes
    const sampleSizes = await this.getSampleSizes(projectId);

    // Create a map: WF -> totalSamples
    const wfSampleMap = {};
    // Create a map: test -> Set of WFs containing this test
    const testToWFsMap = {};
    
    sampleSizes.forEach((sample) => {
      const totalSamples = Object.values(sample.config_samples).reduce((sum, val) => sum + val, 0);
      wfSampleMap[sample.waterfall] = totalSamples;
      
      // Map each test to its WFs
      if (sample.tests && Array.isArray(sample.tests)) {
        sample.tests.forEach((testObj) => {
          const testName = testObj.testName;
          if (testName) {
            if (!testToWFsMap[testName]) {
              testToWFsMap[testName] = new Set();
            }
            testToWFsMap[testName].add(sample.waterfall);
          }
        });
      }
    });

    // Group issues by failed_test
    const testStats = {};
    issues.forEach((issue) => {
      if (!issue.failed_test) return;

      const testName = issue.failed_test;
      if (!testStats[testName]) {
        testStats[testName] = {
          testName,
          failureCount: 0,
          specCount: 0,
          strifeCount: 0,
          wfs: new Set(),
          symptomCounts: {},
        };
      }

      testStats[testName].failureCount++;
      
      // Count by failure type
      if (issue.failure_type === 'Spec.') {
        testStats[testName].specCount++;
      } else if (issue.failure_type === 'Strife') {
        testStats[testName].strifeCount++;
      }
      
      // Track WFs where this test failed
      if (issue.wf) {
        testStats[testName].wfs.add(issue.wf);
      }
      
      // Count symptoms
      if (issue.symptom) {
        testStats[testName].symptomCounts[issue.symptom] = 
          (testStats[testName].symptomCounts[issue.symptom] || 0) + 1;
      }
    });

    // Calculate failure rates and format results
    const results = Object.values(testStats).map((stat) => {
      // 为每个测试项独立计算总样品数
      // 找出包含这个测试的所有WF，然后根据筛选条件计算样品总数
      let totalSamples = 0;
      const wfsForTest = testToWFsMap[stat.testName] || new Set();
      
      // 根据筛选条件过滤WF
      let filteredWFs = wfsForTest;
      if (filters.wfs && filters.wfs.length > 0) {
        // 如果有WF筛选条件，取交集
        const filterWFSet = new Set(filters.wfs);
        filteredWFs = new Set([...wfsForTest].filter(wf => filterWFSet.has(wf)));
      }
      
      // 计算这些WF的总样品数
      filteredWFs.forEach((wf) => {
        if (wfSampleMap[wf]) {
          // 如果有Config筛选条件，只计算这些Config的样品数
          if (filters.configs && filters.configs.length > 0) {
            const sample = wfSampleMap[wf];
            if (sample && sample.configSamples) {
              filters.configs.forEach((config) => {
                totalSamples += sample.configSamples[config] || 0;
              });
            }
          } else {
            // 没有Config筛选条件，计算该WF的所有样品数
            totalSamples += wfSampleMap[wf];
          }
        }
      });
      
      const failureRate = totalSamples > 0 ? (stat.failureCount / totalSamples) * 1000000 : 0;
      const specFailureRate = totalSamples > 0 ? (stat.specCount / totalSamples) * 1000000 : 0;
      const percentage = issues.length > 0 ? (stat.failureCount / issues.length) * 100 : 0;

      // Get top symptoms
      const topSymptoms = Object.entries(stat.symptomCounts)
        .map(([symptom, count]) => ({ symptom, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Get WF list as string
      const wfList = Array.from(stat.wfs).sort().join(', ');

      return {
        testName: stat.testName,
        wfs: wfList, // WFs where this test failed
        failureCount: stat.failureCount,
        specCount: stat.specCount,
        strifeCount: stat.strifeCount,
        totalSamples,
        failureRate: Math.round(failureRate),
        specFailureRate: Math.round(specFailureRate),
        percentage: parseFloat(percentage.toFixed(2)),
        topSymptoms,
      };
    });

    // Sort by spec failure rate descending
    results.sort((a, b) => b.specFailureRate - a.specFailureRate);

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

  /**
   * Get cross analysis data (dimension1 × dimension2)
   * Supports dimensions: symptom, config, wf, failed_test, test_id
   */
  async getCrossAnalysis(projectId, dimension1, dimension2, filters = {}) {
    const db = getDatabase();
    
    // Validate dimensions
    const validDimensions = ['symptom', 'config', 'wf', 'failed_test', 'test_id'];
    if (!validDimensions.includes(dimension1) || !validDimensions.includes(dimension2)) {
      throw new Error('Invalid dimension. Allowed: symptom, config, wf, failed_test, test_id');
    }
    
    if (dimension1 === dimension2) {
      throw new Error('Dimension1 and dimension2 must be different');
    }

    // Get filtered issues
    const issuesResult = await this.getIssues(projectId, { ...filters, limit: 999999 });
    const issues = issuesResult.issues;

    // Get sample sizes
    const sampleSizes = await this.getSampleSizes(projectId);
    
    // Build comprehensive sample size mapping
    const wfSampleMap = {};
    const configTotalSampleMap = {}; // Config -> 该Config在所有WF中的总样本数
    let projectTotalSamples = 0; // 整个项目的总样本数
    
    sampleSizes.forEach((sample) => {
      const wfTotal = Object.values(sample.config_samples).reduce((sum, val) => sum + val, 0);
      wfSampleMap[sample.waterfall] = wfTotal;
      projectTotalSamples += wfTotal;
      
      // 累计每个Config的总样本数
      Object.entries(sample.config_samples).forEach(([config, size]) => {
        configTotalSampleMap[config] = (configTotalSampleMap[config] || 0) + size;
      });
    });

    // Group by two dimensions
    const crossMap = {};
    const dimension1Values = new Set();
    const dimension2Values = new Set();

    issues.forEach((issue) => {
      const dim1Value = issue[dimension1];
      const dim2Value = issue[dimension2];
      
      if (!dim1Value || !dim2Value) return;

      dimension1Values.add(dim1Value);
      dimension2Values.add(dim2Value);

      const key = `${dim1Value}||${dim2Value}`;
      if (!crossMap[key]) {
        crossMap[key] = {
          dimension1Value: dim1Value,
          dimension2Value: dim2Value,
          totalCount: 0,
          specCount: 0,
          strifeCount: 0,
        };
      }

      crossMap[key].totalCount++;
      
      // Count by failure type
      if (issue.failure_type === 'Spec.') {
        crossMap[key].specCount++;
      } else if (issue.failure_type === 'Strife') {
        crossMap[key].strifeCount++;
      }
    });

    // Calculate failure rates and format results
    const matrix = Object.values(crossMap).map((cell) => {
      // 根据维度类型计算总样本数
      let totalSamples = 0;
      
      if (dimension1 === 'config') {
        // config × 其他维度：使用该config在所有WF中的总样本数
        totalSamples = configTotalSampleMap[cell.dimension1Value] || 0;
      } else if (dimension2 === 'config') {
        // 其他维度 × config：使用该config在所有WF中的总样本数
        totalSamples = configTotalSampleMap[cell.dimension2Value] || 0;
      } else {
        // 两个维度都不是config：使用整个项目的总样本数
        totalSamples = projectTotalSamples;
      }

      // Calculate percentage of total issues
      const percentage = issues.length > 0 ? (cell.totalCount / issues.length) * 100 : 0;

      return {
        dimension1Value: cell.dimension1Value,
        dimension2Value: cell.dimension2Value,
        totalCount: cell.totalCount,
        specCount: cell.specCount,
        strifeCount: cell.strifeCount,
        percentage: parseFloat(percentage.toFixed(2)),
        totalSamples,
        totalFailureRate: totalSamples > 0 ? `${cell.specCount}F+${cell.strifeCount}SF/${totalSamples}T` : 'N/A',
        specFailureRate: totalSamples > 0 ? `${cell.specCount}F/${totalSamples}T` : 'N/A',
        strifeFailureRate: totalSamples > 0 ? `${cell.strifeCount}SF/${totalSamples}T` : 'N/A',
      };
    });

    // Sort by total count descending
    matrix.sort((a, b) => b.totalCount - a.totalCount);

    return {
      dimension1,
      dimension2,
      matrix,
      dimension1Values: Array.from(dimension1Values).sort(),
      dimension2Values: Array.from(dimension2Values).sort(),
    };
  }

  /**
   * Get filter statistics for筛选结果页面
   */
  async getFilterStatistics(projectId, filters = {}, includeTrend = false) {
    const db = getDatabase();

    // Get filtered issues
    const issuesResult = await this.getIssues(projectId, { ...filters, limit: 999999 });
    const issues = issuesResult.issues;

    // Get sample sizes with full details
    const sampleSizes = await this.getSampleSizes(projectId);
    const wfSampleMap = {};
    const wfConfigSampleMap = {};  // WF -> Config -> Sample count
    const testToWFsMap = {};  // Test -> Set of WFs
    
    sampleSizes.forEach((sample) => {
      const totalSamples = Object.values(sample.config_samples).reduce((sum, val) => sum + val, 0);
      wfSampleMap[sample.waterfall] = totalSamples;
      wfConfigSampleMap[sample.waterfall] = sample.config_samples;
      
      // Build test -> WFs mapping
      if (sample.tests && Array.isArray(sample.tests)) {
        sample.tests.forEach((testObj) => {
          const testName = testObj.testName;
          if (testName) {
            if (!testToWFsMap[testName]) {
              testToWFsMap[testName] = new Set();
            }
            testToWFsMap[testName].add(sample.waterfall);
          }
        });
      }
    });

    // Helper function: 根据筛选条件计算样本总数
    const calculateTotalSamples = (filterConditions) => {
      let total = 0;
      const { wfs, configs, failed_tests } = filterConditions;

      // 确定需要计算的WF集合
      let targetWFs = new Set();

      if (failed_tests && failed_tests.length > 0) {
        // 如果有failed_test筛选，找出包含这些test的所有WF
        failed_tests.forEach((testName) => {
          const wfsForTest = testToWFsMap[testName];
          if (wfsForTest) {
            wfsForTest.forEach(wf => targetWFs.add(wf));
          }
        });
        // 如果同时有WF筛选，取交集
        if (wfs && wfs.length > 0) {
          const wfsSet = new Set(wfs);
          targetWFs = new Set([...targetWFs].filter(wf => wfsSet.has(wf)));
        }
      } else if (wfs && wfs.length > 0) {
        // 只有WF筛选
        wfs.forEach(wf => targetWFs.add(wf));
      } else {
        // 没有WF和failed_test筛选，使用所有WF
        Object.keys(wfSampleMap).forEach(wf => targetWFs.add(wf));
      }

      // 计算样本总数
      if (configs && configs.length > 0) {
        // 有Config筛选：只计算这些Config的样本数
        targetWFs.forEach((wf) => {
          const configSamples = wfConfigSampleMap[wf];
          if (configSamples) {
            configs.forEach((config) => {
              total += configSamples[config] || 0;
            });
          }
        });
      } else {
        // 没有Config筛选：计算所有Config的样本数
        targetWFs.forEach((wf) => {
          total += wfSampleMap[wf] || 0;
        });
      }

      return total;
    };

    // Basic statistics
    const totalCount = issues.length;
    let specCount = 0;
    let strifeCount = 0;
    const wfsSet = new Set();
    const configsSet = new Set();
    const symptomsSet = new Set();

    issues.forEach((issue) => {
      if (issue.failure_type === 'Spec.') specCount++;
      if (issue.failure_type === 'Strife') strifeCount++;
      if (issue.wf) wfsSet.add(issue.wf);
      if (issue.config) configsSet.add(issue.config);
      if (issue.symptom) symptomsSet.add(issue.symptom);
    });

    // Symptom distribution
    const symptomMap = {};
    issues.forEach((issue) => {
      if (!issue.symptom) return;
      if (!symptomMap[issue.symptom]) {
        symptomMap[issue.symptom] = { totalCount: 0, specCount: 0, strifeCount: 0, wfs: new Set() };
      }
      symptomMap[issue.symptom].totalCount++;
      if (issue.failure_type === 'Spec.') symptomMap[issue.symptom].specCount++;
      if (issue.failure_type === 'Strife') symptomMap[issue.symptom].strifeCount++;
      if (issue.wf) symptomMap[issue.symptom].wfs.add(issue.wf);
    });

    // 计算统一的样本总数（根据筛选条件）
    const globalTotalSamples = calculateTotalSamples(filters);

    const symptomDistribution = Object.entries(symptomMap).map(([symptom, data]) => {
      return {
        symptom,
        totalCount: data.totalCount,
        specCount: data.specCount,
        strifeCount: data.strifeCount,
        totalSamples: globalTotalSamples,
        percentage: parseFloat(((data.totalCount / totalCount) * 100).toFixed(2)),
        specRate: globalTotalSamples > 0 ? `${data.specCount}F/${globalTotalSamples}T` : 'N/A',
        strifeRate: globalTotalSamples > 0 ? `${data.strifeCount}SF/${globalTotalSamples}T` : 'N/A',
        specFailureRate: globalTotalSamples > 0 ? Math.round((data.specCount / globalTotalSamples) * 1000000) : 0,
      };
    }).sort((a, b) => b.specFailureRate - a.specFailureRate);

    // WF distribution
    const wfMap = {};
    issues.forEach((issue) => {
      if (!issue.wf) return;
      if (!wfMap[issue.wf]) {
        wfMap[issue.wf] = { totalCount: 0, specCount: 0, strifeCount: 0 };
      }
      wfMap[issue.wf].totalCount++;
      if (issue.failure_type === 'Spec.') wfMap[issue.wf].specCount++;
      if (issue.failure_type === 'Strife') wfMap[issue.wf].strifeCount++;
    });

    const wfDistribution = Object.entries(wfMap).map(([wf, data]) => {
      // 对于WF分布，使用该WF的样本数
      const totalSamples = wfSampleMap[wf] || 0;
      return {
        wf,
        totalCount: data.totalCount,
        specCount: data.specCount,
        strifeCount: data.strifeCount,
        percentage: parseFloat(((data.totalCount / totalCount) * 100).toFixed(2)),
        totalSamples,
        specRate: totalSamples > 0 ? `${data.specCount}F/${totalSamples}T` : 'N/A',
        strifeRate: totalSamples > 0 ? `${data.strifeCount}SF/${totalSamples}T` : 'N/A',
        specFailureRate: totalSamples > 0 ? Math.round((data.specCount / totalSamples) * 1000000) : 0,
      };
    }).sort((a, b) => b.specFailureRate - a.specFailureRate);

    // Config distribution
    const configMap = {};
    issues.forEach((issue) => {
      if (!issue.config) return;
      if (!configMap[issue.config]) {
        configMap[issue.config] = { totalCount: 0, specCount: 0, strifeCount: 0 };
      }
      configMap[issue.config].totalCount++;
      if (issue.failure_type === 'Spec.') configMap[issue.config].specCount++;
      if (issue.failure_type === 'Strife') configMap[issue.config].strifeCount++;
    });

    const configDistribution = Object.entries(configMap).map(([config, data]) => ({
      config,
      totalCount: data.totalCount,
      specCount: data.specCount,
      strifeCount: data.strifeCount,
      percentage: parseFloat(((data.totalCount / totalCount) * 100).toFixed(2)),
    })).sort((a, b) => b.totalCount - a.totalCount);

    // Failure type distribution
    // 使用统一的样本总数计算函数
    const totalSamples = globalTotalSamples;

    const failureTypeDistribution = [
      {
        type: 'Spec.',
        count: specCount,
        percentage: totalCount > 0 ? parseFloat(((specCount / totalCount) * 100).toFixed(2)) : 0,
        rate: totalSamples > 0 ? `${specCount}F/${totalSamples}T` : 'N/A',
      },
      {
        type: 'Strife',
        count: strifeCount,
        percentage: totalCount > 0 ? parseFloat(((strifeCount / totalCount) * 100).toFixed(2)) : 0,
        rate: totalSamples > 0 ? `${strifeCount}SF/${totalSamples}T` : 'N/A',
      },
    ];

    // Function/Cosmetic distribution
    const functionCosmeticMap = {};
    issues.forEach((issue) => {
      const category = issue.function_or_cosmetic || '未知';
      functionCosmeticMap[category] = (functionCosmeticMap[category] || 0) + 1;
    });

    const functionCosmeticDistribution = Object.entries(functionCosmeticMap).map(([category, count]) => ({
      category,
      count,
      percentage: totalCount > 0 ? parseFloat(((count / totalCount) * 100).toFixed(2)) : 0,
    })).sort((a, b) => b.count - a.count);

    // FA Status distribution
    const faStatusMap = {};
    issues.forEach((issue) => {
      const status = issue.fa_status || '未知';
      faStatusMap[status] = (faStatusMap[status] || 0) + 1;
    });

    const faStatusDistribution = Object.entries(faStatusMap).map(([status, count]) => ({
      status,
      count,
      percentage: totalCount > 0 ? parseFloat(((count / totalCount) * 100).toFixed(2)) : 0,
    })).sort((a, b) => b.count - a.count);

    const statistics = {
      totalCount,
      specCount,
      strifeCount,
      uniqueWFs: wfsSet.size,
      uniqueConfigs: configsSet.size,
      uniqueSymptoms: symptomsSet.size,
      totalSamples,
      wfList: Array.from(wfsSet).sort(),
      configList: Array.from(configsSet).sort(),
      symptomDistribution,
      wfDistribution,
      configDistribution,
      failureTypeDistribution,
      functionCosmeticDistribution,
      faStatusDistribution,
    };

    const result = { statistics };

    // Time trend (optional)
    if (includeTrend && filters.date_from && filters.date_to) {
      const dateFrom = new Date(filters.date_from);
      const dateTo = new Date(filters.date_to);
      const daysDiff = Math.ceil((dateTo - dateFrom) / (1000 * 60 * 60 * 24));

      let granularity = 'day';
      if (daysDiff > 60) granularity = 'month';
      else if (daysDiff > 7) granularity = 'week';

      // Group by date
      const dateMap = {};
      issues.forEach((issue) => {
        if (!issue.open_date) return;
        const date = new Date(issue.open_date);
        let dateKey;

        if (granularity === 'day') {
          dateKey = date.toISOString().split('T')[0];
        } else if (granularity === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          dateKey = weekStart.toISOString().split('T')[0];
        } else {
          dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!dateMap[dateKey]) {
          dateMap[dateKey] = { totalCount: 0, specCount: 0, strifeCount: 0 };
        }
        dateMap[dateKey].totalCount++;
        if (issue.failure_type === 'Spec.') dateMap[dateKey].specCount++;
        if (issue.failure_type === 'Strife') dateMap[dateKey].strifeCount++;
      });

      const data = Object.entries(dateMap).map(([date, counts]) => ({
        date,
        ...counts,
      })).sort((a, b) => a.date.localeCompare(b.date));

      result.timeTrend = {
        enabled: true,
        granularity,
        data,
      };
    }

    return result;
  }
}

module.exports = new AnalysisModel();
