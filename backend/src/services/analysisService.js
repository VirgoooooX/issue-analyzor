const analysisModel = require('../models/analysisModel');

/**
 * Analysis Service - Business logic for data analysis and statistics calculation
 */
class AnalysisService {
  /**
   * Calculate comprehensive analysis for a project
   * 根据筛选条件计算样本总数
   */
  async calculateProjectAnalysis(projectId, filters = {}) {
    const [issues, sampleSizes] = await Promise.all([
      analysisModel.getIssues(projectId, { ...filters, limit: 999999 }),
      analysisModel.getSampleSizes(projectId),
    ]);

    // 排除 FA Status 为 "retest pass" 的 issues
    const allIssues = issues.issues.filter(issue => 
      issue.fa_status && issue.fa_status.toLowerCase() !== 'retest pass'
    );

    // Build WF -> Sample Size mapping
    const wfSampleMap = this.buildWFSampleMap(sampleSizes);

    // Calculate各维度统计
    const symptomStats = this.calculateSymptomStats(allIssues, wfSampleMap, filters);
    const wfStats = this.calculateWFStats(allIssues, wfSampleMap, filters);
    const configStats = this.calculateConfigStats(allIssues, wfSampleMap);
    const testStats = this.calculateTestStats(allIssues, wfSampleMap, filters);
    const overview = this.calculateOverview(allIssues, wfSampleMap, filters);
    const failureTypeStats = this.calculateFailureTypeStats(allIssues);
    const functionCosmeticStats = this.calculateFunctionCosmeticStats(allIssues);
    const faStatusStats = this.calculateFAStatusStats(issues.issues); // 使用全部issues统计FA Status

    return {
      overview,
      symptomStats,
      wfStats,
      configStats,
      testStats,
      failureTypeStats,
      functionCosmeticStats,
      faStatusStats, // 新增
    };
  }

  /**
   * Calculate total samples for a specific WF based on filters
   * 根据筛选条件计算特定WF的样本数
   */
  calculateWFSampleSize(wf, wfSampleMap, filters = {}) {
    const sample = wfSampleMap.get(wf);
    if (!sample) return 0;

    const { configs } = filters;
    
    if (configs && configs.length > 0) {
      // 有Config筛选：只计算这些Config的样本数
      let total = 0;
      configs.forEach((config) => {
        total += sample.configSamples[config] || 0;
      });
      return total;
    } else {
      // 没有Config筛选：计算该WF的所有样本数
      return sample.totalSamples || 0;
    }
  }

  /**
   * Calculate total samples based on filters
   * 根据筛选条件计算样本总数
   */
  calculateTotalSamples(wfSampleMap, filters = {}) {
    let total = 0;
    const { wfs, configs, failed_tests } = filters;

    // 确定需要计算的WF集合
    let targetWFs = new Set();

    if (failed_tests && failed_tests.length > 0) {
      // 如果有failed_test筛选，找出包含这些test的所有WF
      // 需要构建test -> WFs的映射
      const testToWFsMap = {};
      wfSampleMap.forEach((sample, wf) => {
        if (sample.tests && Array.isArray(sample.tests)) {
          sample.tests.forEach((testObj) => {
            const testName = testObj.testName;
            if (testName) {
              if (!testToWFsMap[testName]) {
                testToWFsMap[testName] = new Set();
              }
              testToWFsMap[testName].add(wf);
            }
          });
        }
      });

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
      wfSampleMap.forEach((sample, wf) => targetWFs.add(wf));
    }

    // 计算样本总数
    if (configs && configs.length > 0) {
      // 有Config筛选：只计算这些Config的样本数
      targetWFs.forEach((wf) => {
        const sample = wfSampleMap.get(wf);
        if (sample && sample.configSamples) {
          configs.forEach((config) => {
            total += sample.configSamples[config] || 0;
          });
        }
      });
    } else {
      // 没有Config筛选：计算所有Config的样本数
      targetWFs.forEach((wf) => {
        const sample = wfSampleMap.get(wf);
        if (sample) {
          total += sample.totalSamples || 0;
        }
      });
    }

    return total;
  }

  /**
   * Build WF -> Sample Size mapping
   */
  buildWFSampleMap(sampleSizes) {
    const map = new Map();

    sampleSizes.forEach((sample) => {
      map.set(sample.waterfall, {
        tests: sample.tests,
        testName: sample.test_name || '', // 添加 testName
        configSamples: sample.config_samples,
        totalSamples: Object.values(sample.config_samples).reduce((sum, val) => sum + val, 0),
      });
    });

    return map;
  }

