-- Failure Tracker Dashboard - SQLite Database Initialization Script
-- Version: 1.0.0
-- Description: Creates 4 core tables for project management, issues, sample sizes, and analysis cache

-- ====================================
-- Table 1: projects (项目表)
-- ====================================
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    file_name TEXT,
    upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploader TEXT,
    status TEXT DEFAULT 'active',  -- active/archived/deleted
    total_issues INTEGER DEFAULT 0,
    config_names TEXT,  -- JSON数组，存储动态Config名称
    validation_report TEXT,  -- JSON对象，验证报告
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_upload_time ON projects(upload_time DESC);

-- ====================================
-- Table 2: issues (问题表)
-- ====================================
CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    fa_number TEXT NOT NULL,  -- FA编号（项目内唯一）
    open_date DATE,
    wf TEXT,  -- 工作流编号
    config TEXT,  -- 配置名称
    symptom TEXT,  -- 失败症状
    failed_test TEXT,  -- 失败测试项
    test_id TEXT,  -- 测试项编号 (Test1/Test2/Test3)
    priority TEXT,
    failure_type TEXT,  -- Spec./Strife
    root_cause TEXT,
    fa_status TEXT,
    department TEXT,
    owner TEXT,  -- 责任人
    sample_status TEXT,
    failed_location TEXT,
    function_or_cosmetic TEXT,
    multi_component TEXT,
    raw_data TEXT,  -- JSON字符串，存储原始30个字段
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Issues table indexes
CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_wf ON issues(wf);
CREATE INDEX IF NOT EXISTS idx_issues_config ON issues(config);
CREATE INDEX IF NOT EXISTS idx_issues_symptom ON issues(symptom);
CREATE INDEX IF NOT EXISTS idx_issues_open_date ON issues(open_date);
CREATE INDEX IF NOT EXISTS idx_issues_test_id ON issues(test_id);
CREATE INDEX IF NOT EXISTS idx_issues_fa_status ON issues(fa_status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_project_fa_number 
    ON issues(project_id, fa_number);

-- Composite indexes for common query patterns (性能优化)
CREATE INDEX IF NOT EXISTS idx_issues_project_wf ON issues(project_id, wf);
CREATE INDEX IF NOT EXISTS idx_issues_project_config ON issues(project_id, config);
CREATE INDEX IF NOT EXISTS idx_issues_project_symptom ON issues(project_id, symptom);
CREATE INDEX IF NOT EXISTS idx_issues_project_failed_test ON issues(project_id, failed_test);
CREATE INDEX IF NOT EXISTS idx_issues_project_date ON issues(project_id, open_date DESC);
CREATE INDEX IF NOT EXISTS idx_issues_project_failure_type ON issues(project_id, failure_type);
CREATE INDEX IF NOT EXISTS idx_issues_wf_config ON issues(wf, config);
CREATE INDEX IF NOT EXISTS idx_issues_failed_test ON issues(failed_test);
CREATE INDEX IF NOT EXISTS idx_issues_failure_type ON issues(failure_type);
CREATE INDEX IF NOT EXISTS idx_issues_department ON issues(department);

-- ====================================
-- Table 3: sample_sizes (样本量表)
-- ====================================
CREATE TABLE IF NOT EXISTS sample_sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    waterfall TEXT NOT NULL,  -- WF编号
    test_name TEXT,  -- 原始Test Name字符串
    tests TEXT,  -- JSON数组，拆分后的测试项
    config_samples TEXT,  -- JSON对象，动态Config的Sample Size
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Sample sizes table indexes
CREATE INDEX IF NOT EXISTS idx_sample_sizes_project ON sample_sizes(project_id);
CREATE INDEX IF NOT EXISTS idx_sample_sizes_wf ON sample_sizes(waterfall);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sample_sizes_project_wf 
    ON sample_sizes(project_id, waterfall);

-- ====================================
-- Table 4: analysis_cache (分析缓存表)
-- ====================================
CREATE TABLE IF NOT EXISTS analysis_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    cache_type TEXT NOT NULL,  -- symptom/wf/config/test/cross
    cache_data TEXT,  -- JSON对象，统计结果
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Analysis cache table indexes
CREATE INDEX IF NOT EXISTS idx_analysis_cache_project ON analysis_cache(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_cache_project_type 
    ON analysis_cache(project_id, cache_type);

-- ====================================
-- Database optimization settings
-- ====================================
-- Use DELETE journal mode for Docker compatibility
PRAGMA journal_mode=DELETE;
PRAGMA synchronous=NORMAL;
PRAGMA temp_store=MEMORY;
PRAGMA mmap_size=30000000000;

-- ====================================
-- Database initialization completed
-- ====================================
-- Run ANALYZE to optimize query plans
ANALYZE;
