const { getDatabase } = require('./database');

/**
 * Project Model - Database operations for projects
 */
class ProjectModel {
  /**
   * Create a new project
   */
  async createProject(projectData) {
    const db = getDatabase();
    const { name, projectKey, phase, fileName, uploader, configNames, validationReport, totalIssues, uploadTime, lastIssueDate } = projectData;

    const stmt = db.prepare(
      `INSERT INTO projects (name, project_key, phase, file_name, uploader, config_names, validation_report, total_issues, upload_time, last_issue_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    
    const result = stmt.run(
      name,
      projectKey || null,
      phase || null,
      fileName,
      uploader,
      JSON.stringify(configNames),
      JSON.stringify(validationReport),
      totalIssues,
      uploadTime,
      lastIssueDate || null
    );

    return result.lastInsertRowid;
  }

  /**
   * Get all projects with pagination
   */
  async getProjects({ page = 1, limit = 20, status = 'active' } = {}) {
    const db = getDatabase();
    const offset = (page - 1) * limit;

    const projects = db.prepare(
      `SELECT id, name, project_key, phase, file_name, upload_time, last_issue_date, uploader, status, total_issues, config_names
       FROM projects
       WHERE status = ?
       ORDER BY upload_time DESC
       LIMIT ? OFFSET ?`
    ).all(status, limit, offset);

    const totalResult = db.prepare(
      'SELECT COUNT(*) as total FROM projects WHERE status = ?'
    ).get(status);

    return {
      projects: projects.map((p) => ({
        ...p,
        config_names: p.config_names ? JSON.parse(p.config_names) : [],
      })),
      total: totalResult.total,
      page,
      limit,
    };
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId) {
    const db = getDatabase();

    const project = db.prepare(
      `SELECT * FROM projects WHERE id = ? AND status != 'deleted'`
    ).get(projectId);

    if (!project) {
      return null;
    }

    return {
      ...project,
      config_names: project.config_names ? JSON.parse(project.config_names) : [],
      validation_report: project.validation_report ? JSON.parse(project.validation_report) : null,
    };
  }

  /**
   * Delete project (soft delete)
   */
  async deleteProject(projectId) {
    const db = getDatabase();

    const result = db.prepare(
      `UPDATE projects SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(projectId);

    return result.changes > 0;
  }

  /**
   * Hard delete project and all related data
   */
  async hardDeleteProject(projectId) {
    const db = getDatabase();

    try {
      // sql.js doesn't fully support CASCADE DELETE, so we delete manually
      // Delete related data first (child records)
      db.prepare(`DELETE FROM issues WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM sample_sizes WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM analysis_cache WHERE project_id = ?`).run(projectId);
      
      // Finally delete the project
      const result = db.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);

      console.log(`✅ Hard deleted project ${projectId} and all related data`);
      return result.changes > 0;
    } catch (error) {
      console.error(`❌ Error hard deleting project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Update project
   */
  async updateProject(projectId, updates) {
    const db = getDatabase();
    const { name, status } = updates;

    const result = db.prepare(
      `UPDATE projects SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(name, status, projectId);

    return result.changes > 0;
  }

  /**
   * Insert issues for a project
   */
  async insertIssues(projectId, issues) {
    const db = getDatabase();

    const stmt = db.prepare(
      `INSERT INTO issues (
        project_id, fa_number, open_date, wf, config, symptom, failed_test, test_id,
        priority, failure_type, root_cause, fa_status, department, owner,
        sample_status, failed_location, function_or_cosmetic, multi_component, sn, unit_number, failed_cycle_count, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    // sql.js doesn't support transactions, so we insert directly
    for (const issue of issues) {
      stmt.run(
        projectId,
        issue.faNumber,
        issue.openDate,
        issue.wf,
        issue.config,
        issue.symptom,
        issue.failedTest,
        issue.testId,
        issue.priority,
        issue.failureType,
        issue.rootCause,
        issue.faStatus,
        issue.department,
        issue.owner,
        issue.sampleStatus,
        issue.failedLocation,
        issue.functionOrCosmetic,
        issue.multiComponent,
        issue.sn,
        issue.unitNumber,
        issue.failedCycleCount,
        issue.rawData
      );
    }
  }

  /**
   * Insert sample sizes for a project
   */
  async insertSampleSizes(projectId, sampleSizes) {
    const db = getDatabase();

    const stmt = db.prepare(
      `INSERT INTO sample_sizes (project_id, waterfall, test_name, tests, config_samples)
       VALUES (?, ?, ?, ?, ?)`
    );

    // sql.js doesn't support transactions, so we insert directly
    for (const sample of sampleSizes) {
      stmt.run(projectId, sample.waterfall, sample.testName, sample.tests, sample.configSamples);
    }
  }
}

module.exports = new ProjectModel();
