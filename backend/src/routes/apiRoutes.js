const express = require('express');
const router = express.Router();

// Import controllers
const projectController = require('../controllers/projectController');
const analysisController = require('../controllers/analysisController');
const requirePowerUser = require('../middleware/requirePowerUser');

// Project routes
router.get('/', projectController.getProjects);
router.post('/', 
  (req, res, next) => {
    console.log('📦 POST /api/projects - Request received');
    next();
  },
  requirePowerUser,
  projectController.upload.single('file'), 
  (err, req, res, next) => {
    if (err) {
      console.error('❌ Multer error:', err);
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message,
        },
      });
    }
    next();
  },
  projectController.createProject
);
router.get('/:id', projectController.getProjectById);
router.delete('/:id', projectController.deleteProject);

// Analysis routes for specific project
router.get('/:id/issues', analysisController.getIssues);
router.get('/:id/filter-options', analysisController.getFilterOptions);
router.get('/:id/analysis', analysisController.getAnalysis);
router.get('/:id/analysis/test', analysisController.getTestAnalysis);
router.get('/:id/analysis/cross', analysisController.getCrossAnalysis);
router.get('/:id/filter-statistics', analysisController.getFilterStatistics);
router.get('/:id/sample-sizes', analysisController.getSampleSizes);
router.get('/:id/failure-rate-matrix', analysisController.getFailureRateMatrix);

// Export routes
router.get('/:id/export/excel', analysisController.exportExcel);
router.get('/:id/export/matrix', analysisController.exportMatrix);
router.get('/:id/export/cross', analysisController.exportCrossAnalysis);

module.exports = router;
