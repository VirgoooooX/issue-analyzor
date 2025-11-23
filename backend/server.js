const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./src/config');
const { initDatabase, closeDatabase } = require('./src/models/database');
const cacheService = require('./src/services/cacheService');

const app = express();

// ===========================
// Middleware Configuration
// ===========================

// CORS
app.use(cors(config.cors));

// Request logging
app.use(morgan(config.server.env === 'development' ? 'dev' : 'combined'));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (for uploaded files, if needed for debugging)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===========================
// API Routes
// ===========================

// Health check endpoint
app.get('/api/health', (req, res) => {
  const cacheStats = cacheService.getStats();
  res.json({
    success: true,
    message: 'Failure Tracker API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      uploadDir: config.upload.dir,
      databasePath: config.database.path,
    },
    cache: {
      size: cacheStats.size,
      maxSize: cacheStats.maxSize,
      calculatedSize: `${(cacheStats.calculatedSize / 1024 / 1024).toFixed(2)} MB`,
      keyCount: cacheStats.keys.length,
    },
  });
});

// API Routes
const apiRoutes = require('./src/routes/apiRoutes');
app.use('/api/projects', apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found',
    },
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: message,
      ...(config.server.env === 'development' && { stack: err.stack }),
    },
  });
});

// ===========================
// Server Start
// ===========================

async function startServer() {
  try {
    // Initialize database
    await initDatabase();

    // Start server
    const port = config.server.port;
    app.listen(port, () => {
      console.log('========================================');
      console.log(`🚀 Failure Tracker Backend API Started`);
      console.log(`📡 Server running on port ${port}`);
      console.log(`🌍 Environment: ${config.server.env}`);
      console.log(`💾 Database: ${config.database.path}`);
      console.log('========================================');
    });
  } catch (error) {
    console.error('�?Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  // 清理缓存
  cacheService.clearAll();
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  // 清理缓存
  cacheService.clearAll();
  await closeDatabase();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
