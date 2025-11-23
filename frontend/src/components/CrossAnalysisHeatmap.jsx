import React, { useEffect, useRef, useState } from 'react';
import { Card, Select, Radio, Spin, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import * as echarts from 'echarts';
import useStore from '../store';

const { Option } = Select;
const { Text } = Typography;

// 统一的字体样式配置（与Dashboard保持一致）
const FONT_STYLES = {
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#595959',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  axisLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  }
};

const CrossAnalysisHeatmap = ({ projectId, filters: propFilters }) => {
  const navigate = useNavigate();
  const { crossAnalysis, loadCrossAnalysis, setCrossAnalysisDimensions, filters: storeFilters, updateFilterContext } = useStore();
  const chartRef = useRef(null);
  const [displayMode, setDisplayMode] = useState('spec'); // spec | strife | total

  // 使用传入的 filters 或 store 中的 filters
  const currentFilters = propFilters || storeFilters;

  useEffect(() => {
    if (projectId) {
      loadCrossAnalysis(
        projectId,
        crossAnalysis.dimension1,
        crossAnalysis.dimension2,
        currentFilters
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, crossAnalysis.dimension1, crossAnalysis.dimension2, currentFilters]);

  useEffect(() => {
    if (crossAnalysis.data) {
      try {
        renderHeatmap();
      } catch (error) {
        console.error('Error rendering heatmap:', error);
      }
    }
    return () => {
      if (chartRef.current) {
        echarts.getInstanceByDom(chartRef.current)?.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossAnalysis.data, displayMode]);

  const handleDimensionChange = (value, type) => {
    if (type === 'dimension1') {
      setCrossAnalysisDimensions(value, crossAnalysis.dimension2);
    } else {
      setCrossAnalysisDimensions(crossAnalysis.dimension1, value);
    }
  };

  const renderHeatmap = () => {
    if (!chartRef.current || !crossAnalysis.data) return;

    const chart = echarts.init(chartRef.current);
    const { matrix, dimension1Values, dimension2Values } = crossAnalysis.data;

    // Prepare data for heatmap
    const heatmapData = [];
    matrix.forEach((item) => {
      const x = dimension2Values.indexOf(item.dimension2Value);
      const y = dimension1Values.indexOf(item.dimension1Value);
      
      let displayValue;
      if (displayMode === 'spec') {
        displayValue = item.specFailureRate;
      } else if (displayMode === 'strife') {
        displayValue = item.strifeFailureRate;
      } else {
        displayValue = item.totalFailureRate;
      }
      
      heatmapData.push([x, y, item.totalCount, displayValue, item]);
    });

    // 计算最大值，用于颜色映射
    const maxValue = Math.max(...matrix.map(item => item.totalCount), 1);

    // 根据显示模式选择颜色方案
    const colorSchemes = {
      spec: ['#f0f9ff', '#bae7ff', '#69c0ff', '#40a9ff', '#1890ff', '#096dd9'],
      strife: ['#fff7e6', '#ffe7ba', '#ffd666', '#ffc53d', '#faad14', '#d48806'],
      total: ['#f0f9ff', '#bae7ff', '#91d5ff', '#69c0ff', '#40a9ff', '#1890ff']
    };

    // 动态计算图表高度
    const chartHeight = Math.max(400, dimension1Values.length * 35 + 150);

    const option = {
      title: {
        text: `交叉分析: ${getDimensionLabel(crossAnalysis.dimension1)} × ${getDimensionLabel(crossAnalysis.dimension2)}`,
        left: 'center',
        top: 15,
        ...FONT_STYLES.chartTitle
      },
      tooltip: {
        position: 'top',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e8e8e8',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          ...FONT_STYLES.chartLabel,
          fontSize: 13,
          lineHeight: 20
        },
        formatter: (params) => {
          const data = params.data[4];
          const specPercent = data.totalCount > 0 ? Math.round((data.specCount/data.totalCount)*100) : 0;
          const strifePercent = data.totalCount > 0 ? Math.round((data.strifeCount/data.totalCount)*100) : 0;
          return `
            <div style="line-height: 1.8;">
              <div style="font-weight: 600; margin-bottom: 10px; color: #262626; font-size: 14px;">
                <div>${getDimensionLabel(crossAnalysis.dimension1)}: <span style="color: #1890ff;">${data.dimension1Value}</span></div>
                <div>${getDimensionLabel(crossAnalysis.dimension2)}: <span style="color: #1890ff;">${data.dimension2Value}</span></div>
              </div>
              <div style="border-top: 1px solid #f0f0f0; padding-top: 10px; margin-top: 8px;">
                <div style="margin-bottom: 6px;"><strong style="color: #262626;">总失败:</strong> <span style="color: #f5222d; font-size: 15px; font-weight: 600;">${data.totalFailureRate}</span> <span style="color: #8c8c8c;">(共${data.totalCount}次)</span></div>
                <div style="margin-bottom: 4px;"><strong style="color: #262626;">Spec.失败:</strong> <span style="color: #1890ff; font-weight: 500;">${data.specFailureRate}</span> <span style="color: #8c8c8c;">(${specPercent}%)</span></div>
                <div style="margin-bottom: 4px;"><strong style="color: #262626;">Strife失败:</strong> <span style="color: #faad14; font-weight: 500;">${data.strifeFailureRate}</span> <span style="color: #8c8c8c;">(${strifePercent}%)</span></div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0;"><strong style="color: #262626;">占总体比:</strong> <span style="color: #52c41a; font-weight: 600; font-size: 14px;">${data.percentage}%</span></div>
              </div>
            </div>
          `;
        },
      },
      grid: {
        left: 200,
        right: 50,
        top: 70,
        bottom: 80,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: dimension2Values,
        position: 'bottom',
        splitArea: {
          show: true,
          areaStyle: {
            color: ['#fafafa', '#ffffff']
          }
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: '#e8e8e8',
            width: 1
          }
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          rotate: 0,
          interval: 0,
          fontSize: 12,
          color: '#595959',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
          margin: 15,
          overflow: 'truncate',
          width: 80,
          formatter: (value) => {
            return value.length > 8 ? value.substring(0, 7) + '...' : value;
          }
        },
      },
      yAxis: {
        type: 'category',
        data: dimension1Values,
        position: 'left',
        splitArea: {
          show: true,
          areaStyle: {
            color: ['#fafafa', '#ffffff']
          }
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: '#e8e8e8',
            width: 1
          }
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          fontSize: 12,
          color: '#595959',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
          margin: 15,
          overflow: 'truncate',
          width: 170,
          formatter: (value) => {
            return value.length > 25 ? value.substring(0, 24) + '...' : value;
          }
        },
      },
      visualMap: {
        show: false,
        min: 0,
        max: maxValue,
        inRange: {
          color: colorSchemes[displayMode]
        }
      },
      series: [
        {
          name: '失败次数',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            fontSize: 13,
            fontWeight: '600',
            color: '#262626',
            formatter: (params) => {
              const value = params.data[3];
              return value || '';
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(24, 144, 255, 0.5)',
              borderColor: '#1890ff',
              borderWidth: 3
            },
            label: {
              fontSize: 14,
              fontWeight: '700'
            }
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 3,
            borderRadius: 4
          }
        },
      ],
    };

    chart.setOption(option, true);

    // Handle click event for drill-down
    chart.on('click', (params) => {
      const data = params.data[4];
      console.log('Clicked cell:', data);
      
      // 维度名称映射到筛选器字段名
      const dimensionToFilterKey = {
        'symptom': 'symptoms',
        'config': 'configs',
        'wf': 'wfs',
        'failed_test': 'failed_tests',
        'test_id': 'test_ids',
      };
      
      // Build filters for drill-down
      const drillFilters = {
        ...currentFilters,
        [dimensionToFilterKey[crossAnalysis.dimension1]]: [data.dimension1Value],
        [dimensionToFilterKey[crossAnalysis.dimension2]]: [data.dimension2Value],
      };
      
      // Update filter context
      updateFilterContext(drillFilters);
      
      // Navigate to FilterResultsPage with filters
      const encodedFilters = btoa(JSON.stringify(drillFilters));
      navigate(`/filter-results?filters=${encodedFilters}&project=${projectId}`);
    });
  };

  // 维度选项配置
  const dimensionOptions = [
    { label: 'Symptom', value: 'symptom' },
    { label: 'Config', value: 'config' },
    { label: 'WF', value: 'wf' },
    { label: 'Failed Test', value: 'failed_test' },
    { label: 'Test ID', value: 'test_id' },
  ];

  // 获取维度标签
  const getDimensionLabel = (value) => {
    const option = dimensionOptions.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  return (
    <Card
      title={
        <Space size="middle">
          <span style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#262626'
          }}>
            交叉分析热力图
          </span>
        </Space>
      }
      bordered={false}
      style={{
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
      }}
      extra={
        <Space size="middle" wrap>
          <Space size="small">
            <Text type="secondary" style={{ fontSize: '13px' }}>维度1:</Text>
            <Select
              size="middle"
              value={crossAnalysis.dimension1}
              style={{ width: 110 }}
              onChange={(value) => handleDimensionChange(value, 'dimension1')}
            >
              {dimensionOptions
                .filter((opt) => opt.value !== crossAnalysis.dimension2)
                .map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
            </Select>
          </Space>
          <Space size="small">
            <Text type="secondary" style={{ fontSize: '13px' }}>维度2:</Text>
            <Select
              size="middle"
              value={crossAnalysis.dimension2}
              style={{ width: 110 }}
              onChange={(value) => handleDimensionChange(value, 'dimension2')}
            >
              {dimensionOptions
                .filter((opt) => opt.value !== crossAnalysis.dimension1)
                .map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
            </Select>
          </Space>
          <Radio.Group 
            size="middle" 
            value={displayMode} 
            onChange={(e) => setDisplayMode(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value="spec">Spec.失败率</Radio.Button>
            <Radio.Button value="strife">Strife失败率</Radio.Button>
            <Radio.Button value="total">总失败率</Radio.Button>
          </Radio.Group>
        </Space>
      }
    >
      {crossAnalysis.loading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '500px' 
        }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : (
        <div 
          ref={chartRef} 
          style={{ 
            width: '100%', 
            height: `${Math.max(500, (crossAnalysis.data?.dimension1Values?.length || 10) * 35 + 150)}px`,
            minHeight: '500px',
            padding: '10px 0'
          }} 
        />
      )}
    </Card>
  );
};

export default CrossAnalysisHeatmap;
