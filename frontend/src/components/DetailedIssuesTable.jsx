import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Tooltip, Descriptions, Card } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import useStore from '../store';
import ColumnSelector from './ColumnSelector';

const DetailedIssuesTable = ({ projectId, useFilterResults = false }) => {
  const { issues, loadIssues, filters, filterResults, filterContext, loadFilterResults } = useStore();
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([]);

  // 根据是否使用筛选结果选择数据源
  const dataSource = useFilterResults ? filterResults : issues;
  const currentFilters = useFilterResults ? filterContext.appliedFilters : filters;

  // 只在非筛选结果模式下自动加载数据
  // 筛选结果模式下数据由 FilterResultsPage 加载
  useEffect(() => {
    if (projectId && !useFilterResults) {
      loadIssues(projectId, filters, issues.page, issues.limit);
    }
  }, [projectId, useFilterResults]);

  const handleTableChange = (pagination, tableFilters, sorter) => {
    // Handle pagination
    if (useFilterResults) {
      if (pagination.current !== filterResults.page || pagination.pageSize !== filterResults.limit) {
        loadFilterResults(projectId, filterContext.appliedFilters, pagination.current, pagination.pageSize);
      }
    } else {
      if (pagination.current !== issues.page || pagination.pageSize !== issues.limit) {
        loadIssues(projectId, filters, pagination.current, pagination.pageSize);
      }
    }
  };

  const expandedRowRender = (record) => {
    let rawData = {};
    try {
      rawData = typeof record.raw_data === 'string' 
        ? JSON.parse(record.raw_data) 
        : record.raw_data || {};
    } catch (e) {
      rawData = {};
    }

    const descriptionsItems = Object.entries(rawData).map(([key, value]) => ({
      key,
      label: key,
      children: String(value),
    }));

    return (
      <Descriptions
        bordered
        size="small"
        column={3}
        items={descriptionsItems}
      />
    );
  };

  const columns = [
    {
      title: 'FA#',
      dataIndex: 'fa_number',
      key: 'fa_number',
      width: 100,
      fixed: 'left',
      sorter: (a, b) => {
        const numA = parseInt(a.fa_number) || 0;
        const numB = parseInt(b.fa_number) || 0;
        return numA - numB;
      },
      ellipsis: { showTitle: false },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: 'Open Date',
      dataIndex: 'open_date',
      key: 'open_date',
      width: 110,
      sorter: (a, b) => {
        const dateA = a.open_date ? new Date(a.open_date).getTime() : 0;
        const dateB = b.open_date ? new Date(b.open_date).getTime() : 0;
        return dateA - dateB;
      },
      defaultSortOrder: 'descend',
    },
    {
      title: 'WF',
      dataIndex: 'wf',
      key: 'wf',
      width: 70,
      sorter: (a, b) => {
        const numA = parseInt(a.wf) || 0;
        const numB = parseInt(b.wf) || 0;
        return numA - numB;
      },
    },
    {
      title: 'Config',
      dataIndex: 'config',
      key: 'config',
      width: 100,
      sorter: (a, b) => (a.config || '').localeCompare(b.config || ''),
    },
    {
      title: 'Failed Location',
      dataIndex: 'failed_location',
      key: 'failed_location',
      width: 150,
      sorter: (a, b) => (a.failed_location || '').localeCompare(b.failed_location || ''),
      ellipsis: { showTitle: false },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: 'Symptom',
      dataIndex: 'symptom',
      key: 'symptom',
      width: 200,
      sorter: (a, b) => (a.symptom || '').localeCompare(b.symptom || ''),
      ellipsis: { showTitle: false },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: 'Failed Test',
      dataIndex: 'failed_test',
      key: 'failed_test',
      width: 180,
      sorter: (a, b) => (a.failed_test || '').localeCompare(b.failed_test || ''),
      ellipsis: { showTitle: false },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      sorter: (a, b) => (a.priority || '').localeCompare(b.priority || ''),
    },
    {
      title: 'Failure Type',
      dataIndex: 'failure_type',
      key: 'failure_type',
      width: 110,
      sorter: (a, b) => (a.failure_type || '').localeCompare(b.failure_type || ''),
      render: (text) => {
        const color = text === 'Spec.' ? 'blue' : text === 'Strife' ? 'orange' : 'default';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: 'Root Cause',
      dataIndex: 'root_cause',
      key: 'root_cause',
      width: 180,
      ellipsis: { showTitle: false },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: 'FA Status',
      dataIndex: 'fa_status',
      key: 'fa_status',
      width: 120,
      sorter: (a, b) => (a.fa_status || '').localeCompare(b.fa_status || ''),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 110,
      sorter: (a, b) => (a.department || '').localeCompare(b.department || ''),
    },
    {
      title: 'Owner',
      dataIndex: 'owner',
      key: 'owner',
      width: 120,
      ellipsis: { showTitle: false },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => {
        const isExpanded = expandedRowKeys.includes(record.id);
        return (
          <Button
            type="link"
            size="small"
            icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => {
              if (isExpanded) {
                setExpandedRowKeys(expandedRowKeys.filter((key) => key !== record.id));
              } else {
                setExpandedRowKeys([...expandedRowKeys, record.id]);
              }
            }}
          >
            {isExpanded ? '收起' : '展开'}
          </Button>
        );
      },
    },
  ];

  return (
    <Card
      title="Issue 详细数据"
      bordered={false}
      style={{
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
      }}
      extra={
        <ColumnSelector
          columns={columns}
          visibleColumns={visibleColumns}
          onColumnsChange={setVisibleColumns}
        />
      }
    >
      <Table
        columns={visibleColumns.length > 0 ? columns.filter(col => visibleColumns.includes(col.key) || col.key === 'action') : columns}
        dataSource={dataSource.data || dataSource.issues}
        loading={dataSource.loading}
        rowKey="id"
        pagination={{
          current: dataSource.page,
          pageSize: dataSource.limit,
          total: dataSource.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          pageSizeOptions: ['20', '50', '100'],
        }}
        onChange={handleTableChange}
        expandable={{
          expandedRowKeys,
          expandedRowRender,
          onExpandedRowsChange: setExpandedRowKeys,
        }}
        scroll={{ x: 'max-content' }}
        size="small"
      />
    </Card>
  );
};

export default DetailedIssuesTable;
