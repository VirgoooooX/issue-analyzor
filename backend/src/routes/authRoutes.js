const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// 注册接口
router.post('/register', authController.register);

// 登录接口（无需验证）
router.post('/login', authController.login);

// 验证 token 接口（需要验证）
router.get('/verify', authMiddleware, authController.verify);

module.exports = router;
