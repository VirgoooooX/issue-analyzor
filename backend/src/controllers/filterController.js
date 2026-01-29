const { getDatabase } = require('../models/database');

/**
 * Save a filter configuration
 * POST /api/filters
 */
async function saveFilter(req, res, next) {
  try {
    const userId = req.user.id;
    const { projectId, name, filters } = req.body;

    if (!projectId || !name || !filters) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'ProjectId, name and filters are required' }
      });
    }

    const db = getDatabase();
    
    // Check if filter with same name exists for this user and project
    const existing = db.prepare('SELECT id FROM saved_filters WHERE user_id = ? AND project_id = ? AND name = ?')
                       .get(userId, projectId, name);

    if (existing) {
        // Update existing
        db.prepare('UPDATE saved_filters SET filters = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(JSON.stringify(filters), existing.id);
          
        return res.status(200).json({
            success: true,
            data: { id: existing.id, name },
            message: 'Filter updated successfully'
        });
    } else {
        // Create new
        const result = db.prepare('INSERT INTO saved_filters (user_id, project_id, name, filters) VALUES (?, ?, ?, ?)')
                         .run(userId, projectId, name, JSON.stringify(filters));
                         
        return res.status(201).json({
            success: true,
            data: { id: result.lastInsertRowid, name },
            message: 'Filter saved successfully'
        });
    }

  } catch (error) {
    console.error('Save filter error:', error);
    next(error);
  }
}

/**
 * Get saved filters
 * GET /api/filters
 * Query param: projectId (optional)
 */
async function getFilters(req, res, next) {
  try {
    const userId = req.user.id;
    const { projectId } = req.query;

    const db = getDatabase();
    let sql = 'SELECT id, project_id, name, filters, created_at FROM saved_filters WHERE user_id = ?';
    const params = [userId];

    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    
    sql += ' ORDER BY created_at DESC';

    const filters = db.prepare(sql).all(...params);
    
    // Parse JSON filters
    const parsedFilters = filters.map(f => ({
        ...f,
        filters: JSON.parse(f.filters)
    }));

    res.status(200).json({
      success: true,
      data: parsedFilters
    });
  } catch (error) {
    console.error('Get filters error:', error);
    next(error);
  }
}

/**
 * Delete a saved filter
 * DELETE /api/filters/:id
 */
async function deleteFilter(req, res, next) {
  try {
    const userId = req.user.id;
    const filterId = req.params.id;

    const db = getDatabase();
    
    // Verify ownership
    const filter = db.prepare('SELECT id FROM saved_filters WHERE id = ? AND user_id = ?')
                     .get(filterId, userId);
                     
    if (!filter) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Filter not found or access denied' }
      });
    }

    db.prepare('DELETE FROM saved_filters WHERE id = ?').run(filterId);

    res.status(200).json({
      success: true,
      message: 'Filter deleted successfully'
    });
  } catch (error) {
    console.error('Delete filter error:', error);
    next(error);
  }
}

module.exports = {
  saveFilter,
  getFilters,
  deleteFilter
};
