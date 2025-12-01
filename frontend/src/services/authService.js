import apiClient from './api';

/**
 * 认证服务
 */
export const authService = {
  // 用户登录
  async login(username, password) {
    return apiClient.post('/auth/login', {
      username,
      password,
    });
  },

  // 验证 token
  async verify() {
    return apiClient.get('/auth/verify');
  },

  // 从 localStorage 获取 token
  getToken() {
    return localStorage.getItem('auth_token');
  },

  // 保存 token 到 localStorage
  saveToken(token) {
    localStorage.setItem('auth_token', token);
  },

  // 清除 token
  clearToken() {
    localStorage.removeItem('auth_token');
  },

  // 检查是否已认证
  isAuthenticated() {
    return !!this.getToken();
  },
};

export default authService;
