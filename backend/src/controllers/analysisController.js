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

    const options = await analysisModel.getFilterOptions(id);

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

    // Check cache first
    let analysis = await analysisModel.getAnalysisCache(id, 'full');

    if (!analysis) {
      // Calculate if not cached
      console.log(`📊 Calculating analysis for project ${id}...`);
      analysis = await analysisService.calculateProjectAnalysis(id);

      // Save to cache
      await analysisModel.saveAnalysisCache(id, 'full', analysis);
      console.log(`✅ Analysis cached for project ${id}`);
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

module.exports = {
  getIssues,
  getFilterOptions,
  getAnalysis,
  getTestAnalysis,
};
