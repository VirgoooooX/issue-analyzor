import { Layout, Select, Button, Upload, Modal, message, Spin, Menu, Dropdown } from 'antd';
import { UploadOutlined, ReloadOutlined, DeleteOutlined, BarChartOutlined, DashboardOutlined, HomeOutlined, DownloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useStore from '../store';
import { projectService } from '../services/projectService';

const { Header: AntHeader } = Layout;

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, selectProject, uploadProject, deleteProject, setUploadModalOpen, ui, filterContext } = useStore();
  const { list, current, loading } = projects;
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleProjectChange = (projectId) => {
    selectProject(projectId);
    // 保存到 localStorage
    localStorage.setItem('currentProjectId', projectId);
  };

  const handleUpload = async (file) => {
    console.log('📤 Uploading file:', file);
    
    const formData = new FormData();
    formData.append('file', file);

    console.log('FormData created:', formData.get('file'));

    setUploading(true);
    try {
      await uploadProject(formData);
      message.success('项目上传成功！');
      setUploadModalOpen(false);
    } catch (error) {
      console.error('Upload error:', error);
      message.error(`上传失败: ${error.response?.data?.error?.message || error.message}`);
    } finally {
      setUploading(false);
    }

    return false; // Prevent automatic upload
  };

  const handleDelete = async () => {
    if (!current) return;

    Modal.confirm({
      title: '确认删除',
      content: `确定要完全删除项目 "${current.name}" 及其所有数据吗？此操作不可恢复！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          await deleteProject(current.id, true); // true 表示硬删除
          message.success('项目已完全删除');
        } catch (error) {
          message.error(`删除失败: ${error.message}`);
        }
      },
    });
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      message.loading({ content: '正在生成Excel报告...', key: 'export' });
      
      const filters = location.pathname === '/filter-results' ? filterContext.appliedFilters : {};
      const blob = await projectService.exportExcel(current?.id, filters);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${current?.name}_Analysis_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success({ content: 'Excel报告导出成功！', key: 'export' });
    } catch (error) {
      console.error('Export Excel failed:', error);
      message.error({ content: '导出失败，请重试', key: 'export' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportMatrix = async () => {
    try {
      setExporting(true);
      message.loading({ content: '正在生成失败率矩阵报告...', key: 'export' });
      
      const filters = location.pathname === '/filter-results' ? filterContext.appliedFilters : {};
      const blob = await projectService.exportMatrix(current?.id, filters);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${current?.name}_FailureRateMatrix_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success({ content: '失败率矩阵报告导出成功！', key: 'export' });
    } catch (error) {
      console.error('Export Matrix failed:', error);
      message.error({ content: '导出失败，请重试', key: 'export' });
    } finally {
      setExporting(false);
    }
  };

  const exportMenuItems = [
    {
      key: 'excel',
      label: '导出分析报告',
      onClick: handleExportExcel,
    },
    {
      key: 'matrix',
      label: '导出失败率矩阵',
      onClick: handleExportMatrix,
    },
  ];

  return (
    <AntHeader
      style={{
        background: '#001529',
        padding: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: '64px' }}>
        <h1 style={{ color: '#fff', margin: 0, fontSize: '20px', marginRight: '32px' }}>
          📊 Failure Tracker Dashboard
        </h1>

        {current && (
          <Menu
            mode="horizontal"
            selectedKeys={[location.pathname]}
            onClick={({ key }) => navigate(key)}
            style={{ 
              flex: 1, 
              background: 'transparent',
              border: 'none',
              lineHeight: '64px'
            }}
            theme="dark"
            items={[
              {
                key: '/dashboard',
                icon: <DashboardOutlined />,
                label: '仪表盘',
              },
              {
                key: '/failure-rate-matrix',
                icon: <BarChartOutlined />,
                label: '失败率矩阵',
              },
            ]}
          />
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Select
            placeholder="选择项目"
            value={current?.id}
            onChange={handleProjectChange}
            loading={loading}
            style={{ width: 360 }}
            optionLabelRender={(option) => {
              const project = list.find(p => p.id === option.value);
              if (!project) return option.label;
              // 格式化显示：项目名 + 上传时间 + issue数量
              const uploadTime = project.upload_time || '未知时间';
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>{project.name}</span>
                  <span style={{ marginLeft: '16px', color: '#999', fontSize: '12px' }}>({uploadTime}) {project.total_issues}📌</span>
                </div>
              );
            }}
            options={list.map((p) => ({
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span>{p.name}</span>
                  <span style={{ marginLeft: '16px', color: '#999', fontSize: '12px', whiteSpace: 'nowrap' }}>{p.upload_time}</span>
                </div>
              ),
              value: p.id,
              title: `${p.name} - 上传于 ${p.upload_time}`,  // 鼠标悬停提示
            }))}
          />

          <Button
            type="default"
            ghost
            icon={<UploadOutlined />}
            onClick={() => setUploadModalOpen(true)}
          >
            上传项目
          </Button>

          {current && (
            <>
              <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={exporting}
                >
                  导出报告
                </Button>
              </Dropdown>
              <Button
                type="default"
                ghost
                icon={<ReloadOutlined />}
                onClick={() => selectProject(current.id)}
              >
                刷新
              </Button>
              <Button
                type="primary"
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
              >
                删除
              </Button>
            </>
          )}
        </div>
      </div>

      <Modal
        title="上传Excel文件"
        open={ui.uploadModalOpen}
        onCancel={() => setUploadModalOpen(false)}
        footer={null}
      >
        <Upload.Dragger
          accept=".xlsx,.xls"
          beforeUpload={handleUpload}
          showUploadList={false}
        >
          {uploading ? (
            <Spin tip="上传中..." />
          ) : (
            <>
              <p className="ant-upload-drag-icon">
                <UploadOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽Excel文件到此区域</p>
              <p className="ant-upload-hint">
                支持 .xlsx 和 .xls 格式，文件大小不超过50MB
              </p>
            </>
          )}
        </Upload.Dragger>
      </Modal>
    </AntHeader>
  );
}

export default Header;