  /**
   * Calculate overview statistics
   * 根据筛选条件计算样本总数
   * 基于 SN 去重计算 Failure Rate
   */
  calculateOverview(issues, wfSampleMap, filters = {}) {
    const totalIssues = issues.length;
    
    // 基于 SN 去重计算 Spec 和 Strife 失败数
    const uniqueSpecSNs = new Set();
    const uniqueStrifeSNs = new Set();
    
    issues.forEach((issue) => {
      const sn = issue.sn || issue.fa_number; // 使用 SN 或 FA# 作为唯一标识
      if (issue.failure_type === 'Spec.' && sn) {
        uniqueSpecSNs.add(sn);
      } else if (issue.failure_type === 'Strife' && sn) {
        uniqueStrifeSNs.add(sn);
      }
    });
    
    const specIssues = uniqueSpecSNs.size;  // 去重后的 Spec 失败数
    const strifeIssues = uniqueStrifeSNs.size;  // 去重后的 Strife 失败数
    
    const uniqueSymptoms = new Set(issues.map((i) => i.symptom).filter(Boolean)).size;
    // 总WF数应该从WF Sample Size sheet获取（即wfSampleMap的大小）
    const uniqueWFs = wfSampleMap.size;
    const uniqueConfigs = new Set(issues.map((i) => i.config).filter(Boolean)).size;

    // Calculate overall failure rate based on filters
    const totalSampleSize = this.calculateTotalSamples(wfSampleMap, filters);

    const overallFailureRate = totalSampleSize > 0 ? Math.round((totalIssues / totalSampleSize) * 1000000) : 0;
    const specFailureRate = totalSampleSize > 0 ? Math.round((specIssues / totalSampleSize) * 1000000) : 0;
    const strifeFailureRate = totalSampleSize > 0 ? Math.round((strifeIssues / totalSampleSize) * 1000000) : 0;

    return {
      totalIssues,
      specIssues,
      strifeIssues,
      uniqueSymptoms,
      uniqueWFs,
      uniqueConfigs,
      totalSampleSize,
      overallFailureRate,
      specFailureRate,
      strifeFailureRate,
    };
  }

  /**
   * Calculate Symptom dimension statistics
   * 根据筛选条件计算样本总数
   * 基于 SN 去重计算 Failure Rate
   */
  calculateSymptomStats(issues, wfSampleMap, filters = {}) {
    const symptomMap = new Map();

    issues.forEach((issue) => {
      if (!issue.symptom) return;

      if (!symptomMap.has(issue.symptom)) {
        symptomMap.set(issue.symptom, {
          symptom: issue.symptom,
          count: 0,
          specSNs: new Set(),  // 基于 SN 去重
          strifeSNs: new Set(),  // 基于 SN 去重
          wfs: new Set(),
          configs: new Set(),
        });
      }

      const stat = symptomMap.get(issue.symptom);
      stat.count++;
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) stat.specSNs.add(sn);
      if (issue.failure_type === 'Strife' && sn) stat.strifeSNs.add(sn);
      if (issue.wf) stat.wfs.add(issue.wf);
      if (issue.config) stat.configs.add(issue.config);
    });

    // Calculate total samples based on filters
    const totalSamples = this.calculateTotalSamples(wfSampleMap, filters);

