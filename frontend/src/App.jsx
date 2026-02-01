import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Header from './components/Header';
import BuildDashboardPage from './pages/BuildDashboardPage';
import KpiDashboardPage from './pages/KpiDashboardPage';
import FilterResultsPage from './pages/FilterResultsPage';
import FailureRateMatrixPage from './pages/FailureRateMatrixPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminUsersPage from './pages/AdminUsersPage';
import useStore from './store';

const { Content } = Layout;

function App() {
  const { projects, loadProjects, selectProject, auth, checkAuthStatus } = useStore();
  const { current } = projects;
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
                <Route path="/dashboard" element={<KpiDashboardPage />} />
                <Route path="/build/:id" element={<BuildDashboardPage />} />
                <Route
                  path="/filter-results"
                  element={
                    current ? (
                      <FilterResultsPage />
                    ) : (
                      <Navigate to="/dashboard" replace />
                    )
                  }
                />
                <Route
                  path="/failure-rate-matrix"
                  element={
                    current ? (
                      <FailureRateMatrixPage />
                    ) : (
                      <Navigate to="/dashboard" replace />
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
