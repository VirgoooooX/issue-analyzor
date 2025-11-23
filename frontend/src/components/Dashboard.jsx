import { Row, Col, Card, Statistic, Spin, Alert, Table } from 'antd';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  BugOutlined,
  ExperimentOutlined,
  SettingOutlined,
  WarningOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import useStore from '../store';
import ReactECharts from 'echarts-for-react';
import CrossAnalysisHeatmap from './CrossAnalysisHeatmap';

// 统一的字体样式配置
const FONT_STYLES = {
  // ... existing code ...
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#595959',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  chartValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#262626',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  legend: {
    fontSize: 12,
    color: '#595959',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626'
  },
  tableHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#262626'
  },
  tableBody: {
    fontSize: 13,
    color: '#595959'
  },
  statisticValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#262626',
    lineHeight: 1.2
  },
  statisticTitle: {
    fontSize: 14,
    color: '#8c8c8c',
    fontWeight: '500'
  }
};

/**
 * 通用分析视图组件
 * @param {Object} props
 * @param {Object} props.statistics - 统计数据 { totalCount, specCount, strifeCount, uniqueWFs, uniqueConfigs, totalSampleSize }
 * @param {Array} props.symptomStats - Symptom统计数据
 * @param {Array} props.wfStats - WF统计数据
 * @param {Array} props.testStats - 测试项统计数据
 * @param {Array} props.configStats - Config统计数据
 * @param {Array} props.faStatusStats - FA Status分布数据
 * @param {Object} props.projectInfo - 项目信息（可选）
 * @param {string} props.projectId - 项目ID
 * @param {Object} props.filters - 筛选条件（用于交叉分析）
 * @param {boolean} props.loading - 加载状态
 * @param {string} props.error - 错误信息
 * @param {boolean} props.showProjectInfo - 是否显示项目信息
 */
