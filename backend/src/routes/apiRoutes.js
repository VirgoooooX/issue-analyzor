const express = require('express');
const router = express.Router();

// Import controllers
const projectController = require('../controllers/projectController');
const analysisController = require('../controllers/analysisController');

// Project routes
router.get('/', projectController.getProjects);
router.post('/', 
  (req, res, next) => {
    console.log('📦 POST /api/projects - Request received');
    next();
  },
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

module.exports = router;
