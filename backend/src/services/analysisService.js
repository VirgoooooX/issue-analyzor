const analysisModel = require('../models/analysisModel');

/**
 * Analysis Service - Business logic for data analysis and statistics calculation
 */
class AnalysisService {
  /**
   * Calculate comprehensive analysis for a project
   */
  async calculateProjectAnalysis(projectId) {
    const [issues, sampleSizes] = await Promise.all([
      analysisModel.getIssues(projectId, { limit: 999999 }),
      analysisModel.getSampleSizes(projectId),
    ]);

    const allIssues = issues.issues;

    // Build WF -> Sample Size mapping
    const wfSampleMap = this.buildWFSampleMap(sampleSizes);

    // Calculate各维度统计
    const symptomStats = this.calculateSymptomStats(allIssues, wfSampleMap);
    const wfStats = this.calculateWFStats(allIssues, wfSampleMap);
    const configStats = this.calculateConfigStats(allIssues, wfSampleMap);
    const testStats = this.calculateTestStats(allIssues, wfSampleMap);
    const overview = this.calculateOverview(allIssues, wfSampleMap);

    return {
      overview,
      symptomStats,
      wfStats,
      configStats,
      testStats,
    };
  }

  /**
   * Build WF -> Sample Size mapping
   */
  buildWFSampleMap(sampleSizes) {
    const map = new Map();

    sampleSizes.forEach((sample) => {
      map.set(sample.waterfall, {
        tests: sample.tests,
        configSamples: sample.config_samples,
        totalSamples: Object.values(sample.config_samples).reduce((sum, val) => sum + val, 0),
      });
    });

    return map;
  }

  /**
   * Calculate overview statistics
   */
  calculateOverview(issues, wfSampleMap) {
    const totalIssues = issues.length;
    const uniqueSymptoms = new Set(issues.map((i) => i.symptom).filter(Boolean)).size;
    const uniqueWFs = new Set(issues.map((i) => i.wf).filter(Boolean)).size;
    const uniqueConfigs = new Set(issues.map((i) => i.config).filter(Boolean)).size;

    // Calculate overall failure rate
    let totalSampleSize = 0;
    wfSampleMap.forEach((sample) => {
      totalSampleSize += sample.totalSamples;
    });

    const overallFailureRate = totalSampleSize > 0 ? Math.round((totalIssues / totalSampleSize) * 1000000) : 0;

    return {
      totalIssues,
      uniqueSymptoms,
      uniqueWFs,
      uniqueConfigs,
      totalSampleSize,
      overallFailureRate, // ppm
    };
  }

  /**
   * Calculate Symptom dimension statistics
   */
  calculateSymptomStats(issues, wfSampleMap) {
    const symptomMap = new Map();

    issues.forEach((issue) => {
      if (!issue.symptom) return;

      if (!symptomMap.has(issue.symptom)) {
        symptomMap.set(issue.symptom, {
          symptom: issue.symptom,
          count: 0,
          wfs: new Set(),
          configs: new Set(),
        });
      }

      const stat = symptomMap.get(issue.symptom);
      stat.count++;
      if (issue.wf) stat.wfs.add(issue.wf);
      if (issue.config) stat.configs.add(issue.config);
    });

    // Calculate failure rate for each symptom
    return Array.from(symptomMap.values())
      .map((stat) => {
        // 计算该症状涉及的所有WF的总样本数
        let totalSamples = 0;
        stat.wfs.forEach((wf) => {
          const sample = wfSampleMap.get(wf);
          if (sample) {
            totalSamples += sample.totalSamples;
          }
        });

        return {
          symptom: stat.symptom,
          count: stat.count,
          failureRate: totalSamples > 0 ? Math.round((stat.count / totalSamples) * 1000000) : 0,
          affectedWFs: stat.wfs.size,
          affectedConfigs: stat.configs.size,
        };
      })
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Calculate WF dimension statistics
   */
  calculateWFStats(issues, wfSampleMap) {
    const wfMap = new Map();

    issues.forEach((issue) => {
      if (!issue.wf) return;

      if (!wfMap.has(issue.wf)) {
        wfMap.set(issue.wf, {
          wf: issue.wf,
          count: 0,
          symptoms: new Map(),
          configs: new Map(),
        });
      }

      const stat = wfMap.get(issue.wf);
      stat.count++;

      // Count symptoms
      if (issue.symptom) {
        stat.symptoms.set(issue.symptom, (stat.symptoms.get(issue.symptom) || 0) + 1);
      }

      // Count configs
      if (issue.config) {
        stat.configs.set(issue.config, (stat.configs.get(issue.config) || 0) + 1);
      }
    });

    // Calculate failure rate for each WF
    return Array.from(wfMap.values())
      .map((stat) => {
        const sample = wfSampleMap.get(stat.wf);
        const totalSamples = sample ? sample.totalSamples : 0;

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
          totalTests: totalSamples,
          failureCount: stat.count,
          failureRate: totalSamples > 0 ? Math.round((stat.count / totalSamples) * 1000000) : 0,
          topSymptoms,
          configBreakdown,
        };
      })
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Calculate Config dimension statistics
   */
  calculateConfigStats(issues, wfSampleMap) {
    const configMap = new Map();

    issues.forEach((issue) => {
      if (!issue.config || !issue.wf) return;

      if (!configMap.has(issue.config)) {
        configMap.set(issue.config, {
          config: issue.config,
          count: 0,
          wfCounts: new Map(), // WF -> count
        });
      }

      const stat = configMap.get(issue.config);
      stat.count++;
      stat.wfCounts.set(issue.wf, (stat.wfCounts.get(issue.wf) || 0) + 1);
    });

    // Calculate failure rate for each Config
    return Array.from(configMap.values())
      .map((stat) => {
        // 计算该Config在所有相关WF中的总样本数
        let totalSamples = 0;
        stat.wfCounts.forEach((count, wf) => {
          const sample = wfSampleMap.get(wf);
          if (sample && sample.configSamples[stat.config]) {
            totalSamples += sample.configSamples[stat.config];
          }
        });

        return {
          config: stat.config,
          failureCount: stat.count,
          totalSamples,
          failureRate: totalSamples > 0 ? Math.round((stat.count / totalSamples) * 1000000) : 0,
          affectedWFs: stat.wfCounts.size,
        };
      })
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Calculate Test dimension statistics
   */
  calculateTestStats(issues, wfSampleMap) {
    const testMap = new Map();

    issues.forEach((issue) => {
      if (!issue.testId || !issue.wf) return;

      const key = `${issue.wf}_${issue.testId}`;

      if (!testMap.has(key)) {
        testMap.set(key, {
          wf: issue.wf,
          testId: issue.testId,
          failedTest: issue.failedTest,
          count: 0,
        });
      }

      testMap.get(key).count++;
    });

    // Calculate failure rate for each test
    return Array.from(testMap.values())
      .map((stat) => {
        const sample = wfSampleMap.get(stat.wf);
        const totalSamples = sample ? sample.totalSamples : 0;

        return {
          wf: stat.wf,
          testId: stat.testId,
          failedTest: stat.failedTest,
          failureCount: stat.count,
          totalSamples,
          failureRate: totalSamples > 0 ? Math.round((stat.count / totalSamples) * 1000000) : 0,
        };
      })
      .sort((a, b) => b.failureRate - a.failureRate);
  }
}

module.exports = new AnalysisService();
