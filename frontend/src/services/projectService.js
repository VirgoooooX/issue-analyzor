import apiClient from './api';

/**
 * Project API Service
 */
export const projectService = {
  // Get all projects
  async getProjects(params = {}) {
    return apiClient.get('/projects', { params });
  },

  // Get project by ID
  async getProjectById(id) {
    return apiClient.get(`/projects/${id}`);
  },

  // Create new project (upload Excel)
  async createProject(formData) {
    return apiClient.post('/projects', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Delete project
  async deleteProject(id, hard = false) {
    return apiClient.delete(`/projects/${id}`, {
      params: { hard },
    });
  },

  // Get issues for a project
  async getIssues(projectId, filters = {}) {
    return apiClient.get(`/projects/${projectId}/issues`, { params: filters });
  },

  // Get filter options
  async getFilterOptions(projectId) {
    return apiClient.get(`/projects/${projectId}/filter-options`);
  },

  // Get analysis results
  async getAnalysis(projectId) {
    return apiClient.get(`/projects/${projectId}/analysis`);
  },

  // Get test analysis results
  async getTestAnalysis(projectId, filters = {}) {
    return apiClient.get(`/projects/${projectId}/analysis/test`, { params: filters });
  },
};
