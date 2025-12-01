import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, Spin, Empty, Button } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import FilterResultsPage from './pages/FilterResultsPage';
import FailureRateMatrixPage from './pages/FailureRateMatrixPage';
import LoginPage from './pages/LoginPage';
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

  // 如果未认证，显示登录页面
  if (!isAuthenticated) {
    console.log('🔄 Showing LoginPage because not authenticated');
    return (
      <ConfigProvider locale={zhCN}>
        <LoginPage />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Layout style={{ height: '100vh' }}>
          <Header />
          <Content style={{ overflow: 'auto', background: '#f0f2f5' }}>
            {loading && !current ? (
              <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" tip="Loading..." />
              </div>
            ) : !current && list.length === 0 ? (
              <Empty
                description="暂无项目，请上传Excel文件创建第一个项目"
                style={{ marginTop: '100px' }}
              >
                <Button type="primary" size="large" onClick={() => setUploadModalOpen(true)}>
                  上传项目
                </Button>
              </Empty>
            ) : current ? (
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/filter-results" element={<FilterResultsPage />} />
                <Route path="/failure-rate-matrix" element={<FailureRateMatrixPage />} />
              </Routes>
            ) : (
              <Empty description="请选择一个项目" style={{ marginTop: '100px' }} />
            )}
          </Content>
        </Layout>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
