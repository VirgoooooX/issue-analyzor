import { useEffect } from 'react';
import { ConfigProvider, Layout, Spin, Empty, Button } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
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
      <Layout style={{ height: '100vh' }}>
        <Header />
        <Content style={{ overflow: 'auto', background: '#f0f2f5', padding: '24px' }}>
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
            <Dashboard />
          ) : (
            <Empty description="请选择一个项目" style={{ marginTop: '100px' }} />
          )}
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
