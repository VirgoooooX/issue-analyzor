/**
 * Analysis Service - Business logic for data analysis and statistics calculation
 */
class AnalysisService {
  /**
   * Calculate comprehensive analysis for a project
   * 根据筛选条件计算样本总数
   */
  async calculateProjectAnalysis(projectId, filters = {}) {
    // 延迟加载 analysisModel 以避免循环依赖
    const analysisModel = require('../models/analysisModel');
    
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
    const configStats = this.calculateConfigStats(allIssues, wfSampleMap, filters);
    const testStats = this.calculateTestStats(allIssues, wfSampleMap, filters);
    const overview = this.calculateOverview(allIssues, wfSampleMap, filters);
    const failureTypeStats = this.calculateFailureTypeStats(allIssues);
    const functionCosmeticStats = this.calculateFunctionCosmeticStats(allIssues);
    const faStatusStats = this.calculateFAStatusStats(issues.issues); // 使用全部issues统计FA Status

    console.log('\n=== 统计结果验证 ===');
    console.log('总Issue数:', allIssues.length);
    console.log('Overview:', JSON.stringify(overview, null, 2));
    if (symptomStats.length > 0) {
      console.log('第一个Symptom示例:', JSON.stringify(symptomStats[0], null, 2));
    }
    if (wfStats.length > 0) {
      console.log('第一个WF示例:', JSON.stringify(wfStats[0], null, 2));
    }
    console.log('\n');

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
    
    // 直接计数 issue 数量（不去重）
    const specIssues = issues.filter(issue => issue.failure_type === 'Spec.').length;
    const strifeIssues = issues.filter(issue => issue.failure_type === 'Strife').length;
    
    // 只在计算 FR 时使用去重的 SN
    const uniqueSpecSNs = new Set();
    const uniqueStrifeSNs = new Set();
    
    issues.forEach((issue) => {
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) {
        uniqueSpecSNs.add(sn);
      } else if (issue.failure_type === 'Strife' && sn) {
        uniqueStrifeSNs.add(sn);
      }
    });
    
    const uniqueSymptoms = new Set(issues.map((i) => i.symptom).filter(Boolean)).size;
    // 总WF数应该从WF Sample Size sheet获取（即wfSampleMap的大小）
    const uniqueWFs = wfSampleMap.size;
    const uniqueConfigs = new Set(issues.map((i) => i.config).filter(Boolean)).size;

    // Calculate overall failure rate based on filters
    const totalSampleSize = this.calculateTotalSamples(wfSampleMap, filters);

    // 用去重的 SN 数量计算 FR
    const overallFailureCount = uniqueSpecSNs.size + uniqueStrifeSNs.size;
    const overallFailureRate = totalSampleSize > 0 ? Math.round((overallFailureCount / totalSampleSize) * 1000000) : 0;
    const specFailureRate = totalSampleSize > 0 ? Math.round((uniqueSpecSNs.size / totalSampleSize) * 1000000) : 0;
    const strifeFailureRate = totalSampleSize > 0 ? Math.round((uniqueStrifeSNs.size / totalSampleSize) * 1000000) : 0;

