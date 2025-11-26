import React, { useState, useEffect } from 'react';
import { Button, Drawer, Checkbox, Space, Divider } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const ColumnSelector = ({ columns, visibleColumns, onColumnsChange }) => {
  const [open, setOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState(visibleColumns || []);

  useEffect(() => {
    // Load saved column configuration from localStorage
    const savedColumns = localStorage.getItem('issueTableColumns');
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns);
        setSelectedColumns(parsed);
        onColumnsChange?.(parsed);
      } catch (e) {
        console.error('Failed to parse saved columns:', e);
        // Fallback: use all columns
        const allColumns = columns.map(col => col.key);
        setSelectedColumns(allColumns);
        onColumnsChange?.(allColumns);
      }
    } else {
      // Use default: all columns
      const allColumns = columns.map(col => col.key);
      setSelectedColumns(allColumns);
      onColumnsChange?.(allColumns);
    }
  }, [columns, onColumnsChange]);

  const handleColumnChange = (checkedValues) => {
    setSelectedColumns(checkedValues);
  };

  const handleApply = () => {
    // Save to localStorage
    localStorage.setItem('issueTableColumns', JSON.stringify(selectedColumns));
    
    // Notify parent component
    onColumnsChange?.(selectedColumns);
    
    setOpen(false);
  };

  const handleReset = () => {
    const defaultColumns = columns.map(col => col.key);
    setSelectedColumns(defaultColumns);
    localStorage.removeItem('issueTableColumns');
    onColumnsChange?.(defaultColumns);
  };

  const handleSelectAll = () => {
    const allColumnKeys = columns.map(col => col.key);
    setSelectedColumns(allColumnKeys);
  };

  const handleDeselectAll = () => {
    // Keep only fixed columns (like action column)
    const fixedColumns = columns.filter(col => col.fixed).map(col => col.key);
    setSelectedColumns(fixedColumns);
  };

  return (
    <>
      <Button
        icon={<SettingOutlined />}
        onClick={() => setOpen(true)}
        type="default"
      >
        列设置
      </Button>

      <Drawer
        title="列显示设置"
        placement="right"
        width={320}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button onClick={handleReset}>恢复默认</Button>
            <Space>
              <Button onClick={() => setOpen(false)}>取消</Button>
              <Button type="primary" onClick={handleApply}>
                应用
              </Button>
            </Space>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Button size="small" onClick={handleSelectAll}>
              全选
            </Button>
            <Button size="small" onClick={handleDeselectAll}>
              全不选
            </Button>
          </Space>

          <Divider style={{ margin: '12px 0' }} />

          <Checkbox.Group
            value={selectedColumns}
            onChange={handleColumnChange}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {columns.map((col) => (
                <Checkbox
                  key={col.key}
                  value={col.key}
                  disabled={col.fixed === 'left' || col.key === 'action'}
                >
                  {col.title}
                  {col.fixed && (
                    <span style={{ color: '#999', fontSize: '12px', marginLeft: '8px' }}>
                      (固定列)
                    </span>
                  )}
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </Space>
      </Drawer>
    </>
  );
};

export default ColumnSelector;
