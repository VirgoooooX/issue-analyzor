import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Drawer,
  Select,
  DatePicker,
  Input,
  Button,
  Tag,
  Space,
  Spin,
  Alert,
} from 'antd';
import {
  FilterOutlined,
  CloseOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useStore from '../store';

const { RangePicker } = DatePicker;

function FilterPanel() {
  const navigate = useNavigate();
  const { filters, filterOptions, projects, setFilter, resetFilters, loadFilterOptions, applyFilters } = useStore();
  const [localFilters, setLocalFilters] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);

  const currentProject = projects.current;
  const currentProjectId = currentProject?.id; // Store ID separately to avoid reference issues
  const options = filterOptions.data;
  const loading = filterOptions.loading;

  // Load filter options when project changes
  useEffect(() => {
    if (currentProjectId && !isInitialized) {
      loadFilterOptions(currentProjectId);
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  // Reload filter options when local filters change (级联筛选)
  // 实时更新其他筛选器的选项，但每个筛选器查询时会排除自己的条件
  // DISABLED - causing infinite loop
  /*
  useEffect(() => {
    if (currentProjectId && isInitialized) {
      // 只传递有值的筛选条件
      const activeFilters = {};
      Object.keys(localFilters).forEach(key => {
        const value = localFilters[key];
        if (Array.isArray(value) && value.length > 0) {
          activeFilters[key] = value;
        } else if (value && !Array.isArray(value) && value !== '') {
          activeFilters[key] = value;
        }
      });
      loadFilterOptions(currentProjectId, activeFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFilters, currentProjectId]);
  */

  // Initialize local filters from store - only on mount
  useEffect(() => {
    setLocalFilters(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

  const handleFilterChange = (key, value) => {
    setLocalFilters({
      ...localFilters,
      [key]: value,
    });
  };

  const handleApplyFilters = () => {
    Object.keys(localFilters).forEach((key) => {
      setFilter(key, localFilters[key]);
    });
    // 跳转到筛选结果页面
    applyFilters();
    // Encode filters and navigate to filter results page
    const filtersEncoded = btoa(JSON.stringify(localFilters));
    navigate(`/filter-results?filters=${filtersEncoded}&project=${currentProject.id}`);
  };

  const handleResetFilters = () => {
    resetFilters();
    setLocalFilters({
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
    });
  };

  const handleRemoveTag = (key, value) => {
    if (Array.isArray(localFilters[key])) {
      const newValue = localFilters[key].filter((v) => v !== value);
      handleFilterChange(key, newValue);
      setFilter(key, newValue);
    } else {
      handleFilterChange(key, '');
      setFilter(key, '');
    }
  };

  const getActiveTags = () => {
    const tags = [];
    
    if (localFilters.sn) {
      tags.push({ key: 'sn', label: `SN: ${localFilters.sn}`, value: localFilters.sn });
    }

    if (localFilters.fa_search) {
      tags.push({ key: 'fa_search', label: `FA#: ${localFilters.fa_search}`, value: localFilters.fa_search });
    }
    
    if (localFilters.date_from || localFilters.date_to) {
      const dateLabel = `${localFilters.date_from || '...'} ~ ${localFilters.date_to || '...'}`;
      tags.push({ key: 'date_range', label: `日期: ${dateLabel}` });
    }

    const arrayFilters = [
      { key: 'priorities', label: 'Priority' },
      { key: 'sample_statuses', label: 'Sample Status' },
      { key: 'departments', label: 'Department' },
      { key: 'wfs', label: 'WF' },
      { key: 'configs', label: 'Config' },
      { key: 'failed_tests', label: 'Failed Test' },
      { key: 'test_ids', label: 'Test ID' },
      { key: 'failure_types', label: 'Failure Type' },
      { key: 'function_cosmetic', label: 'Function/Cosmetic' },
      { key: 'failed_locations', label: 'Failed Location' },
      { key: 'symptoms', label: 'Symptom' },
      { key: 'fa_statuses', label: 'FA Status' },
    ];

    arrayFilters.forEach(({ key, label }) => {
      if (localFilters[key] && localFilters[key].length > 0) {
        localFilters[key].forEach((value) => {
          tags.push({ key, label: `${label}: ${value}`, value });
        });
      }
    });

    if (localFilters.unit_number) {
      tags.push({ key: 'unit_number', label: `Unit#: ${localFilters.unit_number}` });
    }
    
    if (localFilters.sn) {
      tags.push({ key: 'sn', label: `SN: ${localFilters.sn}` });
    }

    return tags;
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Spin tip="加载筛选选项..." />
      </div>
    );
  }

  if (!options) {
    return (
      <Alert message="请先选择一个项目" type="info" showIcon />
    );
  }

  return (
    <div style={{ width: '300px', height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #f0f0f0' }}>
      {/* Header */}
      <div style={{ padding: '16px 12px 12px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#262626' }}>
            <FilterOutlined style={{ marginRight: '8px' }} /> 数据筛选
          </div>
          
          {/* SN Search */}
          <Input
            placeholder="搜索SN"
            prefix={<SearchOutlined />}
            value={localFilters.sn}
            onChange={(e) => handleFilterChange('sn', e.target.value)}
            allowClear
          />

          {/* Action Buttons - 移到顶部 */}
          <Space style={{ width: '100%' }} size="small">
            <Button
              type="primary"
              icon={<FilterOutlined />}
              onClick={handleApplyFilters}
              style={{ flex: 1 }}
              block
            >
              应用筛选
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleResetFilters}
            >
              重置
            </Button>
          </Space>

          {/* Active Filter Tags */}
          {getActiveTags().length > 0 && (
            <div style={{ 
              maxHeight: '120px', 
              overflowY: 'auto',
              padding: '8px',
              background: '#fff',
              borderRadius: '4px',
              border: '1px solid #e8e8e8'
            }}>
              {getActiveTags().map((tag, index) => (
                <Tag
                  key={index}
                  closable
                  onClose={() => handleRemoveTag(tag.key, tag.value)}
                  style={{ marginBottom: '4px' }}
                  color="blue"
                >
                  {tag.label}
                </Tag>
              ))}
            </div>
          )}
        </Space>
      </div>

      {/* Filters */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Failure Symptom - 最重要 */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 600, color: '#1890ff', fontSize: '13px' }}>Failure Symptom</div>
            <Select
              mode="multiple"
              showSearch
              style={{ width: '100%' }}
              placeholder="选择失败症状"
              value={localFilters.symptoms}
              onChange={(value) => handleFilterChange('symptoms', value)}
              options={options.symptoms.map((s) => ({ label: s, value: s }))}
              maxTagCount="responsive"
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* Failed Location - 提高优先级 */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 600, color: '#fa8c16', fontSize: '13px' }}>Failed Location</div>
            <Select
              mode="multiple"
              showSearch
              style={{ width: '100%' }}
              placeholder="选择位置"
              value={localFilters.failed_locations}
              onChange={(value) => handleFilterChange('failed_locations', value)}
              options={options.failedLocations.map((l) => ({ label: l, value: l }))}
              maxTagCount="responsive"
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* WF */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>WF</div>
            <Select
              mode="multiple"
              showSearch
              style={{ width: '100%' }}
              placeholder="选择WF"
              value={localFilters.wfs}
              onChange={(value) => handleFilterChange('wfs', value)}
              options={options.wfs.map((w) => ({ label: w, value: w }))}
              maxTagCount="responsive"
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* Failed Test */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>Failed Test</div>
            <Select
              mode="multiple"
              showSearch
              style={{ width: '100%' }}
              placeholder="选择测试项"
              value={localFilters.failed_tests}
              onChange={(value) => handleFilterChange('failed_tests', value)}
              options={options.failedTests.map((t) => ({ label: t, value: t }))}
              maxTagCount="responsive"
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* Config */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>Config</div>
            <Select
              mode="multiple"
              showSearch
              style={{ width: '100%' }}
              placeholder="选择Config"
              value={localFilters.configs}
              onChange={(value) => handleFilterChange('configs', value)}
              options={options.configs.map((c) => ({ label: c, value: c }))}
              maxTagCount="responsive"
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* FA Status */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>FA Status</div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="选择FA状态"
              value={localFilters.fa_statuses}
              onChange={(value) => handleFilterChange('fa_statuses', value)}
              options={options.faStatuses.map((s) => ({ label: s, value: s }))}
              maxTagCount="responsive"
            />
          </div>

          {/* Open Date */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>Open Date</div>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
              value={[
                localFilters.date_from ? dayjs(localFilters.date_from) : null,
                localFilters.date_to ? dayjs(localFilters.date_to) : null,
              ]}
              onChange={(dates) => {
                if (dates) {
                  setLocalFilters({
                    ...localFilters,
                    date_from: dates[0]?.format('YYYY-MM-DD') || null,
                    date_to: dates[1]?.format('YYYY-MM-DD') || null,
                  });
                } else {
                  setLocalFilters({
                    ...localFilters,
                    date_from: null,
                    date_to: null,
                  });
                }
              }}
              format="YYYY-MM-DD"
            />
          </div>

          {/* Failure Type */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>Failure Type</div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="选择类型"
              value={localFilters.failure_types}
              onChange={(value) => handleFilterChange('failure_types', value)}
              options={options.failureTypes.map((t) => ({ label: t, value: t }))}
              maxTagCount="responsive"
            />
          </div>

          {/* Function or Cosmetic */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>Function or Cosmetic</div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="选择分类"
              value={localFilters.function_cosmetic}
              onChange={(value) => handleFilterChange('function_cosmetic', value)}
              options={options.functionCosmetic.map((f) => ({ label: f, value: f }))}
              maxTagCount="responsive"
            />
          </div>

          {/* Sample Status */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>Sample Status</div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="选择样本状态"
              value={localFilters.sample_statuses}
              onChange={(value) => handleFilterChange('sample_statuses', value)}
              options={options.sampleStatuses.map((s) => ({ label: s, value: s }))}
              maxTagCount="responsive"
            />
          </div>

          {/* Department */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>Department</div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="选择部门"
              value={localFilters.departments}
              onChange={(value) => handleFilterChange('departments', value)}
              options={options.departments.map((d) => ({ label: d, value: d }))}
              maxTagCount="responsive"
            />
          </div>

          {/* Unit# */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>Unit#</div>
            <Input
              placeholder="输入Unit#"
              value={localFilters.unit_number}
              onChange={(e) => handleFilterChange('unit_number', e.target.value)}
              allowClear
            />
          </div>

          {/* FA# */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500, fontSize: '13px' }}>FA#</div>
            <Input
              placeholder="输入FA#"
              value={localFilters.fa_search}
              onChange={(e) => handleFilterChange('fa_search', e.target.value)}
              allowClear
            />
          </div>
        </Space>
      </div>
    </div>
  );
}

export default React.memo(FilterPanel);
