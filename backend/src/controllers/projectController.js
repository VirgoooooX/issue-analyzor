const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config');
const projectModel = require('../models/projectModel');
const { parseExcelFile } = require('../services/excelParser');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = config.upload.dir;
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      console.log(`📁 Upload directory ready: ${uploadDir}`);
      cb(null, uploadDir);
    } catch (error) {
      console.error(`❌ Failed to create upload directory: ${error.message}`);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `upload-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (req, file, cb) => {
    console.log(`📋 File filter checking: ${file.originalname}, type: ${file.mimetype}`);
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Invalid file type. Only .xlsx and .xls files are allowed.');
      console.error(`❌ File type rejected: ${file.mimetype}`);
      cb(error, false);
    }
  },
});

/**
 * Get all projects
 */
async function getProjects(req, res, next) {
  try {
    const { page, limit, status } = req.query;

    const result = await projectModel.getProjects({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status: status || 'active',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get project by ID
 */
async function getProjectById(req, res, next) {
  try {
    const { id } = req.params;

    const project = await projectModel.getProjectById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create new project by uploading Excel file
 */
async function createProject(req, res, next) {
  let uploadedFilePath = null;

  try {
    console.log('📥 Upload request received');
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    if (!req.file) {
      console.error('❌ No file in request');
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE_UPLOADED',
          message: 'No Excel file uploaded',
        },
      });
    }

    uploadedFilePath = req.file.path;
    const fileName = req.file.originalname;
    const projectName = req.body.name || path.parse(fileName).name;
    const uploader = req.body.uploader || null;

    console.log(`📄 Processing Excel file: ${fileName}`);

    // Parse Excel file
    const { issues, sampleSizes, configNames, validationReport } = await parseExcelFile(uploadedFilePath);

    console.log(`✅ Parsed ${issues.length} issues and ${sampleSizes.length} sample sizes`);
    console.log(`✅ Extracted ${configNames.length} config names: ${configNames.join(', ')}`);

    // Create project
    const projectId = await projectModel.createProject({
      name: projectName,
      fileName,
      uploader,
      configNames,
      validationReport,
      totalIssues: issues.length,
    });

    console.log(`✅ Created project ID: ${projectId}`);

    // Insert issues and sample sizes
    await projectModel.insertIssues(projectId, issues);
    await projectModel.insertSampleSizes(projectId, sampleSizes);

    console.log(`✅ Inserted all data for project ${projectId}`);

    // Clean up uploaded file
    await fs.unlink(uploadedFilePath);
    uploadedFilePath = null;

    // Get created project
    const project = await projectModel.getProjectById(projectId);

    res.status(201).json({
      success: true,
      data: {
        project_id: projectId,
        name: project.name,
        total_issues: project.total_issues,
        config_names: project.config_names,
        validation_report: project.validation_report,
      },
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (uploadedFilePath) {
      try {
        await fs.unlink(uploadedFilePath);
      } catch (unlinkError) {
        console.error('Failed to clean up uploaded file:', unlinkError);
      }
    }

    next(error);
  }
}

/**
 * Delete project
 */
async function deleteProject(req, res, next) {
  try {
    const { id } = req.params;
    const { hard } = req.query;

    const project = await projectModel.getProjectById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    if (hard === 'true') {
      await projectModel.hardDeleteProject(id);
    } else {
      await projectModel.deleteProject(id);
    }

    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  upload,
  getProjects,
  getProjectById,
  createProject,
  deleteProject,
};
