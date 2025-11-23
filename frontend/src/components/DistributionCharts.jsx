import React, { useEffect, useRef } from 'react';
import { Card, Row, Col, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import * as echarts from 'echarts';
import useStore from '../store';

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
  },
  legend: {
    fontSize: 11,
    color: '#595959',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  }
};

const DistributionCharts = ({ failureTypeStats, functionCosmeticStats, faStatusStats, loading }) => {
  const navigate = useNavigate();
  const { filters, updateFilterContext, projects } = useStore();
  const failureTypeChartRef = useRef(null);
  const functionCosmeticChartRef = useRef(null);
  const faStatusChartRef = useRef(null);

  useEffect(() => {
    if (failureTypeStats && failureTypeStats.length > 0) {
      renderFailureTypeChart();
    }
    return () => {
      if (failureTypeChartRef.current) {
        echarts.getInstanceByDom(failureTypeChartRef.current)?.dispose();
      }
    };
  }, [failureTypeStats]);

  useEffect(() => {
    if (functionCosmeticStats && functionCosmeticStats.length > 0) {
      renderFunctionCosmeticChart();
    }
    return () => {
      if (functionCosmeticChartRef.current) {
        echarts.getInstanceByDom(functionCosmeticChartRef.current)?.dispose();
      }
    };
  }, [functionCosmeticStats]);

  useEffect(() => {
    if (faStatusStats && faStatusStats.length > 0) {
      renderFAStatusChart();
    }
    return () => {
      if (faStatusChartRef.current) {
        echarts.getInstanceByDom(faStatusChartRef.current)?.dispose();
      }
    };
  }, [faStatusStats]);

  const renderFailureTypeChart = () => {
    if (!failureTypeChartRef.current) return;

    const chart = echarts.init(failureTypeChartRef.current);
    
    const colorMap = {
      'Spec.': '#1890ff',
      'Strife': '#faad14',
      '未知': '#d9d9d9',
    };

    const option = {
      title: {
        text: '失败类型分布',
        left: 'center',
        top: 10,
        ...FONT_STYLES.chartTitle
      },
      tooltip: {
        trigger: 'item',
        textStyle: FONT_STYLES.chartLabel,
        formatter: (params) => {
          return `${params.name}<br/>数量: ${params.value}<br/>占比: ${params.percent}%`;
        },
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: FONT_STYLES.legend
      },
      series: [
        {
          name: '失败类型',
          type: 'pie',
          radius: '60%',
          center: ['40%', '50%'],
          data: failureTypeStats.map((item) => ({
            name: item.type,
            value: item.count,
            itemStyle: {
              color: colorMap[item.type] || '#d9d9d9',
            },
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          label: {
            ...FONT_STYLES.chartLabel,
            formatter: '{b}: {d}%',
          },
        },
      ],
    };

    chart.setOption(option);

    // Handle click event
    chart.on('click', (params) => {
      console.log('Clicked failure type:', params.name);
      
      // Build filters for drill-down
      const drillFilters = {
        ...filters,
        failure_types: [params.name],
      };
      
      // Update filter context
      updateFilterContext(drillFilters);
      
      // Navigate to FilterResultsPage
      const encodedFilters = btoa(JSON.stringify(drillFilters));
      navigate(`/filter-results?filters=${encodedFilters}&project=${projects.current?.id}`);
    });
  };

  const renderFunctionCosmeticChart = () => {
    if (!functionCosmeticChartRef.current) return;

    const chart = echarts.init(functionCosmeticChartRef.current);
    
    const colorMap = {
      'Function': '#52c41a',
      'Cosmetic': '#722ed1',
      '未知': '#d9d9d9',
    };

    const option = {
      title: {
        text: '功能性/外观性分布',
        left: 'center',
        top: 10,
        ...FONT_STYLES.chartTitle
      },
      tooltip: {
        trigger: 'item',
        textStyle: FONT_STYLES.chartLabel,
        formatter: (params) => {
          return `${params.name}<br/>数量: ${params.value}<br/>占比: ${params.percent}%`;
        },
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: FONT_STYLES.legend
      },
      series: [
        {
          name: '功能性/外观性',
          type: 'pie',
          radius: '60%',
          center: ['40%', '50%'],
          data: functionCosmeticStats.map((item) => ({
            name: item.category,
            value: item.count,
            itemStyle: {
              color: colorMap[item.category] || '#d9d9d9',
            },
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          label: {
            ...FONT_STYLES.chartLabel,
            formatter: '{b}: {d}%',
          },
        },
      ],
    };

    chart.setOption(option);

    // Handle click event
    chart.on('click', (params) => {
      console.log('Clicked function/cosmetic:', params.name);
      
      // Build filters for drill-down
      const drillFilters = {
        ...filters,
        function_cosmetic: [params.name],
      };
      
      // Update filter context
      updateFilterContext(drillFilters);
      
      // Navigate to FilterResultsPage
      const encodedFilters = btoa(JSON.stringify(drillFilters));
      navigate(`/filter-results?filters=${encodedFilters}&project=${projects.current?.id}`);
    });
  };

  const renderFAStatusChart = () => {
    if (!faStatusChartRef.current) return;

    const chart = echarts.init(faStatusChartRef.current);

    const option = {
      title: {
        text: 'FA Status分布',
        left: 'center',
        top: 10,
        ...FONT_STYLES.chartTitle
      },
      tooltip: {
        trigger: 'item',
        textStyle: FONT_STYLES.chartLabel,
        formatter: (params) => {
          return `${params.name}<br/>数量: ${params.value}<br/>占比: ${params.percent}%`;
        },
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: FONT_STYLES.legend
      },
      series: [
        {
          name: 'FA Status',
          type: 'pie',
          radius: '60%',
          center: ['40%', '50%'],
          data: faStatusStats.map((item) => ({
            name: item.status,
            value: item.count,
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          label: {
            ...FONT_STYLES.chartLabel,
            formatter: '{b}: {d}%',
          },
        },
      ],
    };

    chart.setOption(option);

    // Handle click event
    chart.on('click', (params) => {
      console.log('Clicked FA status:', params.name);
      
      // Build filters for drill-down
      const drillFilters = {
        ...filters,
        fa_statuses: [params.name],
      };
      
      // Update filter context
      updateFilterContext(drillFilters);
      
      // Navigate to FilterResultsPage
      const encodedFilters = btoa(JSON.stringify(drillFilters));
      navigate(`/filter-results?filters=${encodedFilters}&project=${projects.current?.id}`);
    });
  };

  if (loading) {
    return (
      <Card>
        <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
      </Card>
    );
  }

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card>
          <div ref={failureTypeChartRef} style={{ width: '100%', height: '350px' }} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <div ref={functionCosmeticChartRef} style={{ width: '100%', height: '350px' }} />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <div ref={faStatusChartRef} style={{ width: '100%', height: '350px' }} />
        </Card>
      </Col>
    </Row>
  );
};

export default DistributionCharts;