    // Calculate failure rate for each symptom
    return Array.from(symptomMap.values())
      .map((stat) => {
        return {
          symptom: stat.symptom,
          count: stat.count,
          specCount: stat.specSNs.size,  // 基于 SN 去重
          strifeCount: stat.strifeSNs.size,  // 基于 SN 去重
          totalSamples: totalSamples,
          failureRate: totalSamples > 0 ? Math.round((stat.count / totalSamples) * 1000000) : 0,
          specFailureRate: totalSamples > 0 ? Math.round((stat.specSNs.size / totalSamples) * 1000000) : 0,
          strifeFailureRate: totalSamples > 0 ? Math.round((stat.strifeSNs.size / totalSamples) * 1000000) : 0,
          affectedWFs: stat.wfs.size,
          affectedConfigs: stat.configs.size,
        };
      })
      .sort((a, b) => b.specFailureRate - a.specFailureRate); // 按Spec失败率排序
  }

  /**
   * Calculate WF dimension statistics
   * 根据筛选条件计算WF的样本数
   * 基于 SN 去重计算 Failure Rate
   */
  calculateWFStats(issues, wfSampleMap, filters = {}) {
    const wfMap = new Map();

    issues.forEach((issue) => {
      if (!issue.wf) return;

      if (!wfMap.has(issue.wf)) {
        wfMap.set(issue.wf, {
          wf: issue.wf,
          count: 0,
          specSNs: new Set(),  // 基于 SN 去重
          strifeSNs: new Set(),  // 基于 SN 去重
          symptoms: new Map(),
          configs: new Map(),
        });
      }

      const stat = wfMap.get(issue.wf);
      stat.count++;
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) stat.specSNs.add(sn);
      if (issue.failure_type === 'Strife' && sn) stat.strifeSNs.add(sn);

      // Count symptoms
      if (issue.symptom) {
        stat.symptoms.set(issue.symptom, (stat.symptoms.get(issue.symptom) || 0) + 1);
      }

      // Count configs
      if (issue.config) {
        stat.configs.set(issue.config, (stat.configs.get(issue.config) || 0) + 1);
      }
    });

    // Calculate failure rate for each WF based on filters
    return Array.from(wfMap.values())
      .map((stat) => {
        // 根据筛选条件计算该WF的样本数
        const totalSamples = this.calculateWFSampleSize(stat.wf, wfSampleMap, filters);
        const sample = wfSampleMap.get(stat.wf);
        const testName = sample ? sample.testName : ''; // 从 WF Sample Size 获取 test name

        // Top symptoms
        const topSymptoms = Array.from(stat.symptoms.entries())
          .map(([symptom, count]) => ({ symptom, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Config breakdown
        const configBreakdown = {};
        stat.configs.forEach((count, config) => {
          const configSampleSize = sample && sample.configSamples[config] ? sample.configSamples[config] : 0;
          configBreakdown[config] = {
            count,
            sampleSize: configSampleSize,
            rate: configSampleSize > 0 ? Math.round((count / configSampleSize) * 1000000) : 0,
          };
        });

        return {
          wf: stat.wf,
          testName, // 添加 testName
          totalTests: totalSamples, // 使用根据筛选条件计算的样本数
          failureCount: stat.count,
          specCount: stat.specSNs.size,  // 基于 SN 去重
          strifeCount: stat.strifeSNs.size,  // 基于 SN 去重
          failureRate: totalSamples > 0 ? Math.round((stat.count / totalSamples) * 1000000) : 0,
          specFailureRate: totalSamples > 0 ? Math.round((stat.specSNs.size / totalSamples) * 1000000) : 0,
          strifeFailureRate: totalSamples > 0 ? Math.round((stat.strifeSNs.size / totalSamples) * 1000000) : 0,
          topSymptoms,
          configBreakdown,
        };
      })
      .sort((a, b) => b.specFailureRate - a.specFailureRate); // 按Spec失败率排序
  }

  /**
   * Calculate Config dimension statistics
   * 基于 SN 去重计算 Failure Rate
   */
  calculateConfigStats(issues, wfSampleMap) {
    const configMap = new Map();

    issues.forEach((issue) => {
      if (!issue.config || !issue.wf) return;

      if (!configMap.has(issue.config)) {
        configMap.set(issue.config, {
          config: issue.config,
          count: 0,
          specSNs: new Set(),  // 基于 SN 去重
          strifeSNs: new Set(),  // 基于 SN 去重
          wfCounts: new Map(),
        });
      }

      const stat = configMap.get(issue.config);
      stat.count++;
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) stat.specSNs.add(sn);
      if (issue.failure_type === 'Strife' && sn) stat.strifeSNs.add(sn);
      stat.wfCounts.set(issue.wf, (stat.wfCounts.get(issue.wf) || 0) + 1);
    });

    // 先计算每个Config在所有WF中的总样本数
    const configTotalSampleMap = new Map();
    wfSampleMap.forEach((sample, wf) => {
      Object.entries(sample.configSamples).forEach(([config, size]) => {
        configTotalSampleMap.set(config, (configTotalSampleMap.get(config) || 0) + size);
      });
    });

    // Calculate failure rate for each Config
    return Array.from(configMap.values())
      .map((stat) => {
        const totalSamples = configTotalSampleMap.get(stat.config) || 0;

        return {
          config: stat.config,
          failureCount: stat.count,
          specCount: stat.specSNs.size,  // 基于 SN 去重
          strifeCount: stat.strifeSNs.size,  // 基于 SN 去重
          totalSamples,
          failureRate: totalSamples > 0 ? Math.round((stat.count / totalSamples) * 1000000) : 0,
          specFailureRate: totalSamples > 0 ? Math.round((stat.specSNs.size / totalSamples) * 1000000) : 0,
          strifeFailureRate: totalSamples > 0 ? Math.round((stat.strifeSNs.size / totalSamples) * 1000000) : 0,
          affectedWFs: stat.wfCounts.size,
        };
      })
      .sort((a, b) => a.config.localeCompare(b.config)); // 按Config名称字母顺序排序
  }

  /**
   * Calculate Test dimension statistics
   * 合并相同test，计算所有包含该test的WF的总issue数量
   * 每个test独立计算总样品数
   */
  calculateTestStats(issues, wfSampleMap, filters = {}) {
    const testMap = new Map();

    // 按testName分组，而不是按wf+testId分组
    issues.forEach((issue) => {
      if (!issue.test_id || !issue.failed_test) return;

      const testName = issue.failed_test;
      
      if (!testMap.has(testName)) {
        testMap.set(testName, {
          testName: testName,
          testId: issue.test_id,
          count: 0,
          specSNs: new Set(),  // 基于 SN 去重
          strifeSNs: new Set(),  // 基于 SN 去重
          wfs: new Set(), // 记录所有包含该test的WF
        });
      }

      const stat = testMap.get(testName);
      stat.count++;
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) stat.specSNs.add(sn);
      if (issue.failure_type === 'Strife' && sn) stat.strifeSNs.add(sn);
      if (issue.wf) stat.wfs.add(issue.wf);
    });

    // Calculate failure rate for each test with independent total samples
    return Array.from(testMap.values())
      .map((stat) => {
        // 为每个测试项独立计算总样品数
        // 找出包含这个测试的所有WF，然后根据筛选条件计算样品总数
        const testSpecificFilters = { ...filters };
        if (!testSpecificFilters.wfs || testSpecificFilters.wfs.length === 0) {
          // 如果没有WF筛选条件，使用该测试涉及的所有WF
          testSpecificFilters.wfs = Array.from(stat.wfs);
        } else {
          // 如果有WF筛选条件，取交集
          const filteredWFs = new Set(testSpecificFilters.wfs);
          testSpecificFilters.wfs = Array.from(stat.wfs).filter(wf => filteredWFs.has(wf));
        }
        
        // 计算该测试项的总样品数
        const testTotalSamples = this.calculateTotalSamples(wfSampleMap, testSpecificFilters);
        
        return {
          testName: stat.testName,
          testId: stat.testId,
          wfs: Array.from(stat.wfs).join(', '), // 显示所有包含该test的WF
          failureCount: stat.count,
          specCount: stat.specSNs.size,  // 基于 SN 去重
          strifeCount: stat.strifeSNs.size,  // 基于 SN 去重
          totalSamples: testTotalSamples, // 每个测试项独立的总样品数
          failureRate: testTotalSamples > 0 ? Math.round((stat.count / testTotalSamples) * 1000000) : 0,
          specFailureRate: testTotalSamples > 0 ? Math.round((stat.specSNs.size / testTotalSamples) * 1000000) : 0,
          strifeFailureRate: testTotalSamples > 0 ? Math.round((stat.strifeSNs.size / testTotalSamples) * 1000000) : 0,
          percentage: testTotalSamples > 0 ? parseFloat(((stat.count / testTotalSamples) * 100).toFixed(2)) : 0,
        };
      })
      .sort((a, b) => b.specFailureRate - a.specFailureRate); // 按Spec失败率排序
  }

  /**
   * Calculate Failure Type distribution statistics
   */
  calculateFailureTypeStats(issues) {
    const typeMap = {};
    
    issues.forEach((issue) => {
      const type = issue.failure_type || '未知';
      typeMap[type] = (typeMap[type] || 0) + 1;
    });

    const total = issues.length;
    
    return Object.entries(typeMap).map(([type, count]) => ({
      type,
      count,
      percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0,
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate Function/Cosmetic distribution statistics
   */
  calculateFunctionCosmeticStats(issues) {
    const categoryMap = {};
    
    issues.forEach((issue) => {
      const category = issue.function_or_cosmetic || '未知';
      categoryMap[category] = (categoryMap[category] || 0) + 1;
    });

    const total = issues.length;
    
    return Object.entries(categoryMap).map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0,
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate FA Status distribution statistics
   */
  calculateFAStatusStats(issues) {
    const statusMap = {};
    
    issues.forEach((issue) => {
      const status = issue.fa_status || '未知';
      statusMap[status] = (statusMap[status] || 0) + 1;
    });

    const total = issues.length;
    
    return Object.entries(statusMap).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0,
    })).sort((a, b) => b.count - a.count);
  }
}

module.exports = new AnalysisService();
