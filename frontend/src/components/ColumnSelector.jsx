import React, { useState, useEffect } from 'react';
import { Button, Drawer, Checkbox, Space, Divider } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const ColumnSelector = ({ columns, visibleColumns, onColumnsChange }) => {
  const [open, setOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState(visibleColumns || []);

  useEffect(() => {
    // ... existing code ...
  }, [columns, onColumnsChange]);

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

          <Space direction="vertical" style={{ width: '100%' }}>
            {columns.map((col) => (
              <Checkbox
                key={col.key}
                checked={selectedColumns.includes(col.key)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedColumns([...selectedColumns, col.key]);
                  } else {
                    setSelectedColumns(selectedColumns.filter(k => k !== col.key));
                  }
                }}
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
        </Space>
      </Drawer>
    </>
  );
};

export default ColumnSelector;
