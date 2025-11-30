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
        
        console.log('📅 Loading today stats for date:', today);
        console.log('📊 Applied filters:', filters);
        
        // Build query string with current filters + today's date
        const queryParams = new URLSearchParams();
        queryParams.append('date_from', today);
        queryParams.append('date_to', today);
        
        // Add current filters to the query
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (Array.isArray(value) && value.length > 0) {
              value.forEach(v => queryParams.append(key, v));
            } else if (value && !Array.isArray(value)) {
              queryParams.append(key, value);
            }
          });
        }
        
        // Use the correct API path: /api/projects/:id/filter-statistics
        const response = await fetch(
          `/api/projects/${projectId}/filter-statistics?${queryParams.toString()}`
        );
        const result = await response.json();
        
        console.log('📊 Today stats response:', result);
        
        if (result.success && result.data?.statistics) {
          const stats = result.data.statistics;
          console.log('✅ Today stats loaded:', stats);
          setTodayStats({
            totalCount: stats.totalCount,
            specCount: stats.specCount,
            strifeCount: stats.strifeCount
          });
        } else {
          console.warn('⚠️ No statistics data in response');
          setTodayStats({
            totalCount: 0,
            specCount: 0,
            strifeCount: 0
          });
        }
      } catch (error) {
        console.error('❌ Failed to load today stats:', error);
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
  }, [projectId, filters]);

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
    animation: false,
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
          Spec.失败率: <strong style="color:#ff6b6b">${testStat.specSNCount}F/${testStat.totalSamples}T</strong><br/>
          <span style="display:inline-block;width:10px;height:10px;background:rgba(255,193,7,0.6);border-radius:2px;margin-right:5px;"></span>
          Strife失败率: <strong style="color:#ffc107">${testStat.strifeSNCount}SF/${testStat.totalSamples}T</strong><br/>
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
        data: testStats.slice(0, 10).map((t) => `${t.specSNCount}F/${t.totalSamples}T`).reverse(),
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
    animation: false,
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
          Spec.失败率: <strong style="color:#ff6b6b">${stat.specSNCount}F/${stat.totalSamples}T</strong><br/>
          <span style="display:inline-block;width:10px;height:10px;background:rgba(255,193,7,0.6);border-radius:2px;margin-right:5px;"></span>
          Strife失败率: <strong style="color:#ffc107">${stat.strifeSNCount}SF/${stat.totalSamples}T</strong>
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
        data: symptomStats.slice(0, 10).map((s) => `${s.specSNCount}F/${s.totalSamples}T`).reverse(),
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
    animation: false,
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
          Spec.失败率: <strong style="color:#ff6b6b">${stat.specSNCount}F/${stat.totalTests}T</strong><br/>
          <span style="display:inline-block;width:10px;height:10px;background:rgba(255,193,7,0.6);border-radius:2px;margin-right:5px;"></span>
          Strife失败率: <strong style="color:#ffc107">${stat.strifeSNCount}SF/${stat.totalTests}T</strong>
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
        data: wfStats.slice(0, 10).map((w) => `${w.specSNCount}F/${w.totalTests}T`).reverse(),
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
      width: 100,
      onHeaderCell: () => ({ style: { ...FONT_STYLES.tableHeader, fontSize: '14px', fontWeight: '700' } }),
      onCell: () => ({ style: { ...FONT_STYLES.tableBody, fontSize: '14px', fontWeight: '600' } })
    },
    { 
      title: 'Failed Sample Count', 
      dataIndex: 'specSNCount', 
      key: 'specSNCount',
      onHeaderCell: () => ({ style: { ...FONT_STYLES.tableHeader, fontSize: '14px', fontWeight: '700' } }),
      render: (count, record) => (
        <span style={{ ...FONT_STYLES.tableBody, fontSize: '13px' }}>
          <span style={{ 
            backgroundColor: 'rgba(255, 107, 107, 0.15)', 
            padding: '3px 8px', 
            borderRadius: '3px',
            fontWeight: '600',
            color: '#ff6b6b',
            fontSize: '13px'
          }}>
            {record.specSNCount || 0}
          </span>
          {' '}
          <span style={{ ...FONT_STYLES.tableBody, color: '#666', fontSize: '13px', fontWeight: '500' }}>
            (+{record.strifeSNCount || 0}
            <span style={{ 
              backgroundColor: 'rgba(255, 193, 7, 0.15)', 
              padding: '2px 6px', 
              borderRadius: '3px',
              marginLeft: '3px',
              color: '#ffc107',
              fontWeight: '600',
              fontSize: '12px'
            }}>SF</span>)
          </span>
        </span>
      ),
    },
    { 
      title: 'Total Samples', 
      dataIndex: 'totalSamples', 
      key: 'totalSamples',
      onHeaderCell: () => ({ style: { ...FONT_STYLES.tableHeader, fontSize: '14px', fontWeight: '700' } }),
      onCell: () => ({ style: { ...FONT_STYLES.tableBody, fontSize: '14px', fontWeight: '500' } })
    },
    {
      title: 'Spec. Failure Rate',
      dataIndex: 'specFailureRate',
      key: 'specFailureRate',
      sorter: (a, b) => a.specFailureRate - b.specFailureRate,
      onHeaderCell: () => ({ style: { ...FONT_STYLES.tableHeader, fontSize: '14px', fontWeight: '700' } }),
      render: (rate, record) => (
        <div style={{ ...FONT_STYLES.tableBody, fontSize: '13px' }}>
          <span style={{ fontWeight: '600', fontSize: '13px' }}>
            <span style={{ 
              backgroundColor: 'rgba(255, 107, 107, 0.15)', 
              padding: '3px 8px', 
              borderRadius: '3px',
              color: '#ff6b6b',
              fontWeight: '600',
              fontSize: '13px'
            }}>
              {record.specSNCount || 0}F
            </span>
            <span style={{ marginLeft: '4px', fontWeight: '500' }}>/{record.totalSamples}T</span>
          </span>
          <br/>
          <span style={{ ...FONT_STYLES.tableBody, color: '#666', fontSize: '12px', fontWeight: '500', marginTop: '4px', display: 'inline-block' }}>
            Strife: 
            <span style={{ 
              backgroundColor: 'rgba(255, 193, 7, 0.15)', 
              padding: '2px 6px', 
              borderRadius: '3px',
              marginLeft: '4px',
              color: '#ffc107',
              fontWeight: '600',
              fontSize: '12px'
            }}>
              {record.strifeSNCount || 0}SF
            </span>
            <span style={{ marginLeft: '4px' }}>/{record.totalSamples}T</span>
          </span>
        </div>
      ),
    },
  ];

  // Calculate failure rate percentage (使用去重后的SN数量)
  const failureRatePercentage = statistics?.totalSampleSize > 0 
    ? ((statistics.specSNCount / statistics.totalSampleSize) * 100).toFixed(2)
    : '0.00';

  return (
    <div>
      {/* Overview Statistics - Redesigned KPI Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        {/* Card 1: Today's Issues */}
        <Col flex="1 1 20%">
          <Card 
            bordered={false}
            style={{
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: '8px',
              height: '140px',
              cursor: todayLoading ? 'default' : 'pointer',
              transition: 'all 0.3s ease',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}
            bodyStyle={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}
            onClick={!todayLoading ? handleTodayClick : undefined}
            onMouseEnter={(e) => {
              if (!todayLoading) {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {todayLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin size="small" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                {/* 顶部：图标 + 标题 */}
                <div style={{ 
                  fontSize: '14px', 
                  color: '#595959', 
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <CalendarOutlined style={{ marginRight: '6px', fontSize: '16px', color: '#1890ff' }} />
                  今日新增
                </div>
                {/* 中部：核心数据 */}
                <div style={{ 
                  fontSize: '42px', 
                  fontWeight: '700', 
                  color: '#262626',
                  lineHeight: '1',
                  textAlign: 'center'
                }}>
                  {todayStats?.totalCount || 0}
                </div>
                {/* 底部：辅助数据 */}
                <div style={{ 
                  fontSize: '13px',
                  color: '#8c8c8c',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px'
                }}>
                  <span style={{ color: '#ff4d4f', fontWeight: '600' }}>
                    {todayStats?.specCount || 0}F
                  </span>
                  <span style={{ color: '#faad14', fontWeight: '600' }}>
                    {todayStats?.strifeCount || 0}SF
                  </span>
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* Card 2: Total Issues */}
        <Col flex="1 1 20%">
          <Card 
            bordered={false}
            style={{
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: '8px',
              height: '140px',
              display: 'flex',
              flexDirection: 'column'
            }}
            bodyStyle={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              {/* 顶部：图标 + 标题 */}
              <div style={{ 
                fontSize: '14px', 
                color: '#595959', 
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center'
              }}>
                <BugOutlined style={{ marginRight: '6px', fontSize: '16px', color: '#1890ff' }} />
                总Issues数
              </div>
              {/* 中部：核心数据 */}
              <div style={{ 
                fontSize: '42px', 
                fontWeight: '700', 
                color: '#262626',
                lineHeight: '1',
                textAlign: 'center'
              }}>
                {statistics.totalCount}
              </div>
              {/* 底部：辅助数据 */}
              <div style={{ 
                fontSize: '13px',
                color: '#8c8c8c',
                display: 'flex',
                justifyContent: 'center',
                gap: '12px'
              }}>
                <span style={{ color: '#ff4d4f', fontWeight: '600' }}>
                  {statistics.specCount}F
                </span>
                <span style={{ color: '#faad14', fontWeight: '600' }}>
                  {statistics.strifeCount}SF
                </span>
              </div>
            </div>
          </Card>
        </Col>

        {/* Card 3: Symptoms Count */}
        <Col flex="1 1 20%">
          <Card 
            bordered={false}
            style={{
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: '8px',
              height: '140px',
              display: 'flex',
              flexDirection: 'column'
            }}
            bodyStyle={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              {/* 顶部：图标 + 标题 */}
              <div style={{ 
                fontSize: '14px', 
                color: '#595959', 
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center'
              }}>
                <WarningOutlined style={{ marginRight: '6px', fontSize: '16px', color: '#faad14' }} />
                症状种类
              </div>
              {/* 中部：核心数据 */}
              <div style={{ 
                fontSize: '42px', 
                fontWeight: '700', 
                color: '#262626',
                lineHeight: '1',
                textAlign: 'center'
              }}>
                {statistics.uniqueSymptoms || (symptomStats ? symptomStats.length : 0)}
              </div>
              {/* 底部：辅助数据 */}
              <div style={{ 
                fontSize: '13px',
                color: '#8c8c8c',
                textAlign: 'center'
              }}>
                种不同症状
              </div>
            </div>
          </Card>
        </Col>

        {/* Card 4: WF Count */}
        <Col flex="1 1 20%">
          <Card 
            bordered={false}
            style={{
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: '8px',
              height: '140px',
              display: 'flex',
              flexDirection: 'column'
            }}
            bodyStyle={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              {/* 顶部：图标 + 标题 */}
              <div style={{ 
                fontSize: '14px', 
                color: '#595959', 
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center'
              }}>
                <ExperimentOutlined style={{ marginRight: '6px', fontSize: '16px', color: '#52c41a' }} />
                WF数量
              </div>
              {/* 中部：核心数据 */}
              <div style={{ 
                fontSize: '42px', 
                fontWeight: '700', 
                color: '#262626',
                lineHeight: '1',
                textAlign: 'center'
              }}>
                {statistics.uniqueWFs}
              </div>
              {/* 底部：辅助数据 */}
              <div style={{ 
                fontSize: '13px',
                color: '#8c8c8c',
                textAlign: 'center'
              }}>
                个不同WF
              </div>
            </div>
          </Card>
        </Col>

        {/* Card 5: Failure Rate */}
        <Col flex="1 1 20%">
          <Card 
            bordered={false}
            style={{
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderRadius: '8px',
              height: '140px',
              display: 'flex',
              flexDirection: 'column'
            }}
            bodyStyle={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              {/* 顶部：图标 + 标题 */}
              <div style={{ 
                fontSize: '14px', 
                color: '#595959', 
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center'
              }}>
                <SettingOutlined style={{ marginRight: '6px', fontSize: '16px', color: '#ff4d4f' }} />
                Spec失败率
              </div>
              {/* 中部：核心数据（百分比） */}
              <div style={{ 
                fontSize: '42px', 
                fontWeight: '700', 
                color: '#262626',
                lineHeight: '1',
                textAlign: 'center'
              }}>
                {failureRatePercentage}<span style={{ fontSize: '24px', fontWeight: '600' }}>%</span>
              </div>
              {/* 底部：辅助数据 */}
              <div style={{ 
                fontSize: '13px',
                color: '#8c8c8c',
                textAlign: 'center'
              }}>
                <span style={{ color: '#ff4d4f', fontWeight: '600' }}>
                  {statistics.specSNCount}F
                </span>
                <span style={{ margin: '0 4px' }}>/</span>
                <span>{statistics.totalSampleSize}T</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

          {/* Charts */}
          <Row gutter={16} style={{ marginBottom: '24px' }}>
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
                      animation: false,
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
                  animation: false,
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
                      animation: false,
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
                          animation: false,
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
