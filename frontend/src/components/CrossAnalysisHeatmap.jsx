import React, { useEffect, useRef, useState } from 'react';
import { Card, Select, Radio, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import * as echarts from 'echarts';
import useStore from '../store';

const { Option } = Select;

// 统一的字体样式配置（与Dashboard保持一致）
const FONT_STYLES = {
  chartTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  chartLabel: {
    fontSize: 11,
    fontWeight: 'normal',
    color: '#595959',
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
  }, [projectId, crossAnalysis.dimension1, crossAnalysis.dimension2, currentFilters]);

  useEffect(() => {
    if (crossAnalysis.data) {
      renderHeatmap();
    }
    return () => {
      if (chartRef.current) {
        echarts.getInstanceByDom(chartRef.current)?.dispose();
      }
    };
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

    const option = {
      title: {
        text: `交叉分析：${crossAnalysis.dimension1} × ${crossAnalysis.dimension2}`,
        left: 'center',
        ...FONT_STYLES.chartTitle
      },
      tooltip: {
        position: 'top',
        textStyle: FONT_STYLES.chartLabel,
        formatter: (params) => {
          const data = params.data[4];
          return `
            ${crossAnalysis.dimension1}: ${data.dimension1Value}<br/>
            ${crossAnalysis.dimension2}: ${data.dimension2Value}<br/>
            总失败: ${data.totalFailureRate} (共${data.totalCount}次)<br/>
            Spec.失败: ${data.specFailureRate} (占总失败${Math.round((data.specCount/data.totalCount)*100)}%)<br/>
            Strife失败: ${data.strifeFailureRate} (占总失败${Math.round((data.strifeCount/data.totalCount)*100)}%)<br/>
            占比: ${data.percentage}%
          `;
        },
      },
      grid: {
        left: '8%',
        right: '8%',
        top: '12%',
        bottom: '12%',
      },
      xAxis: {
        type: 'category',
        data: dimension2Values,
        splitArea: {
          show: true,
        },
        axisLabel: {
          rotate: 45,
          interval: 0,
          ...FONT_STYLES.chartLabel
        },
      },
      yAxis: {
        type: 'category',
        data: dimension1Values,
        splitArea: {
          show: true,
        },
        axisLabel: FONT_STYLES.chartLabel,
      },
      visualMap: {
        min: 0,
        max: Math.max(...matrix.map(item => item.totalCount)),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        itemHeight: 100,
        textStyle: FONT_STYLES.chartLabel,
        inRange: {
          color: ['#e0f7fa', '#00bcd4', '#0097a7', '#d32f2f'],
        },
      },
      series: [
        {
          name: '失败次数',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            fontSize: 10,
            formatter: (params) => params.data[3],
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };

    chart.setOption(option);

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

  const dimensionOptions = [
    { label: 'Symptom', value: 'symptom' },
    { label: 'Config', value: 'config' },
    { label: 'WF', value: 'wf' },
    { label: 'Failed Test', value: 'failed_test' },
    { label: 'Test ID', value: 'test_id' },
  ];

  return (
    <Card
      title="交叉分析热力图"
      extra={
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div>
            <span style={{ marginRight: '4px', fontSize: '12px' }}>维度1:</span>
            <Select
              size="small"
              value={crossAnalysis.dimension1}
              style={{ width: 100 }}
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
          </div>
          <div>
            <span style={{ marginRight: '4px', fontSize: '12px' }}>维度2:</span>
            <Select
              size="small"
              value={crossAnalysis.dimension2}
              style={{ width: 100 }}
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
          </div>
          <Radio.Group size="small" value={displayMode} onChange={(e) => setDisplayMode(e.target.value)}>
            <Radio.Button value="spec">Spec.失败率</Radio.Button>
            <Radio.Button value="strife">Strife失败率</Radio.Button>
            <Radio.Button value="total">总失败率</Radio.Button>
          </Radio.Group>
        </div>
      }
    >
      {crossAnalysis.loading ? (
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      ) : (
        <div ref={chartRef} style={{ width: '100%', height: '400px' }} />
      )}
    </Card>
  );
};

export default CrossAnalysisHeatmap;
