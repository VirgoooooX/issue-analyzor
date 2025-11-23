import { Layout, Select, Button, Upload, Modal, message, Spin, Menu } from 'antd';
import { UploadOutlined, ReloadOutlined, DeleteOutlined, BarChartOutlined, DashboardOutlined, HomeOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useStore from '../store';

const { Header: AntHeader } = Layout;

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, selectProject, uploadProject, deleteProject, setUploadModalOpen, ui } = useStore();
  const { list, current, loading } = projects;
  const [uploading, setUploading] = useState(false);

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
            style={{ width: 300 }}
            options={list.map((p) => ({
              label: `${p.name} (${p.total_issues} issues)`,
              value: p.id,
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