function AnalysisView({
  statistics,
  symptomStats,
  wfStats,
  testStats,
  configStats,
  faStatusStats,
  projectInfo,
  projectId,
  filters,
  loading = false,
  error = null,
  showProjectInfo = false
}) {
  const navigate = useNavigate();
  const { setFilter, applyFilters, projects } = useStore();
  const [todayStats, setTodayStats] = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);

  // Load today's statistics
  React.useEffect(() => {
    const loadTodayStats = async () => {
      if (!projectId) return;
      
      try {
        setTodayLoading(true);
        const today = dayjs().format('YYYY-MM-DD');
        
        // Use the analysis service to get today's stats
        const response = await fetch(
          `/api/analysis/filter-statistics/${projectId}?date_from=${today}&date_to=${today}`
        );
        const result = await response.json();
        
        if (result.success && result.data?.statistics) {
          const stats = result.data.statistics;
          setTodayStats({
            totalCount: stats.totalCount,
            specCount: stats.specCount,
            strifeCount: stats.strifeCount
          });
        } else {
          setTodayStats({
            totalCount: 0,
            specCount: 0,
            strifeCount: 0
          });
        }
      } catch (error) {
        console.error('Failed to load today stats:', error);
        setTodayStats({
          totalCount: 0,
          specCount: 0,
          strifeCount: 0
        });
      } finally {
        setTodayLoading(false);
      }
    };
    
    loadTodayStats();
  }, [projectId]);

  const handleTodayClick = async () => {
    const today = dayjs().format('YYYY-MM-DD');
    
    // Merge date filters with existing filters
    const mergedFilters = {
      ...filters,
      date_from: today,
      date_to: today
    };
    
    // Set merged filters
    Object.keys(mergedFilters).forEach((key) => {
      setFilter(key, mergedFilters[key]);
    });
    
    // Small delay to ensure state is updated
    setTimeout(() => {
      applyFilters();
      // Navigate to filter results page
      const filtersEncoded = btoa(JSON.stringify(mergedFilters));
      navigate(`/filter-results?filters=${filtersEncoded}&project=${projectId}`);
    }, 100);
  };

  // Handle chart click events - merge with existing filters
  const handleChartClick = (dimensionType, dimensionValue) => {
    // Merge new filter with existing filters
    const newFilterValue = Array.isArray(dimensionValue) ? dimensionValue : [dimensionValue];
    const currentFilters = filters || {};
    const existingValue = currentFilters[dimensionType] || [];
    
    // Combine values - avoid duplicates
    const combinedValue = Array.isArray(existingValue) 
      ? [...new Set([...existingValue, ...newFilterValue])]
      : newFilterValue;
    
    // Create merged filters object
    const mergedFilters = {
      ...currentFilters,
      [dimensionType]: combinedValue
    };
    
    // Update store with merged filters
    Object.keys(mergedFilters).forEach((key) => {
      setFilter(key, mergedFilters[key]);
    });
    
    setTimeout(() => {
      applyFilters();
      const filtersEncoded = btoa(JSON.stringify(mergedFilters));
      navigate(`/filter-results?filters=${filtersEncoded}&project=${projectId}`);
    }, 100);
  };

  // Handle table row click events
  const handleTableRowClick = (dimensionType, dimensionValue) => {
    handleChartClick(dimensionType, dimensionValue);
  };

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

  if (!statistics) {
    return <Alert message="暂无数据" type="info" showIcon />;
  }

  // Test analysis chart options
  const testChartOptions = testStats && testStats.length > 0 ? {
    title: { 
      text: 'Top 10 测试项 Spec.失败率',
      ...FONT_STYLES.chartTitle,
      left: 'center'
    },
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' },
      textStyle: FONT_STYLES.chartLabel,
      formatter: (params) => {
        const data = params[0];
        const testStat = testStats.slice(0, 10).reverse()[data.dataIndex];
        return `
          <strong>${testStat.testName}</strong><br/>
          WF: ${testStat.wfs}<br/>
          <span style="display:inline-block;width:10px;height:10px;background:rgba(255,107,107,0.6);border-radius:2px;margin-right:5px;"></span>
          Spec.失败率: <strong style="color:#ff6b6b">${testStat.specCount}F/${testStat.totalSamples}T</strong><br/>
          <span style="display:inline-block;width:10px;height:10px;background:rgba(255,193,7,0.6);border-radius:2px;margin-right:5px;"></span>
          Strife失败率: <strong style="color:#ffc107">${testStat.strifeCount}SF/${testStat.totalSamples}T</strong><br/>
          占比: ${testStat.percentage}%
        `;
      }
    },
    grid: {
      left: '3%',
      right: '100px',
      top: '15%',
      bottom: '5%',
      containLabel: false
    },
    xAxis: { 
      type: 'value', 
      name: '',
      axisLabel: FONT_STYLES.chartLabel
    },
    yAxis: [
      {
        type: 'category',
        data: testStats.slice(0, 10).map((t, index) => index).reverse(),
        axisLabel: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLine: {
          show: false
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed'
          }
        }
      },
      {
        type: 'category',
        position: 'right',
        data: testStats.slice(0, 10).map((t) => `${t.specCount}F/${t.totalSamples}T`).reverse(),
        axisLabel: {
          show: true,
          ...FONT_STYLES.chartValue,
          margin: 10,
          backgroundColor: 'rgba(255, 107, 107, 0.15)',
          borderRadius: 3,
          padding: [4, 8],
          borderColor: 'rgba(255, 107, 107, 0.3)',
          borderWidth: 1
        },
        axisTick: {
          show: false
        },
        axisLine: {
          show: false
        },
        splitLine: {
          show: false
        }
      }
    ],
    series: [
      {
        name: 'Spec. Failure Rate',
        type: 'bar',
        data: testStats.slice(0, 10).map((t) => t.specFailureRate).reverse(),
        itemStyle: { 
          color: 'rgba(250, 173, 20, 0.35)',
          borderRadius: [0, 4, 4, 0]
        },
        barMaxWidth: 40,
        label: {
          show: true,
          position: 'insideLeft',
          ...FONT_STYLES.chartLabel,
          align: 'left',
          offset: [10, 0],
          formatter: (params) => {
            const stat = testStats.slice(0, 10).reverse()[params.dataIndex];
            const label = stat.testName;
            return label.length > 45 ? label.substring(0, 45) + '...' : label;
          }
        },
        z: 0
      },
    ],
    // ... existing code ...
  } : null;

  // Symptom chart options
  const symptomChartOptions = symptomStats && symptomStats.length > 0 ? {
    title: { 
      text: 'Top 10 Symptom Spec.失败率',
      ...FONT_STYLES.chartTitle,
      left: 'center'
    },
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' },
      textStyle: FONT_STYLES.chartLabel,
      formatter: (params) => {
        const data = params[0];
        const stat = symptomStats.slice(0, 10).reverse()[data.dataIndex];
        return `
          <strong>${stat.symptom}</strong><br/>
          <span style="display:inline-block;width:10px;height:10px;background:rgba(255,107,107,0.6);border-radius:2px;margin-right:5px;"></span>
          Spec.失败率: <strong style="color:#ff6b6b">${stat.specCount}F/${stat.totalSamples}T</strong><br/>
          <span style="display:inline-block;width:10px;height:10px;background:rgba(255,193,7,0.6);border-radius:2px;margin-right:5px;"></span>
          Strife失败率: <strong style="color:#ffc107">${stat.strifeCount}SF/${stat.totalSamples}T</strong>
        `;
      }
    },
    grid: {
      left: '3%',
      right: '100px',
      top: '15%',
      bottom: '5%',
      containLabel: false
    },
    xAxis: { 
      type: 'value', 
      name: '',
      axisLabel: FONT_STYLES.chartLabel
    },
    yAxis: [
      {
        type: 'category',
        data: symptomStats.slice(0, 10).map((s, index) => index).reverse(),
        axisLabel: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLine: {
          show: false
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed'
          }
        }
      },
      {
        type: 'category',
        position: 'right',
        data: symptomStats.slice(0, 10).map((s) => `${s.specCount}F/${s.totalSamples}T`).reverse(),
        axisLabel: {
          show: true,
          ...FONT_STYLES.chartValue,
          margin: 10,
          backgroundColor: 'rgba(255, 107, 107, 0.15)',
          borderRadius: 3,
          padding: [4, 8],
          borderColor: 'rgba(255, 107, 107, 0.3)',
          borderWidth: 1
        },
        axisTick: {
          show: false
        },
        axisLine: {
          show: false
        },
        splitLine: {
          show: false
        }
      }
    ],
    series: [
      {
        name: 'Spec. Failure Rate',
        type: 'bar',
        data: symptomStats.slice(0, 10).map((s) => s.specFailureRate).reverse(),
        itemStyle: { 
          color: 'rgba(24, 144, 255, 0.35)',
          borderRadius: [0, 4, 4, 0]
        },
        barMaxWidth: 40,
        label: {
          show: true,
          position: 'insideLeft',
          ...FONT_STYLES.chartLabel,
          align: 'left',
          offset: [10, 0],
          formatter: (params) => {
            const stat = symptomStats.slice(0, 10).reverse()[params.dataIndex];
            const label = stat.symptom;
            return label.length > 45 ? label.substring(0, 45) + '...' : label;
          }
        },
        z: 0
      },
    ],
  } : null;

  // WF chart options
  const wfChartOptions = {
    title: { 
      text: 'Top 10 WF Spec.失败率',
      ...FONT_STYLES.chartTitle,
      left: 'center'
    },
    tooltip: { 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' },
      textStyle: FONT_STYLES.chartLabel,
      formatter: (params) => {
        const data = params[0];
        const stat = wfStats.slice(0, 10).reverse()[data.dataIndex];
        return `
          <strong>WF: ${stat.wf}</strong><br/>
          Test: ${stat.testName || 'N/A'}<br/>
          <span style="display:inline-block;width:10px;height:10px;background:rgba(255,107,107,0.6);border-radius:2px;margin-right:5px;"></span>
          Spec.失败率: <strong style="color:#ff6b6b">${stat.specCount}F/${stat.totalTests}T</strong><br/>
          <span style="display:inline-block;width:10px;height:10px;background:rgba(255,193,7,0.6);border-radius:2px;margin-right:5px;"></span>
          Strife失败率: <strong style="color:#ffc107">${stat.strifeCount}SF/${stat.totalTests}T</strong>
        `;
      }
    },
    grid: {
      left: '3%',
      right: '100px',
      top: '15%',
      bottom: '5%',
      containLabel: false
    },
    xAxis: { 
      type: 'value', 
      name: '',
      axisLabel: FONT_STYLES.chartLabel
    },
    yAxis: [
      {
        type: 'category',
        data: wfStats.slice(0, 10).map((w, index) => index).reverse(),
        axisLabel: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLine: {
          show: false
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed'
          }
        }
      },
      {
        type: 'category',
        position: 'right',
        data: wfStats.slice(0, 10).map((w) => `${w.specCount}F/${w.totalTests}T`).reverse(),
        axisLabel: {
          show: true,
          ...FONT_STYLES.chartValue,
          margin: 10,
          backgroundColor: 'rgba(255, 107, 107, 0.15)',
          borderRadius: 3,
          padding: [4, 8],
          borderColor: 'rgba(255, 107, 107, 0.3)',
          borderWidth: 1
        },
        axisTick: {
          show: false
        },
        axisLine: {
          show: false
        },
        splitLine: {
          show: false
        }
      }
    ],
    series: [
      {
        name: 'Spec. Failure Rate',
        type: 'bar',
        data: wfStats.slice(0, 10).map((w) => w.specFailureRate).reverse(),
        itemStyle: { 
          color: 'rgba(82, 196, 26, 0.35)',
          borderRadius: [0, 4, 4, 0]
        },
        barMaxWidth: 40,
        label: {
          show: true,
          position: 'insideLeft',
          ...FONT_STYLES.chartLabel,
          align: 'left',
          offset: [10, 0],
          formatter: (params) => {
            const stat = wfStats.slice(0, 10).reverse()[params.dataIndex];
            const testName = stat.testName || 'N/A';
            const label = `WF ${stat.wf} - ${testName}`;
            return label.length > 45 ? label.substring(0, 45) + '...' : label;
          }
        },
        z: 0
      },
    ],
  };

  // Config table columns
  const configColumns = [
    { 
      title: 'Config', 
      dataIndex: 'config', 
      key: 'config',
      onHeaderCell: () => ({ style: FONT_STYLES.tableHeader }),
      onCell: () => ({ style: FONT_STYLES.tableBody })
    },
    { 
      title: 'Spec. Failure Count', 
      dataIndex: 'specCount', 
      key: 'specCount',
      onHeaderCell: () => ({ style: FONT_STYLES.tableHeader }),
      render: (count, record) => (
        <span style={FONT_STYLES.tableBody}>
          <span style={{ 
            backgroundColor: 'rgba(255, 107, 107, 0.15)', 
            padding: '2px 6px', 
            borderRadius: '3px',
            fontWeight: '500',
            color: '#ff6b6b'
          }}>
            {count}
          </span>
          {' '}
          <span style={{ ...FONT_STYLES.tableBody, color: '#999' }}>
            (+{record.strifeCount}
            <span style={{ 
              backgroundColor: 'rgba(255, 193, 7, 0.15)', 
              padding: '2px 4px', 
              borderRadius: '3px',
              marginLeft: '2px',
              color: '#ffc107'
            }}>SF</span>)
          </span>
        </span>
      ),
    },
    { 
      title: 'Total Samples', 
      dataIndex: 'totalSamples', 
      key: 'totalSamples',
      onHeaderCell: () => ({ style: FONT_STYLES.tableHeader }),
      onCell: () => ({ style: FONT_STYLES.tableBody })
    },
    {
      title: 'Spec. Failure Rate',
      dataIndex: 'specFailureRate',
      key: 'specFailureRate',
      sorter: (a, b) => a.specFailureRate - b.specFailureRate,
      onHeaderCell: () => ({ style: FONT_STYLES.tableHeader }),
      render: (rate, record) => (
        <div style={FONT_STYLES.tableBody}>
          <span style={{ fontWeight: '500' }}>
            <span style={{ 
              backgroundColor: 'rgba(255, 107, 107, 0.15)', 
              padding: '2px 6px', 
              borderRadius: '3px',
              color: '#ff6b6b'
            }}>
              {record.specCount}F
            </span>
            /{record.totalSamples}T
          </span>
          <br/>
          <span style={{ ...FONT_STYLES.tableBody, color: '#999', fontSize: '11px' }}>
            Strife: 
            <span style={{ 
              backgroundColor: 'rgba(255, 193, 7, 0.15)', 
              padding: '2px 4px', 
              borderRadius: '3px',
              color: '#ffc107'
            }}>
              {record.strifeCount}SF
            </span>
            /{record.totalSamples}T
          </span>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Overview Statistics - Including Today's Issues */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px', width: '100%' }}>
        {/* Today's Issues Mini Card */}
        <Col flex="1 1 20%">
          <Card 
            bordered={false}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)',
              borderRadius: '8px',
              height: '140px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              opacity: todayLoading ? 0.7 : 1,
              position: 'relative',
              padding: '16px'
            }}
            bodyStyle={{ padding: 0, height: '100%' }}
            onClick={handleTodayClick}
            onMouseEnter={(e) => {
              if (!todayLoading) {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {todayLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Spin size="small" style={{ color: '#fff' }} />
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  opacity: 0.95,
                  letterSpacing: '0.5px'
                }}>
                  <CalendarOutlined style={{ marginRight: '4px', fontSize: '13px' }} />
                  今日
                </div>
                <div style={{ textAlign: 'center', fontSize: '48px', fontWeight: '700', lineHeight: '1' }}>
                  {todayStats?.totalCount || 0}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  opacity: 0.85,
                  background: 'rgba(255,255,255,0.1)',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  alignSelf: 'flex-end'
                }}>
                  F:{todayStats?.specCount || 0} SF:{todayStats?.strifeCount || 0}
                </div>
              </div>
            )}
          </Card>
        </Col>
        {/* Total Issues Card */}
        <Col flex="1 1 20%">
          <Card 
            bordered={false}
            style={{
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              borderRadius: '8px',
              height: '140px',
              position: 'relative',
              padding: '16px'
            }}
            bodyStyle={{ padding: 0, height: '100%' }}
          >
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ 
                fontSize: '12px', 
                color: '#8c8c8c', 
                fontWeight: '500',
                letterSpacing: '0.5px'
              }}>
                <BugOutlined style={{ marginRight: '6px', color: '#1890ff', fontSize: '13px' }} />
                总Issues数
              </div>
              <div style={{ textAlign: 'center', fontSize: '48px', fontWeight: '700', color: '#1890ff', lineHeight: '1' }}>
                {statistics.totalCount}
              </div>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                <span style={{ 
                  background: '#fff1f0', 
                  padding: '4px 6px', 
                  borderRadius: '3px',
                  color: '#ff4d4f',
                  fontWeight: '600',
                  fontSize: '10px'
                }}>
                  {statistics.specCount}F
                </span>
                <span style={{ 
                  background: '#fffbe6', 
                  padding: '4px 6px', 
                  borderRadius: '3px',
                  color: '#faad14',
                  fontWeight: '600',
                  fontSize: '10px'
                }}>
                  {statistics.strifeCount}SF
                </span>
              </div>
            </div>
          </Card>
        </Col>
        <Col flex="1 1 20%">
          <Card 
            bordered={false}
            style={{
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              borderRadius: '8px',
              height: '140px',
              position: 'relative',
              padding: '16px'
            }}
            bodyStyle={{ padding: 0, height: '100%' }}
          >
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ 
                fontSize: '12px', 
                color: '#8c8c8c', 
                fontWeight: '500',
                letterSpacing: '0.5px'
              }}>
                <WarningOutlined style={{ marginRight: '6px', color: '#faad14', fontSize: '13px' }} />
                症状数
              </div>
              <div style={{ textAlign: 'center', fontSize: '54px', fontWeight: '700', color: '#faad14', lineHeight: '1' }}>
                {statistics.uniqueSymptoms || (symptomStats ? symptomStats.length : 0)}
              </div>
              <div style={{ height: '22px' }}></div>
            </div>
          </Card>
        </Col>
        <Col flex="1 1 20%">
          <Card 
            bordered={false}
            style={{
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              borderRadius: '8px',
              height: '140px',
              position: 'relative',
              padding: '16px'
            }}
            bodyStyle={{ padding: 0, height: '100%' }}
          >
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ 
                fontSize: '12px', 
                color: '#8c8c8c', 
                fontWeight: '500',
                letterSpacing: '0.5px'
              }}>
                <ExperimentOutlined style={{ marginRight: '6px', color: '#52c41a', fontSize: '13px' }} />
                WF数
              </div>
              <div style={{ textAlign: 'center', fontSize: '54px', fontWeight: '700', color: '#52c41a', lineHeight: '1' }}>
                {statistics.uniqueWFs}
              </div>
              <div style={{ height: '22px' }}></div>
            </div>
          </Card>
        </Col>
        <Col flex="1 1 20%">
          <Card 
            bordered={false}
            style={{
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              borderRadius: '8px',
              height: '140px',
              position: 'relative',
              padding: '16px'
            }}
            bodyStyle={{ padding: 0, height: '100%' }}
          >
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ 
                fontSize: '12px', 
                color: '#8c8c8c', 
                fontWeight: '500',
                letterSpacing: '0.5px'
              }}>
                <SettingOutlined style={{ marginRight: '6px', color: '#ff4d4f', fontSize: '13px' }} />
                失败率
              </div>
              <div style={{ textAlign: 'center', fontSize: '48px', fontWeight: '700', color: '#ff4d4f', lineHeight: '1' }}>
                {statistics.specCount}F
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end', fontSize: '10px' }}>
                <span style={{ 
                  color: '#8c8c8c',
                  fontWeight: '500'
                }}>
                  /{statistics.totalSampleSize}T
                </span>
                <span style={{ 
                  background: '#fffbe6', 
                  padding: '3px 6px', 
                  borderRadius: '3px',
                  color: '#faad14',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}>
                  Strife {statistics.strifeCount}SF
                </span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

          {/* Charts */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col span={8}>
              <Card 
                bordered={false}
                style={{
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderRadius: '8px'
                }}
              >
                {symptomChartOptions ? (
                  <ReactECharts 
                    option={{
                      ...symptomChartOptions,
                      series: symptomChartOptions?.series?.map(s => ({
                        ...s,
                        itemStyle: {
                          ...s.itemStyle,
                          cursor: 'pointer'
                        }
                      }))
                    }}
                    style={{ height: '420px' }}
                    onEvents={{
                      click: (params) => {
                        if (params.componentType === 'series') {
                          const symptom = symptomStats.slice(0, 10).reverse()[params.dataIndex]?.symptom;
                          if (symptom) {
                            handleChartClick('symptoms', symptom);
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#999' }}>暂无数据</span>
                  </div>
                )}
              </Card>
            </Col>
            <Col span={8}>
              <Card 
                bordered={false}
                style={{
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderRadius: '8px'
                }}
              >
              <ReactECharts 
                option={{
                  ...wfChartOptions,
                  series: wfChartOptions?.series?.map(s => ({
                    ...s,
                    itemStyle: {
                      ...s.itemStyle,
                      cursor: 'pointer'
                    }
                  }))
                }}
                style={{ height: '420px' }}
                onEvents={{
                  click: (params) => {
                    if (params.componentType === 'series') {
                      const wf = wfStats.slice(0, 10).reverse()[params.dataIndex]?.wf;
                      if (wf) {
                        handleChartClick('wfs', wf);
                      }
                    }
                  }
                }}
              />
              </Card>
            </Col>
            <Col span={8}>
              <Card 
                bordered={false}
                style={{
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderRadius: '8px'
                }}
              >
                {testChartOptions ? (
                  <ReactECharts 
                    option={{
                      ...testChartOptions,
                      series: testChartOptions?.series?.map(s => ({
                        ...s,
                        itemStyle: {
                          ...s.itemStyle,
                          cursor: 'pointer'
                        }
                      }))
                    }}
                    style={{ height: '420px' }}
                    onEvents={{
                      click: (params) => {
                        if (params.componentType === 'series') {
                          const failedTest = testStats.slice(0, 10).reverse()[params.dataIndex]?.testName;
                          if (failedTest) {
                            handleChartClick('failed_tests', failedTest);
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#999' }}>暂无数据</span>
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* FA Status Distribution and Config Stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            {/* FA Status Distribution Chart */}
            {faStatusStats && faStatusStats.length > 0 && (
              <Col span={12}>
                <Card 
                  title="FA Status 分布" 
                  bordered={false}
                  style={{ 
                    height: '100%',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    borderRadius: '8px'
                  }}
                >
                  <Row gutter={[16, 0]}>
                    <Col span={14}>
                      <ReactECharts 
                        option={{
                          tooltip: {
                            trigger: 'item',
                            formatter: '{b}: {c} ({d}%)'  
                          },
                          legend: {
                            orient: 'horizontal',
                            left: 'left',
                            top: 5,
                            itemGap: 10,
                            itemWidth: 12,
                            itemHeight: 12,
                            textStyle: FONT_STYLES.legend,
                            formatter: (name) => {
                              return name.length > 15 ? name.substring(0, 15) + '...' : name;
                            }
                          },
                          grid: {
                            left: 0,
                            right: 0,
                            top: 60,
                            bottom: 0
                          },
                          series: [
                            {
                              name: 'FA Status',
                              type: 'pie',
                              radius: ['40%', '65%'],
                              center: ['50%', '58%'],
                              avoidLabelOverlap: true,
                              itemStyle: {
                                borderRadius: 4,
                                borderColor: '#fff',
                                borderWidth: 2,
                                cursor: 'pointer'
                              },
                              label: {
                                show: true,
                                position: 'outside',
                                formatter: '{d}%',
                                ...FONT_STYLES.chartLabel
                              },
                              labelLine: {
                                show: true,
                                length: 8,
                                length2: 6
                              },
                              data: faStatusStats.map(stat => ({
                                name: stat.status,
                                value: stat.count,
                              })),
                              emphasis: {
                                itemStyle: {
                                  shadowBlur: 10,
                                  shadowOffsetX: 0,
                                  shadowColor: 'rgba(0, 0, 0, 0.5)'
                                }
                              }
                            }
                          ]
                        }}
                        style={{ height: '380px' }}
                        onEvents={{
                          click: (params) => {
                            if (params.name) {
                              handleChartClick('fa_statuses', params.name);
                            }
                          }
                        }}
                      />
                    </Col>
                    <Col span={10}>
                      <div>
                        <Table
                          size="small"
                          columns={[
                            { 
                              title: 'Status', 
                              dataIndex: 'status', 
                              key: 'status',
                              width: '50%',
                              ellipsis: true,
                              onHeaderCell: () => ({ style: FONT_STYLES.tableHeader }),
                              onCell: () => ({ style: { ...FONT_STYLES.tableBody, cursor: 'pointer' } })
                            },
                            { 
                              title: 'Count', 
                              dataIndex: 'count', 
                              key: 'count',
                              width: '25%',
                              align: 'right',
                              onHeaderCell: () => ({ style: FONT_STYLES.tableHeader }),
                              onCell: () => ({ style: { ...FONT_STYLES.tableBody, cursor: 'pointer' } })
                            },
                            { 
                              title: 'Percentage', 
                              dataIndex: 'percentage', 
                              key: 'percentage',
                              width: '25%',
                              align: 'right',
                              render: (val) => <span style={FONT_STYLES.tableBody}>{val}%</span>,
                              onHeaderCell: () => ({ style: FONT_STYLES.tableHeader })
                            },
                          ]}
                          dataSource={faStatusStats}
                          rowKey="status"
                          pagination={false}
                          showHeader={true}
                          onRow={(record) => ({
                            onClick: () => handleTableRowClick('fa_statuses', record.status),
                            style: { cursor: 'pointer' }
                          })}
                        />
                      </div>
                    </Col>
                  </Row>
                </Card>
              </Col>
            )}

            {/* Config Stats Table */}
            <Col span={faStatusStats && faStatusStats.length > 0 ? 12 : 24}>
              <Card 
                title="Config维度失败率统计" 
                bordered={false}
                style={{ 
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderRadius: '8px'
                }}
              >
                <Table
                  columns={configColumns.map((col) => ({
                    ...col,
                    onCell: () => ({ style: { ...FONT_STYLES.tableBody, cursor: 'pointer' } })
                  }))}
                  dataSource={configStats}
                  rowKey="config"
                  pagination={false}
                  size="small"
                  onRow={(record) => ({
                    onClick: () => handleTableRowClick('configs', record.config),
                    style: { cursor: 'pointer' }
                  })}
                />
              </Card>
            </Col>
          </Row>

          {/* Cross Analysis Heatmap */}
          <div style={{ marginBottom: '24px' }}>
            <CrossAnalysisHeatmap projectId={projectId} filters={filters} />
          </div>

          {/* Project Info */}
          {showProjectInfo && projectInfo && (
            <Card title="项目信息">
              <p><strong>项目名称:</strong> {projectInfo.name}</p>
              <p><strong>文件名:</strong> {projectInfo.file_name}</p>
              <p><strong>上传时间:</strong> {new Date(projectInfo.upload_time).toLocaleString()}</p>
              <p>
                <strong>Config列表:</strong> {projectInfo.config_names?.join(', ')}
              </p>
            </Card>
          )}
        </div>
  );
}

export default AnalysisView;
