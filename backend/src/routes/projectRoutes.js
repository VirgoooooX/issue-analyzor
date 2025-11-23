const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

// Get all projects
router.get('/', projectController.getProjects);

// Create new project (upload Excel)
router.post('/', projectController.upload.single('file'), projectController.createProject);

// Get project by ID
router.get('/:id', projectController.getProjectById);

// Delete project
router.delete('/:id', projectController.deleteProject);

module.exports = router;
