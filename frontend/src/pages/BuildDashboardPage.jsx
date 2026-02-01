import { Spin } from 'antd';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useStore from '../store';
import DashboardPage from './DashboardPage';

function BuildDashboardPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const { projects, selectProject } = useStore();
  const { current, loading } = projects;

  useEffect(() => {
    if (!projectId) return;
    if (current?.id === projectId) return;
    selectProject(projectId);
  }, [projectId, current?.id]);

  if (!projectId) {
    return null;
  }

  if (loading || current?.id !== projectId) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  return <DashboardPage />;
}

export default BuildDashboardPage;

