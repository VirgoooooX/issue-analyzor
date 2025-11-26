const analysisModel = require('../models/analysisModel');
const analysisService = require('../services/analysisService');
const exportService = require('../services/exportService');
const cacheService = require('../services/cacheService');

/**
 * Get issues for a project with filters
 */
async function getIssues(req, res, next) {
  try {
    const { id } = req.params;
    const filters = req.query;

    const result = await analysisModel.getIssues(id, filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get filter options for a project
 */
async function getFilterOptions(req, res, next) {
  try {
    const { id } = req.params;
    const filters = req.query; // 支持接收当前筛选条件

    const options = await analysisModel.getFilterOptions(id, filters);

    res.json({
      success: true,
      data: options,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get comprehensive analysis for a project
 */
async function getAnalysis(req, res, next) {
  try {
    const { id } = req.params;
    const filters = req.query;

    // 生成缓存键
    const cacheKey = cacheService.generateCacheKey('analysis', id, filters);

    // ... existing code ...
    const analysis = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        console.log(`📊 Calculating analysis for project ${id}...`);
        const result = await analysisService.calculateProjectAnalysis(id, filters);
        console.log(`✅ Analysis calculated for project ${id}`);
        return result;
      },
      3600 // 缓存1小时
    );

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get test analysis for a project
 */
async function getTestAnalysis(req, res, next) {
  try {
    const { id } = req.params;
    const filters = req.query;

    // 生成缓存键
    const cacheKey = cacheService.generateCacheKey('test_analysis', id, filters);

    // 使用缓存服务
    const testStats = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        console.log(`📊 Calculating test analysis for project ${id}...`);
        return await analysisModel.getTestAnalysis(id, filters);
      },
      3600 // 缓存1小时
    );

    res.json({
      success: true,
      data: {
        testStats,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get cross analysis data (dimension1 × dimension2)
 */
async function getCrossAnalysis(req, res, next) {
  try {
    const { id } = req.params;
    const { dimension1, dimension2, ...filters } = req.query;

    if (!dimension1 || !dimension2) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: dimension1 and dimension2',
      });
    }

    // 生成缓存键
    const cacheKey = cacheService.generateCacheKey(
      `cross_${dimension1}_${dimension2}`,
      id,
      filters
    );

    // 使用缓存服务
    const crossAnalysis = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        console.log(`📊 Calculating cross analysis for project ${id}: ${dimension1} × ${dimension2}`);
        return await analysisModel.getCrossAnalysis(id, dimension1, dimension2, filters);
      },
      3600 // 缓存1小时
    );

    res.json({
      success: true,
      data: {
        crossAnalysis,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get filter statistics for筛选结果页面
 */
async function getFilterStatistics(req, res, next) {
  try {
    const { id } = req.params;
    const { includeTrend, ...filters } = req.query;

    const includeTrendBool = includeTrend === 'true' || includeTrend === '1';

    // 生成缓存键
    const cacheKey = cacheService.generateCacheKey(
      `filter_stats_${includeTrendBool}`,
      id,
      filters
    );

    // 使用缓存服务
    const statistics = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        console.log(`📊 Calculating filter statistics for project ${id}...`);
        return await analysisModel.getFilterStatistics(id, filters, includeTrendBool);
      },
      3600 // 缓存1小时
    );

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get sample sizes for a project
 */
async function getSampleSizes(req, res, next) {
  try {
    const { id } = req.params;
    const sampleSizes = await analysisModel.getSampleSizes(id);

    res.json({
      success: true,
      data: sampleSizes,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get failure rate matrix data (WF/Test/Config)
 */
async function getFailureRateMatrix(req, res, next) {
  try {
    const { id } = req.params;
    const filters = req.query;

    // 生成缓存键
    const cacheKey = cacheService.generateCacheKey('failure_matrix', id, filters);

    // 使用缓存服务
    const matrixData = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        console.log(`📊 Calculating failure rate matrix for project ${id}...`);
        return await analysisModel.getFailureRateMatrix(id, filters);
      },
      3600 // 缓存1小时
    );

    res.json({
      success: true,
      data: matrixData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Export analysis report as Excel (no charts)
 */
async function exportExcel(req, res, next) {
  try {
    const { id } = req.params;
    const filters = req.query;

    console.log(`📊 Generating Excel report for project ${id}...`);
    const buffer = await exportService.generateExcelReport(id, filters);

    const { getDatabase } = require('../models/database');
    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    
    // Generate filename based on filters
    let filename = `${project.name}_Analysis`;
    
    // Add filter indicators to filename
    const filterParts = [];
    if (filters.symptoms) filterParts.push('Symptom');
    if (filters.wfs) filterParts.push('WF');
    if (filters.configs) filterParts.push('Config');
    if (filters.failed_tests) filterParts.push('Test');
    if (filters.date_from || filters.date_to) filterParts.push('Date');
    
    if (filterParts.length > 0) {
      filename += `_Filtered_${filterParts.join('_')}`;
    }
    
    filename += `_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
    console.log(`✅ Excel report generated successfully`);
  } catch (error) {
    console.error('Error exporting Excel:', error);
    next(error);
  }
}

/**
 * Export failure rate matrix as Excel
 */
async function exportMatrix(req, res, next) {
  try {
    const { id } = req.params;
    const filters = req.query;

    console.log(`📊 Generating Failure Rate Matrix report for project ${id}...`);
    const buffer = await exportService.generateMatrixReport(id, filters);

    const { getDatabase } = require('../models/database');
    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    
    // Generate filename based on filters
    let filename = `${project.name}_FailureRateMatrix`;
    
    // Add filter indicators to filename
    const filterParts = [];
    if (filters.symptoms) filterParts.push('Symptom');
    if (filters.wfs) filterParts.push('WF');
    if (filters.configs) filterParts.push('Config');
    if (filters.failed_tests) filterParts.push('Test');
    if (filters.date_from || filters.date_to) filterParts.push('Date');
    
    if (filterParts.length > 0) {
      filename += `_Filtered_${filterParts.join('_')}`;
    }
    
    filename += `_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
    console.log(`✅ Failure Rate Matrix report generated successfully`);
  } catch (error) {
    console.error('Error exporting matrix:', error);
    next(error);
  }
}

/**
 * Export cross analysis as Excel
 */
async function exportCrossAnalysis(req, res, next) {
  try {
    const { id } = req.params;
    const { dimension1, dimension2, ...filters } = req.query;

    if (!dimension1 || !dimension2) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: dimension1 and dimension2',
      });
    }

    console.log(`📊 Generating Cross Analysis report for project ${id}: ${dimension1} × ${dimension2}...`);
    const buffer = await exportService.generateCrossAnalysisReport(id, dimension1, dimension2, filters);

    const { getDatabase } = require('../models/database');
    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    
    // Generate filename
    let filename = `${project.name}_CrossAnalysis_${dimension1}_${dimension2}`;
    
    // Add filter indicators to filename
    const filterParts = [];
    if (filters.symptoms) filterParts.push('Symptom');
    if (filters.wfs) filterParts.push('WF');
    if (filters.configs) filterParts.push('Config');
    if (filters.failed_tests) filterParts.push('Test');
    if (filters.date_from || filters.date_to) filterParts.push('Date');
    
    if (filterParts.length > 0) {
      filename += `_Filtered_${filterParts.join('_')}`;
    }
    
    filename += `_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
    console.log(`✅ Cross Analysis report generated successfully`);
  } catch (error) {
    console.error('Error exporting cross analysis:', error);
    next(error);
  }
}

module.exports = {
  getIssues,
  getFilterOptions,
  getAnalysis,
  getTestAnalysis,
  getCrossAnalysis,
  getFilterStatistics,
  getSampleSizes,
  getFailureRateMatrix,
  exportExcel,
  exportMatrix,
  exportCrossAnalysis,
};
