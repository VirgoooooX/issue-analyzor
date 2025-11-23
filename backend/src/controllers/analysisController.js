const analysisModel = require('../models/analysisModel');
const analysisService = require('../services/analysisService');

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

    // Check cache first (only for non-filtered requests)
    let analysis;
    if (Object.keys(filters).length === 0) {
      analysis = await analysisModel.getAnalysisCache(id, 'full');
    }

    if (!analysis) {
      // Calculate if not cached
      console.log(`📊 Calculating analysis for project ${id}...`);
      analysis = await analysisService.calculateProjectAnalysis(id, filters);

      // Save to cache (only for non-filtered requests)
      if (Object.keys(filters).length === 0) {
        await analysisModel.saveAnalysisCache(id, 'full', analysis);
        console.log(`✅ Analysis cached for project ${id}`);
      }
    }

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

    const testStats = await analysisModel.getTestAnalysis(id, filters);

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

    const crossAnalysis = await analysisModel.getCrossAnalysis(id, dimension1, dimension2, filters);

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
    const statistics = await analysisModel.getFilterStatistics(id, filters, includeTrendBool);

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
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
};