    return {
      totalIssues,
      specIssues,  // 直接计数，不去重
      strifeIssues,  // 直接计数，不去重
      specSNCount: uniqueSpecSNs.size,  // 用于 FR 计算和显示
      strifeSNCount: uniqueStrifeSNs.size,  // 用于 FR 计算和显示
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

    return Array.from(symptomMap.values())
      .map((stat) => {
        // specCount 和 strifeCount 直接计数，不去重
        const specCount = issues.filter(i => i.symptom === stat.symptom && i.failure_type === 'Spec.').length;
        const strifeCount = issues.filter(i => i.symptom === stat.symptom && i.failure_type === 'Strife').length;
        
        return {
          symptom: stat.symptom,
          count: stat.count,
          specCount: specCount,  // 直接计数，不去重
          strifeCount: strifeCount,  // 直接计数，不去重
          specSNCount: stat.specSNs.size,  // 用于 FR 计算和显示
          strifeSNCount: stat.strifeSNs.size,  // 用于 FR 计算和显示
          totalSamples: totalSamples,
          failureRate: totalSamples > 0 ? Math.round(((stat.specSNs.size + stat.strifeSNs.size) / totalSamples) * 1000000) : 0,
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

        const result = {
          wf: stat.wf,
          testName, // 添加 testName
          totalTests: totalSamples, // 使用根据筛选条件计算的样本数
          failureCount: stat.count,
          specCount: issues.filter(i => i.wf === stat.wf && i.failure_type === 'Spec.').length,  // 直接计数，不去重
          strifeCount: issues.filter(i => i.wf === stat.wf && i.failure_type === 'Strife').length,  // 直接计数，不去重
          specSNCount: stat.specSNs.size,  // 用于 FR 计算和显示
          strifeSNCount: stat.strifeSNs.size,  // 用于 FR 计算和显示
          failureRate: totalSamples > 0 ? Math.round(((stat.specSNs.size + stat.strifeSNs.size) / totalSamples) * 1000000) : 0,
          specFailureRate: totalSamples > 0 ? Math.round((stat.specSNs.size / totalSamples) * 1000000) : 0,
          strifeFailureRate: totalSamples > 0 ? Math.round((stat.strifeSNs.size / totalSamples) * 1000000) : 0,
          topSymptoms,
          configBreakdown,
        };

        // 调试日志：打印 WF39 的详细信息
        if (stat.wf === '39') {
          console.log(`\n🔍 WF39 详细信息:`);
          console.log(`  总Issue数: ${stat.count}`);
          console.log(`  Spec issue数: ${issues.filter(i => i.wf === '39' && i.failure_type === 'Spec.').length}`);
          console.log(`  去重后Spec SN数: ${stat.specSNs.size}`);
          console.log(`  Spec SNs: ${Array.from(stat.specSNs).join(', ')}`);
          const specIssuesInWF39 = issues.filter(i => i.wf === '39' && i.failure_type === 'Spec.');
          console.log(`  WF39中Spec issue的SN分布:`);
          specIssuesInWF39.forEach(issue => {
            console.log(`    SN: "${issue.sn}", FA_NUMBER: "${issue.fa_number}", Symptom: ${issue.symptom}`);
          });
        }

        return result;
      })
      .sort((a, b) => b.specFailureRate - a.specFailureRate); // 按Spec失败率排序
  }

  /**
   * Calculate Config dimension statistics
   * 基于 SN 去重计算 Failure Rate
   * 显示所有Config（包括没有失败的Config）
   * 根据筛选条件（WF、Failed Test）应用到样本数计算
   */
  calculateConfigStats(issues, wfSampleMap, filters = {}) {
    const configMap = new Map();
    // 定义所有可能的Config
    const allConfigs = ['R1CASN', 'R2CBCN', 'R3CBCN', 'R4FNSN'];

    // 初始化所有Config
    allConfigs.forEach(config => {
      configMap.set(config, {
        config: config,
        count: 0,
        specSNs: new Set(),  // 基于 SN 去重
        strifeSNs: new Set(),  // 基于 SN 去重
        wfCounts: new Map(),
      });
    });

    issues.forEach((issue) => {
      if (!issue.config || !issue.wf) return;

      // 只处理已知的Config
      if (!configMap.has(issue.config)) return;

      const stat = configMap.get(issue.config);
      stat.count++;
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) stat.specSNs.add(sn);
      if (issue.failure_type === 'Strife' && sn) stat.strifeSNs.add(sn);
      stat.wfCounts.set(issue.wf, (stat.wfCounts.get(issue.wf) || 0) + 1);
    });

    // ... existing code ...
    // 根据筛选条件计算每个Config的总样本数
    const { wfs, failed_tests } = filters;
    
    // 确定需要计算的WF集合（考虑WF和Failed Test筛选）
    let targetWFs = new Set();
    
    if (failed_tests && failed_tests.length > 0) {
      // 如果有failed_test筛选，找出包含这些test的所有WF
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
    
    // 计算每个Config在目标WF中的总样本数
    const configTotalSampleMap = new Map();
    allConfigs.forEach(config => {
      let total = 0;
      targetWFs.forEach((wf) => {
        const sample = wfSampleMap.get(wf);
        if (sample && sample.configSamples) {
          total += sample.configSamples[config] || 0;
        }
      });
      configTotalSampleMap.set(config, total);
    });

    // Calculate failure rate for each Config
    return Array.from(configMap.values())
      .map((stat) => {
        const totalSamples = configTotalSampleMap.get(stat.config) || 0;

        return {
          config: stat.config,
          failureCount: stat.count,
          specCount: issues.filter(i => i.config === stat.config && i.failure_type === 'Spec.').length,  // 直接计数，不去重
          strifeCount: issues.filter(i => i.config === stat.config && i.failure_type === 'Strife').length,  // 直接计数，不去重
          specSNCount: stat.specSNs.size,  // 用于 FR 计算和显示
          strifeSNCount: stat.strifeSNs.size,  // 用于 FR 计算和显示
          totalSamples,
          failureRate: totalSamples > 0 ? Math.round(((stat.specSNs.size + stat.strifeSNs.size) / totalSamples) * 1000000) : 0,
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
        
        // specCount 和 strifeCount 直接计数，不去重
        const specCount = issues.filter(i => i.failed_test === stat.testName && i.failure_type === 'Spec.').length;
        const strifeCount = issues.filter(i => i.failed_test === stat.testName && i.failure_type === 'Strife').length;
        
        return {
          testName: stat.testName,
          testId: stat.testId,
          wfs: Array.from(stat.wfs).join(', '), // 昺示所有包含该test的WF
          failureCount: stat.count,
          specCount: specCount,  // 直接计数，不去重
          strifeCount: strifeCount,  // 直接计数，不去重
          specSNCount: stat.specSNs.size,  // 用于 FR 计算和显示
          strifeSNCount: stat.strifeSNs.size,  // 用于 FR 计算和显示
          totalSamples: testTotalSamples, // 每个测试项独立的总样品数
          failureRate: testTotalSamples > 0 ? Math.round(((stat.specSNs.size + stat.strifeSNs.size) / testTotalSamples) * 1000000) : 0,
          specFailureRate: testTotalSamples > 0 ? Math.round((stat.specSNs.size / testTotalSamples) * 1000000) : 0,
          strifeFailureRate: testTotalSamples > 0 ? Math.round((stat.strifeSNs.size / testTotalSamples) * 1000000) : 0,
          percentage: testTotalSamples > 0 ? parseFloat((((stat.specSNs.size + stat.strifeSNs.size) / testTotalSamples) * 100).toFixed(2)) : 0,
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

  /**
   * Calculate cross-dimensional statistics (dimension1 × dimension2)
   * 基于 SN 去重计算
   * 根据筛选条件（WF、Failed Test、Config）动态计算样本数
   */
  calculateCrossStats(issues, wfSampleMap, dimension1, dimension2, filters = {}) {
    const crossMap = new Map();
    // 规一化filters中的数组参数
    let { wfs, failed_tests, configs } = filters;
    
    // 将字符串参数转换为数组
    const parseArrayParam = (value) => {
      if (!value) return undefined;
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return value.split(',');
      return undefined;
    };
    
    wfs = parseArrayParam(wfs);
    failed_tests = parseArrayParam(failed_tests);
    configs = parseArrayParam(configs);

    // 确定需要计算的WF集合（考虑WF和Failed Test筛选）
    let targetWFs = new Set();
    
    if (failed_tests && failed_tests.length > 0) {
      // 如果有failed_test筛选，找出包含这些test的所有WF
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

    // ... existing code ...
    // 根据维度和筛选条件计算样本数
    const configTotalSampleMap = new Map();
    const allConfigs = ['R1CASN', 'R2CBCN', 'R3CBCN', 'R4FNSN'];
    
    // 为每个 Config 计算在目标 WF 范围内的样本数
    allConfigs.forEach(config => {
      let totalForConfig = 0;
      targetWFs.forEach((wf) => {
        const sample = wfSampleMap.get(wf);
        if (sample && sample.configSamples) {
          totalForConfig += sample.configSamples[config] || 0;
        }
      });
      configTotalSampleMap.set(config, totalForConfig);
    });
    
    // 如果有 Config 筛选，则只使用筛选中的 Config
    let targetConfigs = null;
    if (configs && configs.length > 0) {
      targetConfigs = new Set(configs);
    }

    // Group by two dimensions
    issues.forEach((issue) => {
      const dim1Value = issue[dimension1];
      const dim2Value = issue[dimension2];
      
      if (!dim1Value || !dim2Value) return;

      const key = `${dim1Value}||${dim2Value}`;
      if (!crossMap.has(key)) {
        crossMap.set(key, {
          dimension1Value: dim1Value,
          dimension2Value: dim2Value,
          totalCount: 0,
          specSNs: new Set(),
          strifeSNs: new Set(),
        });
      }

      const cell = crossMap.get(key);
      cell.totalCount++;
      
      // 基于 SN 去重
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) {
        cell.specSNs.add(sn);
      } else if (issue.failure_type === 'Strife' && sn) {
        cell.strifeSNs.add(sn);
      }
    });

    // Calculate failure rates
    const results = Array.from(crossMap.values()).map((cell) => {
      // 根据维度2的值计算样本数（的分母）
      let totalSamples = 0;
      
      if (dimension2 === 'config') {
        // 维度2是Config：计算该Config在目标WF范围内的总样本数
        totalSamples = configTotalSampleMap.get(cell.dimension2Value) || 0;
      } else if (dimension2 === 'wf') {
        // 维度2是WF：计算该WF的总样本数（需考虑Config筛选）
        const sample = wfSampleMap.get(cell.dimension2Value);
        if (sample && sample.configSamples) {
          if (targetConfigs) {
            // 有Config筛选：仅计算筛选中的Config样本数
            targetConfigs.forEach(config => {
              totalSamples += sample.configSamples[config] || 0;
            });
          } else {
            // 没有Config筛选：计算整个WF的总样本数
            totalSamples = Object.values(sample.configSamples).reduce((sum, val) => sum + val, 0);
          }
        }
      } else if (dimension2 === 'failed_test') {
        // 维度2是Failed Test：计算包含该test的所有WF的样本数
        const testToWFsMap = {};
        wfSampleMap.forEach((sample, wf) => {
          if (sample.tests && Array.isArray(sample.tests)) {
            sample.tests.forEach((testObj) => {
              const testName = testObj.testName;
              if (testName) {
                if (!testToWFsMap[testName]) {
                  testToWFsMap[testName] = [];
                }
                testToWFsMap[testName].push({ wf, sample });
              }
            });
          }
        });
        
        const wfsForThisTest = testToWFsMap[cell.dimension2Value] || [];
        wfsForThisTest.forEach(({ wf, sample }) => {
          if (targetConfigs) {
            targetConfigs.forEach(config => {
              totalSamples += sample.configSamples[config] || 0;
            });
          } else {
            totalSamples += Object.values(sample.configSamples).reduce((sum, val) => sum + val, 0);
          }
        });
      } else {
        // ... existing code ...
        // 维度2是其他维度：计算整个目标WF范围内的总样本数
        targetWFs.forEach((wf) => {
          const sample = wfSampleMap.get(wf);
          if (sample && sample.configSamples) {
            if (targetConfigs) {
              targetConfigs.forEach(config => {
                totalSamples += sample.configSamples[config] || 0;
              });
            } else {
              totalSamples += Object.values(sample.configSamples).reduce((sum, val) => sum + val, 0);
            }
          }
        });
      }

      // specCount 和 strifeCount 直接计数，不去重
      const dim1Key = dimension1;
      const dim2Key = dimension2;
      const specCount = issues.filter(i => 
        i[dim1Key] === cell.dimension1Value && 
        i[dim2Key] === cell.dimension2Value && 
        i.failure_type === 'Spec.'
      ).length;
      const strifeCount = issues.filter(i => 
        i[dim1Key] === cell.dimension1Value && 
        i[dim2Key] === cell.dimension2Value && 
        i.failure_type === 'Strife'
      ).length;
      const percentage = issues.length > 0 ? (cell.totalCount / issues.length) * 100 : 0;

      return {
        dimension1Value: cell.dimension1Value,
        dimension2Value: cell.dimension2Value,
        totalCount: cell.totalCount,
        specCount: specCount,  // 直接计数，不去重
        strifeCount: strifeCount,  // 直接计数，不去重
        percentage: parseFloat(percentage.toFixed(2)),
        totalSamples,
        totalFailureRate: totalSamples > 0 ? `${cell.specSNs.size}F+${cell.strifeSNs.size}SF/${totalSamples}T` : 'N/A',
        specFailureRate: totalSamples > 0 ? `${cell.specSNs.size}F/${totalSamples}T` : 'N/A',
        strifeFailureRate: totalSamples > 0 ? `${cell.strifeSNs.size}SF/${totalSamples}T` : 'N/A',
      };
    });

    // Sort by total count descending
    results.sort((a, b) => b.totalCount - a.totalCount);

    return results;
  }

  /**
   * Calculate filter statistics (multiple dimensions)
   * 基于 SN 去重计算
   */
  calculateFilterStats(issues, wfSampleMap, filters = {}, includeTrend = false) {
    // 规一化filters中的数组参数
    const normalizedFilters = { ...filters };
    const parseArrayParam = (value) => {
      if (!value) return undefined;
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return [value];
      return undefined;
    };
    
    if (normalizedFilters.wfs) normalizedFilters.wfs = parseArrayParam(normalizedFilters.wfs);
    if (normalizedFilters.configs) normalizedFilters.configs = parseArrayParam(normalizedFilters.configs);
    if (normalizedFilters.failed_tests) normalizedFilters.failed_tests = parseArrayParam(normalizedFilters.failed_tests);

    // 排除 FA Status 为 "retest pass" 的 issues
    const validIssues = issues.filter(issue => 
      issue.fa_status && issue.fa_status.toLowerCase() !== 'retest pass'
    );

    const totalCount = validIssues.length;
    const specSNs = new Set();
    const strifeSNs = new Set();
    const wfsSet = new Set();
    const configsSet = new Set();
    const symptomsSet = new Set();

    validIssues.forEach((issue) => {
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) specSNs.add(sn);
      if (issue.failure_type === 'Strife' && sn) strifeSNs.add(sn);
      if (issue.wf) wfsSet.add(issue.wf);
      if (issue.config) configsSet.add(issue.config);
      if (issue.symptom) symptomsSet.add(issue.symptom);
    });

    // 直接计数 issue，不去重
    const specCount = validIssues.filter(issue => issue.failure_type === 'Spec.').length;
    const strifeCount = validIssues.filter(issue => issue.failure_type === 'Strife').length;
    const globalTotalSamples = this.calculateTotalSamples(wfSampleMap, normalizedFilters);

    // Symptom distribution
    const symptomMap = new Map();
    validIssues.forEach((issue) => {
      if (!issue.symptom) return;
      if (!symptomMap.has(issue.symptom)) {
        symptomMap.set(issue.symptom, {
          totalCount: 0,
          specSNs: new Set(),
          strifeSNs: new Set(),
          wfs: new Set(),
        });
      }
      const data = symptomMap.get(issue.symptom);
      data.totalCount++;
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) data.specSNs.add(sn);
      if (issue.failure_type === 'Strife' && sn) data.strifeSNs.add(sn);
      if (issue.wf) data.wfs.add(issue.wf);
    });

    const symptomDistribution = Array.from(symptomMap.entries()).map(([symptom, data]) => {
      // specCount 和 strifeCount 直接计数，不去重
      const specCount = validIssues.filter(i => i.symptom === symptom && i.failure_type === 'Spec.').length;
      const strifeCount = validIssues.filter(i => i.symptom === symptom && i.failure_type === 'Strife').length;
      return {
        symptom,
        totalCount: data.totalCount,
        specCount: specCount,
        strifeCount: strifeCount,
        specSNCount: data.specSNs.size,  // 用于 FR 计算和显示
        strifeSNCount: data.strifeSNs.size,  // 用于 FR 计算和显示
        totalSamples: globalTotalSamples,
        percentage: parseFloat(((data.totalCount / totalCount) * 100).toFixed(2)),
        specRate: globalTotalSamples > 0 ? `${data.specSNs.size}F/${globalTotalSamples}T` : 'N/A',
        strifeRate: globalTotalSamples > 0 ? `${data.strifeSNs.size}SF/${globalTotalSamples}T` : 'N/A',
        specFailureRate: globalTotalSamples > 0 ? Math.round((data.specSNs.size / globalTotalSamples) * 1000000) : 0,
      };
    }).sort((a, b) => b.specFailureRate - a.specFailureRate);

    // WF distribution
    const wfMap = new Map();
    validIssues.forEach((issue) => {
      if (!issue.wf) return;
      if (!wfMap.has(issue.wf)) {
        wfMap.set(issue.wf, {
          totalCount: 0,
          specSNs: new Set(),
          strifeSNs: new Set(),
        });
      }
      const data = wfMap.get(issue.wf);
      data.totalCount++;
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) data.specSNs.add(sn);
      if (issue.failure_type === 'Strife' && sn) data.strifeSNs.add(sn);
    });

    const wfDistribution = Array.from(wfMap.entries()).map(([wf, data]) => {
      const totalSamples = this.calculateWFSampleSize(wf, wfSampleMap, normalizedFilters);
      // specCount 和 strifeCount 直接计数，不去重
      const specCount = validIssues.filter(i => i.wf === wf && i.failure_type === 'Spec.').length;
      const strifeCount = validIssues.filter(i => i.wf === wf && i.failure_type === 'Strife').length;
      return {
        wf,
        totalCount: data.totalCount,
        specCount: specCount,
        strifeCount: strifeCount,
        specSNCount: data.specSNs.size,  // 用于 FR 计算和显示
        strifeSNCount: data.strifeSNs.size,  // 用于 FR 计算和显示
        percentage: parseFloat(((data.totalCount / totalCount) * 100).toFixed(2)),
        totalSamples,
        specRate: totalSamples > 0 ? `${data.specSNs.size}F/${totalSamples}T` : 'N/A',
        strifeRate: totalSamples > 0 ? `${data.strifeSNs.size}SF/${totalSamples}T` : 'N/A',
        specFailureRate: totalSamples > 0 ? Math.round((data.specSNs.size / totalSamples) * 1000000) : 0,
      };
    }).sort((a, b) => b.specFailureRate - a.specFailureRate);

    // Config distribution
    const configMap = new Map();
    validIssues.forEach((issue) => {
      if (!issue.config) return;
      if (!configMap.has(issue.config)) {
        configMap.set(issue.config, {
          totalCount: 0,
          specSNs: new Set(),
          strifeSNs: new Set(),
        });
      }
      const data = configMap.get(issue.config);
      data.totalCount++;
      const sn = issue.sn || issue.fa_number;
      if (issue.failure_type === 'Spec.' && sn) data.specSNs.add(sn);
      if (issue.failure_type === 'Strife' && sn) data.strifeSNs.add(sn);
    });

    const configDistribution = Array.from(configMap.entries()).map(([config, data]) => {
      // specCount 和 strifeCount 直接计数，不去重
      const specCount = validIssues.filter(i => i.config === config && i.failure_type === 'Spec.').length;
      const strifeCount = validIssues.filter(i => i.config === config && i.failure_type === 'Strife').length;
      return {
        config,
        totalCount: data.totalCount,
        specCount: specCount,
        strifeCount: strifeCount,
        specSNCount: data.specSNs.size,  // 用于 FR 计算和显示
        strifeSNCount: data.strifeSNs.size,  // 用于 FR 计算和显示
        percentage: parseFloat(((data.totalCount / totalCount) * 100).toFixed(2)),
      };
    }).sort((a, b) => b.totalCount - a.totalCount);

    // Failure type distribution
    const failureTypeDistribution = [
      {
        type: 'Spec.',
        count: specCount,
        snCount: specSNs.size,  // 用于 FR 计算和显示
        percentage: totalCount > 0 ? parseFloat(((specCount / totalCount) * 100).toFixed(2)) : 0,
        rate: globalTotalSamples > 0 ? `${specSNs.size}F/${globalTotalSamples}T` : 'N/A',
      },
      {
        type: 'Strife',
        count: strifeCount,
        snCount: strifeSNs.size,  // 用于 FR 计算和显示
        percentage: totalCount > 0 ? parseFloat(((strifeCount / totalCount) * 100).toFixed(2)) : 0,
        rate: globalTotalSamples > 0 ? `${strifeSNs.size}SF/${globalTotalSamples}T` : 'N/A',
      },
    ];

    // Function/Cosmetic distribution
    const functionCosmeticMap = {};
    validIssues.forEach((issue) => {
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
      percentage: issues.length > 0 ? parseFloat(((count / issues.length) * 100).toFixed(2)) : 0,
    })).sort((a, b) => b.count - a.count);

    const statistics = {
      totalCount,
      specCount,
      strifeCount,
      specSNCount: specSNs.size,  // 用于FR计算的去重SN数量
      strifeSNCount: strifeSNs.size,  // 用于FR计算的去重SN数量
      uniqueWFs: wfsSet.size,
      uniqueConfigs: configsSet.size,
      uniqueSymptoms: symptomsSet.size,
      totalSamples: globalTotalSamples,
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

      const dateMap = new Map();
      validIssues.forEach((issue) => {
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

        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { totalCount: 0, specSNs: new Set(), strifeSNs: new Set() });
        }
        const counts = dateMap.get(dateKey);
        counts.totalCount++;
        const sn = issue.sn || issue.fa_number;
        if (issue.failure_type === 'Spec.' && sn) counts.specSNs.add(sn);
        if (issue.failure_type === 'Strife' && sn) counts.strifeSNs.add(sn);
      });

      const data = Array.from(dateMap.entries()).map(([date, counts]) => ({
        date,
        totalCount: counts.totalCount,
        specCount: counts.specSNs.size,
        strifeCount: counts.strifeSNs.size,
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

module.exports = new AnalysisService();
