const { getDatabase } = require('../models/database');

async function requirePowerUser(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const db = getDatabase();
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Poweruser permission required' },
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requirePowerUser;

