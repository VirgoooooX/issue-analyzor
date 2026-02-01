import { Layout, Button, Upload, Modal, message, Spin, Menu, Dropdown } from 'antd';
import { UploadOutlined, ReloadOutlined, DeleteOutlined, BarChartOutlined, DashboardOutlined, LogoutOutlined, DownloadOutlined, TeamOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useStore from '../store';
import { projectService } from '../services/projectService';
import Logo from './Logo';

const { Header: AntHeader } = Layout;

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, selectProject, uploadProject, deleteProject, setUploadModalOpen, ui, filterContext, logout, auth } = useStore();
  const { current } = projects;
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isAdmin = auth?.role === 'admin';
  const isPowerUser = auth?.role === 'admin' || auth?.role === 'manager';

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      okText: '确认',
      cancelText: '取消',
      onOk() {
        logout();
        message.success('已退出登录');
      },
    });
  };

  const handleUpload = async (file) => {
    console.log('📤 Uploading file:', file);
    
    const formData = new FormData();
    formData.append('file', file);

    console.log('FormData created:', formData.get('file'));

    setUploading(true);
    try {
      const created = await uploadProject(formData);
      message.success('项目上传成功！');
      setUploadModalOpen(false);
      if (created?.project_id) {
        navigate(`/build/${created.project_id}`);
      }
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

  const selectedKey = (() => {
    if (location.pathname.startsWith('/build/')) return '/build';
    if (location.pathname.startsWith('/failure-rate-matrix')) return '/failure-rate-matrix';
    if (location.pathname.startsWith('/admin/users')) return '/admin/users';
    return '/dashboard';
  })();

  return (
    <AntHeader
      style={{
        background: '#001529',
        padding: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: '64px' }}>
        {/* 使用新 Logo */}
        <div style={{ marginRight: '32px', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
          <Logo light size={40} />
        </div>

        <Menu
          mode="horizontal"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => {
            if (key === '/build' && current?.id) {
              navigate(`/build/${current.id}`);
              return;
            }
            navigate(key);
          }}
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
              label: 'KPI面板',
            },
            ...(current
              ? [
                  {
                    key: '/build',
                    icon: <DashboardOutlined />,
                    label: 'Build仪表盘',
                  },
                  {
                    key: '/failure-rate-matrix',
                    icon: <BarChartOutlined />,
                    label: '失败率矩阵',
                  },
                ]
              : []),
            ...(isAdmin
              ? [
                  {
                    key: '/admin/users',
                    icon: <TeamOutlined />,
                    label: '用户管理',
                  },
                ]
              : []),
          ]}
        />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isPowerUser && (
            <Button
              type="default"
              ghost
              icon={<UploadOutlined />}
              onClick={() => setUploadModalOpen(true)}
            >
              上传项目
            </Button>
          )}

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
              {isAdmin && (
                <Button
                  type="primary"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDelete}
                >
                  删除
                </Button>
              )}
            </>
          )}
          
          {/* 退出按钮 */}
          <Button
            type="default"
            ghost
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            退出
          </Button>
        </div>
      </div>

      {isPowerUser && (
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
      )}
    </AntHeader>
  );
}

export default Header;
