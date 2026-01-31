import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, Spin, Empty, Button } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import FilterResultsPage from './pages/FilterResultsPage';
import FailureRateMatrixPage from './pages/FailureRateMatrixPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminUsersPage from './pages/AdminUsersPage';
import useStore from './store';

const { Content } = Layout;

function App() {
  const { projects, loadProjects, setUploadModalOpen, selectProject, auth, checkAuthStatus } = useStore();
  const { list, current, loading } = projects;
  const { isAuthenticated } = auth;

  console.log('🔍 Rendering App, auth state:', auth);

  // 检查认证状态
  useEffect(() => {
    console.log('🔍 App mounted, checking auth status...');
    const result = checkAuthStatus();
    console.log('🔍 checkAuthStatus result:', result);
  }, []);

  // 监听认证状态变化
  useEffect(() => {
    console.log('🔄 Auth state changed:', { isAuthenticated });
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects().then(() => {
        // 尝试从 localStorage 恢复上次选择的项目
        const savedProjectId = localStorage.getItem('currentProjectId');
        if (savedProjectId && !current) {
          selectProject(parseInt(savedProjectId));
        }
      });
    }
  }, [isAuthenticated, loadProjects, selectProject]);

  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        {isAuthenticated ? (
          <Layout style={{ height: '100vh' }}>
            <Header />
            <Content style={{ overflow: 'auto', background: '#f0f2f5' }}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route
                  path="/dashboard"
                  element={
                    current ? (
                      <DashboardPage />
                    ) : loading ? (
                      <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <Spin size="large" tip="Loading..." />
                      </div>
                    ) : list.length === 0 ? (
                      <Empty description="暂无项目，请上传Excel文件创建第一个项目" style={{ marginTop: '100px' }}>
                        <Button type="primary" size="large" onClick={() => setUploadModalOpen(true)}>
                          上传项目
                        </Button>
                      </Empty>
                    ) : (
                      <Empty description="请选择一个项目" style={{ marginTop: '100px' }} />
                    )
                  }
                />
                <Route
                  path="/filter-results"
                  element={
                    current ? (
                      <FilterResultsPage />
                    ) : list.length === 0 ? (
                      <Empty description="暂无项目，请上传Excel文件创建第一个项目" style={{ marginTop: '100px' }}>
                        <Button type="primary" size="large" onClick={() => setUploadModalOpen(true)}>
                          上传项目
                        </Button>
                      </Empty>
                    ) : (
                      <Empty description="请选择一个项目" style={{ marginTop: '100px' }} />
                    )
                  }
                />
                <Route
                  path="/failure-rate-matrix"
                  element={
                    current ? (
                      <FailureRateMatrixPage />
                    ) : list.length === 0 ? (
                      <Empty description="暂无项目，请上传Excel文件创建第一个项目" style={{ marginTop: '100px' }}>
                        <Button type="primary" size="large" onClick={() => setUploadModalOpen(true)}>
                          上传项目
                        </Button>
                      </Empty>
                    ) : (
                      <Empty description="请选择一个项目" style={{ marginTop: '100px' }} />
                    )
                  }
                />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Content>
          </Layout>
        ) : (
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        )}
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
