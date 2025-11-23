import { create } from 'zustand';
import { projectService } from '../services/projectService';

const useStore = create((set, get) => ({
  // Projects state
  projects: {
    list: [],
    current: null,
    loading: false,
    error: null,
  },

  // Analysis data state
  analysis: {
    data: null,
    loading: false,
    error: null,
  },

  // Test analysis state
  testAnalysis: {
    data: null,
    loading: false,
    error: null,
  },

  // Filter options state
  filterOptions: {
    data: null,
    loading: false,
    error: null,
  },

  // Issues list state (filtered)
  issues: {
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    loading: false,
    error: null,
  },

  // Filter state (15 dimensions)
  filters: {
    date_from: null,
    date_to: null,
    priorities: [],
    sample_statuses: [],
    departments: [],
    unit_number: '',
    sn: '',
    wfs: [],
    configs: [],
    failed_tests: [],
    test_ids: [],
    failure_types: [],
    function_cosmetic: [],
    failed_locations: [],
    symptoms: [],
    fa_statuses: [],
    fa_search: '',
  },

  // UI state
  ui: {
    filterPanelOpen: true,
    uploadModalOpen: false,
  },

  // Cross analysis state
  crossAnalysis: {
    data: null,
    loading: false,
    error: null,
    dimension1: 'symptom',
    dimension2: 'config',
  },

  // Filter results page state
  filterResults: {
    issues: [],
    total: 0,
    page: 1,
    limit: 50,
    statistics: null,
    timeTrend: null,
    analysis: null, // 添加分析数据
    loading: false,
    error: null,
    activeTab: 'details',
  },

  // Filter context for FilterResultsPage
  filterContext: {
    appliedFilters: {},
    filterTags: [],
    sourceRoute: '/dashboard',
  },

  // Actions: Projects
  async loadProjects() {
    set({ projects: { ...get().projects, loading: true, error: null } });
    try {
      const response = await projectService.getProjects();
      set({
        projects: {
          list: response.data.projects,
          current: get().projects.current,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        projects: {
          ...get().projects,
          loading: false,
          error: error.message,
        },
      });
    }
  },

  async selectProject(projectId) {
    set({ projects: { ...get().projects, loading: true } });
    try {
      const project = await projectService.getProjectById(projectId);
      set({
        projects: {
          ...get().projects,
          current: project.data,
          loading: false,
        },
      });

      // Load analysis for selected project
      get().loadAnalysis(projectId);
    } catch (error) {
      set({
        projects: {
          ...get().projects,
          loading: false,
          error: error.message,
        },
      });
    }
  },

  async uploadProject(formData) {
    set({ projects: { ...get().projects, loading: true } });
    try {
      const response = await projectService.createProject(formData);
      
      // Reload projects list
      await get().loadProjects();
      
      // Select the newly created project
      await get().selectProject(response.data.project_id);
      
      return response.data;
    } catch (error) {
      set({
        projects: {
          ...get().projects,
          loading: false,
          error: error.message,
        },
      });
      throw error;
    }
  },

  async deleteProject(projectId, hard = false) {
    try {
      await projectService.deleteProject(projectId, hard);
      await get().loadProjects();
      
      // If current project was deleted, clear it
      if (get().projects.current?.id === projectId) {
        set({
          projects: { ...get().projects, current: null },
          analysis: { data: null, loading: false, error: null },
        });
      }
    } catch (error) {
      throw error;
    }
  },

  // Actions: Analysis
  async loadAnalysis(projectId) {
    set({ analysis: { data: null, loading: true, error: null } });
    try {
      const response = await projectService.getAnalysis(projectId);
      set({
        analysis: {
          data: response.data,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        analysis: {
          data: null,
          loading: false,
          error: error.message,
        },
      });
    }
  },

  async loadTestAnalysis(projectId, filters = {}) {
    set({ testAnalysis: { ...get().testAnalysis, loading: true, error: null } });
    try {
      const response = await projectService.getTestAnalysis(projectId, filters);
      set({
        testAnalysis: {
          data: response.data,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        testAnalysis: {
          data: null,
          loading: false,
          error: error.message,
        },
      });
    }
  },

  async loadFilterOptions(projectId, currentFilters = {}) {
    set({ filterOptions: { ...get().filterOptions, loading: true, error: null } });
    try {
      const response = await projectService.getFilterOptions(projectId, currentFilters);
      set({
        filterOptions: {
          data: response.data,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        filterOptions: {
          data: null,
          loading: false,
          error: error.message,
        },
      });
    }
  },

  async loadIssues(projectId, filters = {}, page = 1, limit = 20) {
    set({ issues: { ...get().issues, loading: true, error: null } });
    try {
      const response = await projectService.getIssues(projectId, {
        ...filters,
        page,
        limit,
      });
      set({
        issues: {
          data: response.data.issues,
          total: response.data.total,
          page: response.data.page,
          limit: response.data.limit,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        issues: {
          data: [],
          total: 0,
          page: 1,
          limit: 20,
          loading: false,
          error: error.message,
        },
      });
    }
  },

  applyFilters() {
    const { projects, filters, loadIssues } = get();
    if (projects.current?.id) {
      loadIssues(projects.current.id, filters, 1, 20);
    }
  },

  // Actions: Filters
  setFilter(filterName, value) {
    set({
      filters: {
        ...get().filters,
        [filterName]: value,
      },
    });
  },

  resetFilters() {
    set({
      filters: {
        date_from: null,
        date_to: null,
        priorities: [],
        sample_statuses: [],
        departments: [],
        unit_number: '',
        sn: '',
        wfs: [],
        configs: [],
        failed_tests: [],
        test_ids: [],
        failure_types: [],
        function_cosmetic: [],
        failed_locations: [],
        symptoms: [],
        fa_statuses: [],
        fa_search: '',
      },
    });
  },

  // Actions: UI
  toggleFilterPanel() {
    set({
      ui: {
        ...get().ui,
        filterPanelOpen: !get().ui.filterPanelOpen,
      },
    });
  },

  setUploadModalOpen(open) {
    set({
      ui: {
        ...get().ui,
        uploadModalOpen: open,
      },
    });
  },

  // Actions: Cross Analysis
  async loadCrossAnalysis(projectId, dimension1, dimension2, filters = {}) {
    set({ crossAnalysis: { ...get().crossAnalysis, loading: true, error: null } });
    try {
      const response = await projectService.getCrossAnalysis(projectId, dimension1, dimension2, filters);
      set({
        crossAnalysis: {
          data: response.data.crossAnalysis,
          loading: false,
          error: null,
          dimension1,
          dimension2,
        },
      });
    } catch (error) {
      set({
        crossAnalysis: {
          ...get().crossAnalysis,
          loading: false,
          error: error.message,
        },
      });
    }
  },

  setCrossAnalysisDimensions(dimension1, dimension2) {
    set({
      crossAnalysis: {
        ...get().crossAnalysis,
        dimension1,
        dimension2,
      },
    });
  },

  // Actions: Filter Results Page
  async loadFilterResults(projectId, filters, page = 1, limit = 50) {
    set({ filterResults: { ...get().filterResults, loading: true, error: null } });
    try {
      const [issuesResponse, statsResponse, analysisResponse] = await Promise.all([
        projectService.getIssues(projectId, { ...filters, page, limit }),
        projectService.getFilterStatistics(projectId, filters, true),
        projectService.getAnalysis(projectId, filters), // 加载筛选后的分析数据
      ]);

      set({
        filterResults: {
          ...get().filterResults,
          issues: issuesResponse.data.issues,
          total: issuesResponse.data.total,
          page: issuesResponse.data.page,
          limit: issuesResponse.data.limit,
          statistics: statsResponse.data.statistics,
          timeTrend: statsResponse.data.timeTrend,
          analysis: analysisResponse.data, // 保存分析数据
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        filterResults: {
          ...get().filterResults,
          loading: false,
          error: error.message,
        },
      });
    }
  },

  updateFilterContext(filters) {
    const tags = [];
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        value.forEach((v) => tags.push({ key, value: v }));
      } else if (value && !Array.isArray(value)) {
        tags.push({ key, value });
      }
    });

    set({
      filterContext: {
        appliedFilters: filters,
        filterTags: tags,
        sourceRoute: get().filterContext.sourceRoute,
      },
    });
  },

  removeFilterTag(tagKey, tagValue) {
    const filters = { ...get().filterContext.appliedFilters };
    if (Array.isArray(filters[tagKey])) {
      filters[tagKey] = filters[tagKey].filter((v) => v !== tagValue);
      if (filters[tagKey].length === 0) delete filters[tagKey];
    } else {
      delete filters[tagKey];
    }
    get().updateFilterContext(filters);
  },

  clearAllFilters() {
    set({
      filterContext: {
        appliedFilters: {},
        filterTags: [],
        sourceRoute: get().filterContext.sourceRoute,
      },
    });
  },

  setActiveTab(tab) {
    set({
      filterResults: {
        ...get().filterResults,
        activeTab: tab,
      },
    });
  },
}));

export default useStore;
