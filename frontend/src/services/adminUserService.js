import apiClient from './api';

export const adminUserService = {
  async listUsers(params = {}) {
    return apiClient.get('/admin/users', { params });
  },

  async createUser(payload) {
    return apiClient.post('/admin/users', payload);
  },

  async updateUser(id, payload) {
    return apiClient.patch(`/admin/users/${id}`, payload);
  },

  async deleteUser(id) {
    return apiClient.delete(`/admin/users/${id}`);
  },
};

export default adminUserService;
