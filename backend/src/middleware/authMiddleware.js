const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 身份验证中间件
 * 验证请求中的 JWT token
 */
function authMiddleware(req, res, next) {
  // 如果认证禁用，直接通过
  if (!config.auth.enabled) {
    console.log('⚙️  Auth disabled, skipping token verification');
    return next();
  }

  try {
    // 从请求头获取 token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.warn('⚠️  No authorization header provided');
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Authorization token required',
        },
      });
    }

    // 提取 Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.warn('⚠️  Invalid authorization header format');
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Invalid authorization header format',
        },
      });
    }

    const token = parts[1];

    // 验证 token
    jwt.verify(token, config.auth.tokenSecret, (err, decoded) => {
      if (err) {
        console.warn('⚠️  Token verification failed:', err.message);
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
          },
        });
      }

      // 将解码的信息存储在请求对象中
      req.user = decoded;
      console.log(`✅ Token verified for user: ${decoded.username}`);
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication error',
      },
    });
  }
}

module.exports = authMiddleware;
