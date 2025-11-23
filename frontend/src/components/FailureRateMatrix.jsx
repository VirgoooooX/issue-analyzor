import React, { useEffect, useState } from 'react';
import { Card, Spin, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import { projectService } from '../services/projectService';
import '../styles/failureRateMatrix.css';

/**
 * 失败率矩阵组件 - 纯 HTML 表格方式
 * 纵向按 WF 排列，横向按 Test 分组
 * 每个 Test 下显示 4 个 Config 列
 */
function FailureRateMatrix() {
  const navigate = useNavigate();
  const { projects, updateFilterContext } = useStore();
  const projectId = projects.current?.id;
  
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    loadMatrixData();
  }, [projectId]);

  const loadMatrixData = async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await projectService.getFailureRateMatrix(projectId);
      const data = response.data;

      if (!data || !data.wfs || data.wfs.length === 0) {
        setError('无法获取项目分析数据');
        setLoading(false);
        return;
      }

      setMatrixData(data);

      console.log('Matrix data loaded:', {
        wfCount: data.wfs.length,
        testsByWf: data.testsByWf,
        matrix: data.matrix,
      });
    } catch (err) {
      console.error('Failed to load matrix data:', err);
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 辅助函数：处理数据单元格点击
  const handleCellClick = (wf, testName, config) => {
    if (!testName || !config) return;
    
    // 构建筛选条件
    const filters = {
      wfs: [wf],
      failed_tests: [testName],
      configs: [config],
    };
    
    // 更新过滤上下文
    updateFilterContext(filters);
    
    // 编码筛选条件到 URL
    const filtersParam = btoa(JSON.stringify(filters));
    
    // 导航到筛选结果页面
    navigate(`/filter-results?project=${projectId}&filters=${filtersParam}`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="正在加载矩阵数据..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty description={error} style={{ marginTop: '100px' }} />
      </div>
    );
  }

  if (!matrixData || matrixData.wfs.length === 0) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty description="暂无矩阵数据" style={{ marginTop: '100px' }} />
      </div>
    );
  }

  // 固定显示 3 个 Test 分组
  const maxTests = 3;
  const configs = matrixData.configs; // ['R1CASN', 'R2CBCN', 'R3CBCN', 'R4FNSN']
  const wfs = matrixData.wfs; // WF 数组
  const testsByWf = matrixData.testsByWf; // { wf: [{ testId, testName }] }
  const matrix = matrixData.matrix; // { "wf-testIdx": { testName, configs: {...} } }

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title="失败率矩阵 (WF × Test × Config)"
        style={{
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderRadius: '8px',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="failure-rate-matrix">
            <thead>
              {/* 单行表头：WF | Test1 | R1CASN | R2CBCN | R3CBCN | R4FNSN | Test2 | ... */}
              <tr>
                <th className="wf-header">WF</th>
                {Array.from({ length: maxTests }).map((_, idx) => (
                  <React.Fragment key={`test-group-${idx}`}>
                    <th className="test-header">{`Test${idx + 1}`}</th>
                    {configs.map((config) => (
                      <th key={`test${idx + 1}-${config}`} className="config-header">
                        {config}
                      </th>
                    ))}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {wfs.map(wf => {
                const tests = testsByWf[wf] || [];
                
                // 按 Test 顺序分组
                const testsByGroup = Array.from({ length: maxTests }, () => null);
                tests.forEach((testObj, idx) => {
                  if (idx < maxTests) {
                    testsByGroup[idx] = testObj;
                  }
                });
                
                return (
                  <tr key={wf} className="data-row">
                    {/* WF 列 */}
                    <td className="wf-cell">{wf}</td>
                    
                    {/* 为每个 Test 分组渲染单元格 */}
                    {testsByGroup.map((testObj, testIdx) => {
                      const matrixKey = `${wf}-${testIdx}`;
                      const cellData = matrix[matrixKey];
                      
                      // 如果该 Test 位置没有数据，渲染 Test名称列 + 4个空Config列
                      if (!cellData) {
                        return (
                          <React.Fragment key={`${wf}-test${testIdx}`}>
                            <td className="test-name-cell"></td>
                            {configs.map((config) => (
                              <td key={`${wf}-test${testIdx}-${config}`} className="data-cell empty"></td>
                            ))}
                          </React.Fragment>
                        );
                      }
                      
                      // 有数据：显示 Test 名称 + 4个Config的数据
                      const configsData = cellData.configs || {};
                      
                      return (
                        <React.Fragment key={`${wf}-test${testIdx}`}>
                          {/* Test 名称列 */}
                          <td className="test-name-cell">{cellData.testName}</td>
                          
                          {/* 4 个 Config 列 */}
                          {configs.map((config) => {
                            const cellValue = configsData[config];
                            
                            // 根据失败类型应用不同样式
                            let cellClass = 'data-cell';
                            let displayText = '';
                            
                            if (cellValue) {
                              displayText = cellValue.text;
                              if (cellValue.type === 'spec') {
                                cellClass += ' spec-failure'; // 淡红色
                              } else if (cellValue.type === 'strife') {
                                cellClass += ' strife-failure'; // 淡黄色
                              } else if (cellValue.type === 'none') {
                                cellClass += ' no-failure'; // 淡绿色
                              }
                            }
                            
                            return (
                              <td
                                key={`${wf}-test${testIdx}-${config}`}
                                className={cellClass}
                                onClick={() => handleCellClick(wf, cellData.testName, config)}
                                style={{ cursor: displayText ? 'pointer' : 'default' }}
                              >
                                {displayText}
                              </td>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default FailureRateMatrix;
