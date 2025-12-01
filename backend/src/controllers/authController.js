const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 用户登录接口
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      console.warn('⚠️  Missing username or password');
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Username and password are required',
        },
      });
    }

    // 验证凭证
    if (username !== config.auth.username || password !== config.auth.password) {
      console.warn(`❌ Login failed for username: ${username}`);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      });
    }

    // 生成 JWT token
    const token = jwt.sign(
      {
        username: username,
        iat: Math.floor(Date.now() / 1000),
      },
      config.auth.tokenSecret,
      { expiresIn: config.auth.tokenExpiry }
    );

    console.log(`✅ Login successful for user: ${username}`);

    res.status(200).json({
      success: true,
      data: {
        token,
        username,
        expiresIn: config.auth.tokenExpiry,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
}

/**
 * 验证 token 接口（可选）
 * GET /api/auth/verify
 */
async function verify(req, res, next) {
  try {
    // 如果成功到达这里，说明 token 已通过中间件验证
    return res.status(200).json({
      success: true,
      data: {
        username: req.user.username,
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
  verify,
};
