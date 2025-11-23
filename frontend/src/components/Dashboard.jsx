import { Row, Col, Card, Statistic, Spin, Alert, Table, Layout } from 'antd';
import {
  BugOutlined,
  ExperimentOutlined,
  SettingOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useEffect } from 'react';
import useStore from '../store';
import FilterPanel from './FilterPanel';

const { Sider, Content } = Layout;

function Dashboard() {
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="正在加载分析数据..." />
      </div>
    );
  }

  if (error) {
    return <Alert message="加载失败" description={error} type="error" showIcon />;
  }

  if (!data) {
    return <Alert message="暂无数据" type="info" showIcon />;
  }

  const { overview, symptomStats, wfStats, configStats } = data;

  // Test analysis chart options
  const testChartOptions = testData?.testStats && testData.testStats.length > 0 ? {
    title: { text: 'Top 10 测试项失败率' },
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const data = params[0];
        const reversedIndex = testData.testStats.slice(0, 10).length - 1 - data.dataIndex;
        const testStat = testData.testStats.slice(0, 10).reverse()[data.dataIndex];
        return `
          <strong>${data.name}</strong><br/>
          WF: ${testStat.wf}<br/>
          失败数: ${testStat.failureCount}<br/>
          失败率: ${data.value.toLocaleString()} ppm<br/>
          占比: ${testStat.percentage}%
        `;
      }
    },
    xAxis: { type: 'value', name: 'Failure Rate (ppm)' },
    yAxis: {
      type: 'category',
      data: testData.testStats.slice(0, 10).map((t) => `${t.wf}-${t.testId}`).reverse(),
      axisLabel: {
        interval: 0,
        fontSize: 10,
      },
    },
    series: [
      {
        name: 'Failure Rate',
        type: 'bar',
        data: testData.testStats.slice(0, 10).map((t) => t.failureRate).reverse(),
        itemStyle: { color: '#faad14' },
      },
    ],
    grid: {
      left: '15%',
      right: '10%',
      bottom: '10%',
      top: '15%',
    },
  } : null;

  // Symptom chart options
  const symptomChartOptions = {
    title: { text: 'Top 10 Symptom失败率' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', name: 'Failure Rate (ppm)' },
    yAxis: {
      type: 'category',
      data: symptomStats.slice(0, 10).map((s) => s.symptom).reverse(),
    },
    series: [
      {
        name: 'Failure Rate',
        type: 'bar',
        data: symptomStats.slice(0, 10).map((s) => s.failureRate).reverse(),
        itemStyle: { color: '#1890ff' },
      },
    ],
  };

  // WF chart options
  const wfChartOptions = {
    title: { text: 'Top 10 WF失败率' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', name: 'Failure Rate (ppm)' },
    yAxis: {
      type: 'category',
      data: wfStats.slice(0, 10).map((w) => w.wf).reverse(),
    },
    series: [
      {
        name: 'Failure Rate',
        type: 'bar',
        data: wfStats.slice(0, 10).map((w) => w.failureRate).reverse(),
        itemStyle: { color: '#52c41a' },
      },
    ],
  };

  // Config table columns
  const configColumns = [
    { title: 'Config', dataIndex: 'config', key: 'config' },
    { title: 'Failure Count', dataIndex: 'failureCount', key: 'failureCount' },
    { title: 'Total Samples', dataIndex: 'totalSamples', key: 'totalSamples' },
    {
      title: 'Failure Rate (ppm)',
      dataIndex: 'failureRate',
      key: 'failureRate',
      sorter: (a, b) => a.failureRate - b.failureRate,
      render: (rate) => <span style={{ fontWeight: 'bold' }}>{rate.toLocaleString()}</span>,
    },
  ];

  return (
    <Layout style={{ height: '100%' }}>
      {/* Left Filter Panel */}
      <Sider width={300} style={{ background: '#fff', overflow: 'auto' }}>
        <FilterPanel />
      </Sider>

      {/* Main Content */}
      <Content style={{ padding: '24px', overflow: 'auto' }}>
        <div>
          {/* Overview Statistics */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总Issues数"
                  value={overview.totalIssues}
                  prefix={<BugOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="唯一Symptoms"
                  value={overview.uniqueSymptoms}
                  prefix={<WarningOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="测试WF数"
                  value={overview.uniqueWFs}
                  prefix={<ExperimentOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总体失败率"
                  value={overview.overallFailureRate}
                  suffix="ppm"
                  prefix={<SettingOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* Charts */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col span={12}>
              <Card>
                <ReactECharts option={symptomChartOptions} style={{ height: '400px' }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <ReactECharts option={wfChartOptions} style={{ height: '400px' }} />
              </Card>
            </Col>
          </Row>

          {/* Test Analysis Chart */}
          {testChartOptions && (
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col span={24}>
                <Card>
                  <ReactECharts option={testChartOptions} style={{ height: '400px' }} />
                </Card>
              </Col>
            </Row>
          )}

          {/* Config Stats Table */}
          <Card title="Config维度失败率统计" style={{ marginBottom: '24px' }}>
            <Table
              columns={configColumns}
              dataSource={configStats}
              rowKey="config"
              pagination={{ pageSize: 10 }}
            />
          </Card>

          {/* Project Info */}
          <Card title="项目信息">
            <p><strong>项目名称:</strong> {current.name}</p>
            <p><strong>文件名:</strong> {current.file_name}</p>
            <p><strong>上传时间:</strong> {new Date(current.upload_time).toLocaleString()}</p>
            <p>
              <strong>Config列表:</strong> {current.config_names.join(', ')}
            </p>
          </Card>
        </div>
      </Content>
    </Layout>
  );
}

export default Dashboard;
