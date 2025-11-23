import { useState, useEffect } from 'react';
import {
  Drawer,
  Collapse,
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
const { Panel } = Collapse;

function FilterPanel() {
  const { filters, filterOptions, projects, setFilter, resetFilters, loadFilterOptions } = useStore();
  const [localFilters, setLocalFilters] = useState({});

  const currentProject = projects.current;
  const options = filterOptions.data;
  const loading = filterOptions.loading;

  // Load filter options when project changes
  useEffect(() => {
    if (currentProject?.id) {
      loadFilterOptions(currentProject.id);
    }
  }, [currentProject?.id]);

  // Initialize local filters from store
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

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
    // TODO: Trigger data refresh
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
      <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
            <FilterOutlined /> 数据筛选
          </div>
          
          {/* FA# Search */}
          <Input
            placeholder="搜索FA编号"
            prefix={<SearchOutlined />}
            value={localFilters.fa_search}
            onChange={(e) => handleFilterChange('fa_search', e.target.value)}
            allowClear
          />

          {/* Active Filter Tags */}
          {getActiveTags().length > 0 && (
            <div>
              {getActiveTags().map((tag, index) => (
                <Tag
                  key={index}
                  closable
                  onClose={() => handleRemoveTag(tag.key, tag.value)}
                  style={{ marginBottom: '4px' }}
                >
                  {tag.label}
                </Tag>
              ))}
            </div>
          )}
        </Space>
      </div>

      {/* Filters */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <Collapse defaultActiveKey={['basic', 'test']} ghost>
          {/* Basic Information */}
          <Panel header="基本信息" key="basic">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Open Date</div>
                <RangePicker
                  style={{ width: '100%' }}
                  value={[
                    localFilters.date_from ? dayjs(localFilters.date_from) : null,
                    localFilters.date_to ? dayjs(localFilters.date_to) : null,
                  ]}
                  onChange={(dates) => {
                    handleFilterChange('date_from', dates ? dates[0]?.format('YYYY-MM-DD') : null);
                    handleFilterChange('date_to', dates ? dates[1]?.format('YYYY-MM-DD') : null);
                  }}
                />
              </div>

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Priority</div>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="选择优先级"
                  value={localFilters.priorities}
                  onChange={(value) => handleFilterChange('priorities', value)}
                  options={options.priorities.map((p) => ({ label: p, value: p }))}
                  maxTagCount="responsive"
                />
              </div>

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>FA Status</div>
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
            </Space>
          </Panel>

          {/* Sample Information */}
          <Panel header="样本信息" key="sample">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Sample Status</div>
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

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Unit#</div>
                <Input
                  placeholder="输入Unit#"
                  value={localFilters.unit_number}
                  onChange={(e) => handleFilterChange('unit_number', e.target.value)}
                  allowClear
                />
              </div>

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>SN</div>
                <Input
                  placeholder="输入SN"
                  value={localFilters.sn}
                  onChange={(e) => handleFilterChange('sn', e.target.value)}
                  allowClear
                />
              </div>
            </Space>
          </Panel>

          {/* Test Configuration */}
          <Panel header="测试配置" key="test">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>WF</div>
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

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Config</div>
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

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Failed Test</div>
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

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Test ID</div>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="选择Test ID"
                  value={localFilters.test_ids}
                  onChange={(value) => handleFilterChange('test_ids', value)}
                  options={options.testIds.map((t) => ({ label: t, value: t }))}
                  maxTagCount="responsive"
                />
              </div>
            </Space>
          </Panel>

          {/* Failure Classification */}
          <Panel header="失败分类" key="failure">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Failure Type</div>
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

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Function or Cosmetic</div>
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

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Failed Location</div>
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
            </Space>
          </Panel>

          {/* Failure Details */}
          <Panel header="失败详情" key="details">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Failure Symptom</div>
                <Select
                  mode="multiple"
                  showSearch
                  style={{ width: '100%' }}
                  placeholder="选择症状"
                  value={localFilters.symptoms}
                  onChange={(value) => handleFilterChange('symptoms', value)}
                  options={options.symptoms.map((s) => ({ label: s, value: s }))}
                  maxTagCount="responsive"
                  filterOption={(input, option) =>
                    option.label.toLowerCase().includes(input.toLowerCase())
                  }
                />
              </div>

              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>Department</div>
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
            </Space>
          </Panel>
        </Collapse>
      </div>

      {/* Footer Actions */}
      <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0' }}>
        <Space style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<FilterOutlined />}
            onClick={handleApplyFilters}
            style={{ flex: 1 }}
          >
            应用筛选
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
            重置
          </Button>
        </Space>
      </div>
    </div>
  );
}

export default FilterPanel;
