const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { getDatabase } = require('../models/database');

// Helper to hash password
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Helper to verify password
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

/**
 * Register new user
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CREDENTIALS', message: 'Username and password required' }
      });
    }

    if (username === config.auth.username) {
      return res.status(409).json({
        success: false,
        error: { code: 'USERNAME_RESERVED', message: '用户名已被保留' }
      });
    }

    const db = getDatabase();
    
    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'Username already exists' }
      });
    }

    const hashedPassword = hashPassword(password);
    db
      .prepare('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)')
      .run(username, hashedPassword, 'user', 'pending');
    
    // Force save is handled by debounced save in wrapper, but we can force it
    // await require('../models/database').forceSaveDatabase(); 

    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.error('Register error:', error);
    next(error);
  }
}

/**
 * Login
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_CREDENTIALS', message: 'Username and password required' } });
    }

    const db = getDatabase();
    let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    // Auto-create admin if matches config and not in DB
    if (!user && username === config.auth.username) {
        // Only if config password matches
        if (password === config.auth.password) {
             console.log('Creating default admin user in DB...');
             const hashedPassword = hashPassword(password);
             db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, 'admin');
             
             user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        }
    }

    if (!user || !verifyPassword(password, user.password)) {
       console.warn(`❌ Login failed for username: ${username}`);
       return res.status(401).json({
         success: false,
         error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }
       });
    }

    if (username === config.auth.username && user.status !== 'active') {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run('active', user.id);
      user = { ...user, status: 'active' };
    }

    if (username === config.auth.username && user.role !== 'admin') {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', user.id);
      user = { ...user, role: 'admin' };
    }

    if (user.status !== 'active') {
      const error =
        user.status === 'pending'
          ? { code: 'ACCOUNT_PENDING', message: '账号待管理员审核' }
          : { code: 'ACCOUNT_REJECTED', message: '账号申请已被拒绝' };
      return res.status(403).json({ success: false, error });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        username: user.username,
        id: user.id,
        iat: Math.floor(Date.now() / 1000),
      },
      config.auth.tokenSecret,
      { expiresIn: config.auth.tokenExpiry }
    );

    console.log(`✅ Login successful for user: ${username} (ID: ${user.id})`);

    res.status(200).json({
      success: true,
      data: {
        token,
        username: user.username,
        id: user.id,
        role: user.role,
        expiresIn: config.auth.tokenExpiry,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
}

/**
 * Verify token
 * GET /api/auth/verify
 */
async function verify(req, res, next) {
  try {
    const db = getDatabase();
    const user = db.prepare('SELECT id, username, role, status FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'User not found' },
      });
    }

    if (user.username === config.auth.username && user.status !== 'active') {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run('active', user.id);
      user.status = 'active';
    }

    if (user.status !== 'active') {
      const error =
        user.status === 'pending'
          ? { code: 'ACCOUNT_PENDING', message: '账号待管理员审核' }
          : { code: 'ACCOUNT_REJECTED', message: '账号申请已被拒绝' };
      return res.status(403).json({ success: false, error });
    }

    return res.status(200).json({
      success: true,
      data: {
        username: user.username,
        id: user.id,
        role: user.role,
        status: user.status,
        message: 'Token is valid',
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    next(error);
  }
}

module.exports = {
  login,
  register,
  verify,
};
