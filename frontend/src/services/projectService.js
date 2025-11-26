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
  async getFilterOptions(projectId, currentFilters = {}) {
    return apiClient.get(`/projects/${projectId}/filter-options`, { params: currentFilters });
  },

  // Get analysis results
  async getAnalysis(projectId, filters = {}) {
    return apiClient.get(`/projects/${projectId}/analysis`, { params: filters });
  },

  // Get test analysis results
  async getTestAnalysis(projectId, filters = {}) {
    return apiClient.get(`/projects/${projectId}/analysis/test`, { params: filters });
  },

  // Get cross analysis results
  async getCrossAnalysis(projectId, dimension1, dimension2, filters = {}) {
    return apiClient.get(`/projects/${projectId}/analysis/cross`, {
      params: { dimension1, dimension2, ...filters },
    });
  },

  // Get filter statistics for FilterResultsPage
  async getFilterStatistics(projectId, filters = {}, includeTrend = false) {
    return apiClient.get(`/projects/${projectId}/filter-statistics`, {
      params: { ...filters, includeTrend },
    });
  },

  // Get sample sizes for matrix view
  async getSampleSizes(projectId) {
    return apiClient.get(`/projects/${projectId}/sample-sizes`);
  },

  // Get failure rate matrix data
  async getFailureRateMatrix(projectId, filters = {}) {
    return apiClient.get(`/projects/${projectId}/failure-rate-matrix`, { params: filters });
  },

  // Export to Excel (no charts)
  async exportExcel(projectId, filters = {}) {
    const response = await apiClient.get(`/projects/${projectId}/export/excel`, {
      params: filters,
      responseType: 'blob',
    });
    return response;
  },

  // Export Failure Rate Matrix to Excel
  async exportMatrix(projectId, filters = {}) {
    const response = await apiClient.get(`/projects/${projectId}/export/matrix`, {
      params: filters,
      responseType: 'blob',
    });
    return response;
  },

  // Export Cross Analysis to Excel
  async exportCrossAnalysis(projectId, dimension1, dimension2, filters = {}) {
    const response = await apiClient.get(`/projects/${projectId}/export/cross`, {
      params: { dimension1, dimension2, ...filters },
      responseType: 'blob',
    });
    return response;
  },
};
