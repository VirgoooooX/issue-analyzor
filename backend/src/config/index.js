const path = require('path');
// require('dotenv').config(); // Moved to server.js to ensure proper loading

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  // Database configuration
  database: {
    path: process.env.DATABASE_PATH || path.join(__dirname, '../../data/failure_tracker.db'),
  },

  // Upload configuration
  upload: {
    dir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ],
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Excel parsing configuration
  excel: {
    systemTFSheetIndex: 0, // Sheet 1: System TF
    sampleSizeSheetIndex: 4, // Sheet 5: WF Sample size
    headerRow: 7, // 第7行是表头
    dataStartRow: 8, // 第8行开始是数据
  },

  // Authentication configuration
  auth: {
    enabled: (process.env.AUTH_ENABLED === 'true' || process.env.AUTH_ENABLED === true) || false,
    username: process.env.AUTH_USERNAME || 'admin',
    password: process.env.AUTH_PASSWORD || 'password',
    tokenSecret: process.env.AUTH_TOKEN_SECRET || 'your-secret-key-change-in-production',
    tokenExpiry: '7d',
  },
};

// Debug auth config
console.log('🔧 Process env AUTH_ENABLED:', process.env.AUTH_ENABLED);
console.log('🔧 Auth config loaded:', module.exports.auth);