const crypto = require('crypto');
const { getDatabase } = require('../models/database');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function normalizeRole(role) {
  if (!role) return 'user';
  if (role === 'admin' || role === 'manager' || role === 'user') return role;
  return null;
}

function normalizeStatus(status) {
  if (!status) return 'active';
  if (status === 'active' || status === 'pending' || status === 'rejected') return status;
  return null;
}

async function listUsers(req, res, next) {
  try {
    const { q } = req.query || {};
    const db = getDatabase();

    if (q && String(q).trim()) {
      const keyword = `%${String(q).trim()}%`;
      const users = db
        .prepare('SELECT id, username, role, status, created_at FROM users WHERE username LIKE ? ORDER BY created_at DESC')
        .all(keyword);
      return res.status(200).json({
        success: true,
        data: { users, total: users.length },
      });
    }

    const users = db
      .prepare('SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC')
      .all();
    return res.status(200).json({
      success: true,
      data: { users, total: users.length },
    });
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Username and password required' },
      });
    }

    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Invalid role' },
      });
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'Username already exists' },
      });
    }

    const hashedPassword = hashPassword(password);
    const insert = db
      .prepare('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)')
      .run(username, hashedPassword, normalizedRole, 'active');
    const user = db
      .prepare('SELECT id, username, role, status, created_at FROM users WHERE id = ?')
      .get(insert.lastInsertRowid);
    return res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid user id' },
      });
    }

    const { password, role, status } = req.body || {};
    const normalizedRole = role === undefined ? undefined : normalizeRole(role);
    if (normalizedRole === null) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Invalid role' },
      });
    }

    const normalizedStatus = status === undefined ? undefined : normalizeStatus(status);
    if (normalizedStatus === null) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Invalid status' },
      });
    }

    if (password === undefined && normalizedRole === undefined && normalizedStatus === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'No fields to update' },
      });
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    if (password !== undefined) {
      const hashedPassword = hashPassword(password);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
    }

    if (normalizedRole !== undefined) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(normalizedRole, userId);
    }

    if (normalizedStatus !== undefined) {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(normalizedStatus, userId);
    }

    const user = db
      .prepare('SELECT id, username, role, status, created_at FROM users WHERE id = ?')
      .get(userId);
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid user id' },
      });
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    db.prepare('DELETE FROM saved_filters WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
};
