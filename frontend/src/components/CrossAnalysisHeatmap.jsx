import React, { useEffect, useState } from 'react';
import { Card, Select, Radio, Spin, Space, Typography, Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import { projectService } from '../services/projectService';

const { Option } = Select;
const { Text } = Typography;

// 统一的字体样式配置
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
  }
};

const CrossAnalysisHeatmap = ({ projectId, filters: propFilters }) => {
  const navigate = useNavigate();
  const { crossAnalysis, loadCrossAnalysis, setCrossAnalysisDimensions, filters: storeFilters, updateFilterContext } = useStore();
  const [displayMode, setDisplayMode] = useState('spec');
  const [exporting, setExporting] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // 使用本地状态来管理维度，确保刷新后显示默认值
  const [dimension1, setDimension1] = useState(crossAnalysis.dimension1 || 'symptom');
  const [dimension2, setDimension2] = useState(crossAnalysis.dimension2 || 'config');

  const currentFilters = propFilters || storeFilters;

  // 当 store 中的维度值改变时，更新本地状态
  useEffect(() => {
    if (crossAnalysis.dimension1) {
      setDimension1(crossAnalysis.dimension1);
    }
    if (crossAnalysis.dimension2) {
      setDimension2(crossAnalysis.dimension2);
    }
  }, [crossAnalysis.dimension1, crossAnalysis.dimension2]);

  useEffect(() => {
    if (projectId) {
      loadCrossAnalysis(
        projectId,
        dimension1,
        dimension2,
        currentFilters
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, dimension1, dimension2, currentFilters]);

  const handleDimensionChange = (value, type) => {
    if (type === 'dimension1') {
      setDimension1(value);
      setCrossAnalysisDimensions(value, dimension2);
    } else {
      setDimension2(value);
      setCrossAnalysisDimensions(dimension1, value);
    }
  };

  const handleExportCrossAnalysis = async () => {
    try {
      setExporting(true);
      message.loading({ content: '正在生成交叉分析报告...', key: 'export' });
      
      const exportFilters = {};
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          exportFilters[key] = value.join(',');
        } else if (value && !Array.isArray(value) && value !== '') {
          exportFilters[key] = value;
        }
      });
      
      const blob = await projectService.exportCrossAnalysis(
        projectId,
        dimension1,
        dimension2,
        exportFilters
      );
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CrossAnalysis_${dimension1}_${dimension2}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success({ content: '交叉分析报告导出成功！', key: 'export' });
    } catch (error) {
      console.error('Export cross analysis failed:', error);
      message.error({ content: '导出失败，请重试', key: 'export' });
    } finally {
      setExporting(false);
    }
  };

  // 获取热力背景色 - 根据实际显示的数据类型（F或SF）使用对应色系
  const getHeatColor = (data, maxValue) => {
    if (!data || data.totalCount === 0) return '#ffffff';
    const ratio = data.totalCount / maxValue;
    
    // 判断实际显示的是F还是SF
    const displayingSpecFailure = displayMode === 'spec' && data.specCount > 0;
    const displayingStrifeFailure = displayMode === 'spec' && data.specCount === 0 && data.strifeCount > 0;
    
    if (displayingSpecFailure || displayMode === 'spec' && data.specCount > 0) {
      // 显示 Spec 失败 - 使用浅红色系
      if (ratio < 0.33) {
        return '#fce8e6'; // 浅红
      } else if (ratio < 0.66) {
        return '#f4b5af'; // 中红
      } else {
        return '#e8959b'; // 深红
      }
    } else if (displayingStrifeFailure || (displayMode === 'spec' && data.specCount === 0)) {
      // 显示 Strife 失败 - 使用浅黄色系
      if (ratio < 0.33) {
        return '#fffae6'; // 浅黄
      } else if (ratio < 0.66) {
        return '#fff2b3'; // 中黄
      } else {
        return '#ffe680'; // 深黄
      }
    } else if (displayMode === 'strife') {
      // Strife 模式 - 使用浅黄色系
      if (ratio < 0.33) {
        return '#fffae6'; // 浅黄
      } else if (ratio < 0.66) {
        return '#fff2b3'; // 中黄
      } else {
        return '#ffe680'; // 深黄
      }
    } else {
      // 总失败用浅蓝色系
      if (ratio < 0.33) {
        return '#e6f4fa'; // 浅蓝
      } else if (ratio < 0.66) {
        return '#b3e0f2'; // 中蓝
      } else {
        return '#80cce8'; // 深蓝
      }
    }
  };

  const dimensionOptions = [
    { label: 'Symptom', value: 'symptom' },
    { label: 'Config', value: 'config' },
    { label: 'WF', value: 'wf' },
    { label: 'Failed Test', value: 'failed_test' },
    { label: 'Failed Location', value: 'failed_location' },
  ];

  const getDimensionLabel = (value) => {
    const option = dimensionOptions.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  const renderTableHeatmap = () => {
    if (!crossAnalysis.data) return null;

    const { matrix, dimension1Values, dimension2Values } = crossAnalysis.data;
    const maxValue = Math.max(...matrix.map(item => item.totalCount), 1);
    
    const matrixMap = {};
    matrix.forEach(item => {
      const key = `${item.dimension1Value}|${item.dimension2Value}`;
      matrixMap[key] = item;
    });

    return (
      <div style={{ overflowX: 'auto', marginTop: '0px', padding: '0' }}>
        <table style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: '13px',
          fontFamily: FONT_STYLES.chartLabel.fontFamily,
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
          tableLayout: 'auto'
        }}>
          <thead>
            <tr>
              <th style={{
                padding: '16px',
                backgroundColor: '#f0f0f0',
                borderBottom: '1px solid #e8e8e8',
                borderRight: '1px solid #e8e8e8',
                fontWeight: '800',
                color: '#262626',
                fontSize: '13px',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>
                {getDimensionLabel(dimension1)}
              </th>
              {dimension2Values.map((val) => (
                <th key={val} style={{
                  padding: '16px 12px',
                  backgroundColor: '#f0f0f0',
                  borderBottom: '1px solid #e8e8e8',
                  borderRight: '1px solid #e8e8e8',
                  fontWeight: '800',
                  color: '#262626',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  transition: 'background-color 0.2s ease',
                  textAlign: 'center'
                }}>
                  {val}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dimension1Values.map((dim1Val) => (
              <tr key={dim1Val}>
                <td style={{
                  padding: '16px',
                  backgroundColor: '#f8f8f8',
                  borderRight: '1px solid #e8e8e8',
                  borderBottom: '1px solid #e8e8e8',
                  fontWeight: '700',
                  color: '#262626',
                  minWidth: '140px',
                  maxWidth: '220px',
                  wordBreak: 'break-word',
                  textAlign: 'center',
                  fontSize: '13px',
                  transition: 'background-color 0.2s ease',
                  verticalAlign: 'middle'
                }}>
                  {dim1Val.length > 25 ? dim1Val.substring(0, 24) + '...' : dim1Val}
                </td>
                {dimension2Values.map((dim2Val) => {
                  const key = `${dim1Val}|${dim2Val}`;
                  const data = matrixMap[key];
                  const value = data ? data.totalCount : 0;
                  
                  // 根据实际显示的内容来确定背景色
                  let bgColor = '#ffffff';
                  if (data && value > 0) {
                    if (displayMode === 'spec') {
                      // Spec 模式：如果有 F 则用红色，否则用黄色
                      if (data.specCount > 0) {
                        bgColor = getHeatColor(data, maxValue); // 红色系
                      } else if (data.strifeCount > 0) {
                        // 没有 F 但有 SF，用黄色系
                        const ratio = value / maxValue;
                        if (ratio < 0.33) {
                          bgColor = '#fffae6';
                        } else if (ratio < 0.66) {
                          bgColor = '#fff2b3';
                        } else {
                          bgColor = '#ffe680';
                        }
                      }
                    } else {
                      bgColor = getHeatColor(data, maxValue);
                    }
                  }
                  
                  const displayValue = data ? (
                    displayMode === 'spec' ? (data.specCount === 0 ? data.strifeFailureRate : data.specFailureRate) :
                    displayMode === 'strife' ? data.strifeFailureRate :
                    (data.specCount + data.strifeCount) + 'F/' + data.totalSamples + 'T'
                  ) : '-';
                  
                  const isRowHovered = hoveredCell?.row === dim1Val;
                  const isColHovered = hoveredCell?.col === dim2Val;
                  const isCellHovered = isRowHovered && isColHovered;

                  return (
                    <td
                      key={`${dim1Val}|${dim2Val}`}
                      onClick={() => {
                        if (data) {
                          const dimensionToFilterKey = {
                            'symptom': 'symptoms',
                            'config': 'configs',
                            'wf': 'wfs',
                            'failed_test': 'failed_tests',
                            'test_id': 'test_ids',
                            'failed_location': 'failed_locations',
                          };
                          
                          const drillFilters = {
                            ...currentFilters,
                            [dimensionToFilterKey[dimension1]]: [dim1Val],
                            [dimensionToFilterKey[dimension2]]: [dim2Val],
                          };
                          
                          updateFilterContext(drillFilters);
                          const encodedFilters = btoa(JSON.stringify(drillFilters));
                          navigate(`/filter-results?filters=${encodedFilters}&project=${projectId}`);
                        }
                      }}
                      onMouseEnter={(e) => {
                        setHoveredCell({ row: dim1Val, col: dim2Val });
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPos({ x: rect.left, y: rect.top });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        padding: '12px 8px',
                        textAlign: 'center',
                        borderBottom: '1px solid #e8e8e8',
                        borderRight: '1px solid #e8e8e8',
                        backgroundColor: bgColor,
                        color: '#262626',
                        cursor: data ? 'pointer' : 'default',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        minWidth: '120px',
                        fontSize: '13px',
                        border: isCellHovered ? '1px solid #1890ff' : '1px solid #e8e8e8',
                        boxShadow: isCellHovered ? 'inset 0 0 0 1px #1890ff, 0 0 6px rgba(24, 144, 255, 0.3)' : 'none',
                        position: 'relative',
                        borderRadius: '4px',
                        verticalAlign: 'middle'
                      }}
                    >
                      {displayValue}
                      {isCellHovered && data && (
                        <div style={{
                          position: 'fixed',
                          left: tooltipPos.x + 10,
                          top: tooltipPos.y - 160,
                          backgroundColor: '#ffffff',
                          color: '#262626',
                          padding: '16px 20px',
                          borderRadius: '8px',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                          zIndex: 1000,
                          fontSize: '12px',
                          minWidth: '280px',
                          fontFamily: FONT_STYLES.chartLabel.fontFamily,
                          pointerEvents: 'none',
                          border: '1px solid #f0f0f0'
                        }}>
                          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '2px solid #ff6b6b' }}>
                            <span style={{ color: '#595959', fontWeight: '500', fontSize: '13px' }}>总失败次数:</span>
                            <span style={{ fontWeight: '700', fontSize: '16px', color: '#1890ff' }}>{data.specCount + data.strifeCount}</span>
                          </div>
                          <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#595959', fontWeight: '500', fontSize: '13px' }}>Spec.失败 (F/T):</span>
                            <span style={{ fontWeight: '700', fontSize: '15px', color: '#e84c3d' }}>{data.specFailureRate}</span>
                          </div>
                          <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#595959', fontWeight: '500', fontSize: '13px' }}>Strife失败 (SF/T):</span>
                            <span style={{ fontWeight: '700', fontSize: '15px', color: '#faad14' }}>{data.strifeFailureRate}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#595959', fontWeight: '500', fontSize: '13px' }}>占总体比:</span>
                            <span style={{ fontWeight: '700', fontSize: '15px', color: '#52c41a' }}>{data.percentage}%</span>
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        borderRadius: '8px'
      }}
      extra={
        <Space size="middle" wrap>
          <Space size="small">
            <Text type="secondary" style={{ fontSize: '13px' }}>维度1:</Text>
            <Select
              size="middle"
              value={dimension1}
              style={{ width: 110 }}
              onChange={(value) => handleDimensionChange(value, 'dimension1')}
            >
              {dimensionOptions
                .filter((opt) => opt.value !== dimension2)
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
              value={dimension2}
              style={{ width: 110 }}
              onChange={(value) => handleDimensionChange(value, 'dimension2')}
            >
              {dimensionOptions
                .filter((opt) => opt.value !== dimension1)
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
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExportCrossAnalysis}
            size="middle"
          >
            导出
          </Button>
        </Space>
      }
    >
      {crossAnalysis.loading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '300px' 
        }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : (
        <div style={{ marginTop: '4px' }}>
          {renderTableHeatmap()}
        </div>
      )}
    </Card>
  );
};

export default CrossAnalysisHeatmap;
