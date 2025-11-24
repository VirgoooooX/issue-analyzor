import { Layout } from 'antd';
import { useEffect } from 'react';
import useStore from '../store';
import FilterPanel from '../components/FilterPanel';
import AnalysisView from '../components/Dashboard';

const { Sider, Content } = Layout;

function DashboardPage() {
  const { projects, analysis, testAnalysis, loadTestAnalysis } = useStore();
  const { current } = projects;
  const { data, loading, error } = analysis;
  const testData = testAnalysis.data;

  // Load test analysis when project is selected
  useEffect(() => {
    if (current?.id) {
      loadTestAnalysis(current.id);
    }
  }, [current?.id]);

  // 构造统一的statistics数据结构
  const statistics = data?.overview ? {
    totalCount: data.overview.totalIssues,
    specCount: data.overview.specIssues,
    strifeCount: data.overview.strifeIssues,
    specSNCount: data.overview.specSNCount,  // 用于FR计算的去重SN数量
    strifeSNCount: data.overview.strifeSNCount,  // 用于FR计算的去重SN数量
    uniqueWFs: data.overview.uniqueWFs,
    uniqueSymptoms: data.overview.uniqueSymptoms,
    uniqueConfigs: data.overview.uniqueConfigs,
    totalSampleSize: data.overview.totalSampleSize
  } : null;

  return (
    <Layout style={{ height: '100%' }}>
      {/* Left Filter Panel */}
      <Sider width={300} style={{ background: '#fff', overflow: 'auto' }}>
        <FilterPanel />
      </Sider>

      {/* Main Content */}
      <Content style={{ padding: '24px', overflow: 'auto' }}>
        <AnalysisView
          statistics={statistics}
          symptomStats={data?.symptomStats}
          wfStats={data?.wfStats}
          testStats={testData?.testStats}
          configStats={data?.configStats}
          faStatusStats={data?.faStatusStats}
          projectInfo={current}
          projectId={current?.id}
          filters={null}
          loading={loading}
          error={error}
          showProjectInfo={true}
        />
        <div style={{ textAlign: 'center', marginTop: '24px', color: '#999', fontSize: '12px', padding: '20px 0' }}>
          <div>Issue Analyzer System ©2025 By Vigoss</div>
        </div>
      </Content>
    </Layout>
  );
}

export default DashboardPage;
