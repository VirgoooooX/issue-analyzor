import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, Spin, Empty, Button } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import FilterResultsPage from './pages/FilterResultsPage';
import useStore from './store';

const { Content } = Layout;

function App() {
  const { projects, loadProjects, setUploadModalOpen } = useStore();
  const { list, current, loading } = projects;

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

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
