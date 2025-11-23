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

  async loadFilterOptions(projectId) {
    set({ filterOptions: { ...get().filterOptions, loading: true, error: null } });
    try {
      const response = await projectService.getFilterOptions(projectId);
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
}));

export default useStore;
