import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout, Button, Tag, Spin, Card } from 'antd';
import { ArrowLeftOutlined, CloseOutlined } from '@ant-design/icons';
import useStore from '../store';
import AnalysisView from '../components/Dashboard';
import DetailedIssuesTable from '../components/DetailedIssuesTable';

const { Content } = Layout;

const FilterResultsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    projects,
    filterResults,
    filterContext,
    loadFilterResults,
    updateFilterContext,
    removeFilterTag,
    clearAllFilters,
    resetFilters,
  } = useStore();

  useEffect(() => {
    // Parse filters from URL
    const filtersParam = searchParams.get('filters');
    const projectId = searchParams.get('project') || projects.current?.id;

    if (projectId) {
      let filters = {};
      if (filtersParam) {
        try {
          filters = JSON.parse(atob(filtersParam));
        } catch (e) {
          console.error('Failed to parse filters:', e);
        }
      }
      updateFilterContext(filters);
      loadFilterResults(projectId, filters, 1, 50);
    }
  }, [searchParams]);

  const handleBack = () => {
    // 清除所有筛选条件，然后返回 Dashboard 页面
    // 同时清除两个地方：filterContext 和 filters
    clearAllFilters();
    resetFilters();
    navigate('/dashboard');
  };

  const handleRemoveTag = (tagKey, tagValue) => {
    // Remove the tag first
    removeFilterTag(tagKey, tagValue);
    
    // Use setTimeout to ensure the store state is updated before accessing it
    setTimeout(() => {
      const state = useStore.getState();
      const updatedFilters = { ...state.filterContext.appliedFilters };
      
      // Reload data with updated filters
      if (projects.current?.id) {
        loadFilterResults(projects.current.id, updatedFilters, 1, 50);
        // Update URL to reflect current filters
        const filtersParam = btoa(JSON.stringify(updatedFilters));
        navigate(`/filter-results?project=${projects.current.id}&filters=${filtersParam}`);
      }
    }, 0);
  };

  const handleClearAll = () => {
    clearAllFilters();
    // Reload data with no filters
    if (projects.current?.id) {
      loadFilterResults(projects.current.id, {}, 1, 50);
      // Update URL to reflect cleared filters
      navigate('/dashboard');
    }
  };

  const renderFilterBreadcrumb = () => {
    if (filterContext.filterTags.length === 0) {
      return <div style={{ padding: '6px 12px', color: '#999', fontSize: '12px' }}>无筛选条件</div>;
    }

    return (
      <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '12px', marginRight: '4px' }}>筛选条件:</span>
        {filterContext.filterTags.map((tag, index) => (
          <Tag
            key={`${tag.key}-${tag.value}-${index}`}
            closable
            size="small"
            onClose={() => handleRemoveTag(tag.key, tag.value)}
          >
            {tag.key}: {tag.value}
          </Tag>
        ))}
        <Button
          type="link"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleClearAll}
        >
          清除所有
        </Button>
      </div>
    );
  };

  // 构造统一的statistics数据结构
  const statistics = filterResults.statistics ? {
    totalCount: filterResults.statistics.totalCount,
    specCount: filterResults.statistics.specCount,
    strifeCount: filterResults.statistics.strifeCount,
    specSNCount: filterResults.statistics.specSNCount || filterResults.statistics.specCount,  // 用于FR计算的去重SN数量
    strifeSNCount: filterResults.statistics.strifeSNCount || filterResults.statistics.strifeCount,  // 用于FR计算的去重SN数量
    uniqueWFs: filterResults.statistics.uniqueWFs,
    uniqueConfigs: filterResults.statistics.uniqueConfigs,
    uniqueSymptoms: filterResults.statistics.uniqueSymptoms,
    totalSampleSize: filterResults.statistics.totalSamples || 0
  } : null;

  if (filterResults.loading) {
    return (
      <Layout>
        <Content style={{ padding: '24px' }}>
          <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout>
      <Content style={{ padding: '12px', backgroundColor: '#f0f2f5' }}>
        {/* Header */}
        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack} size="small">
            返回
          </Button>
          <span style={{ fontSize: '12px', color: '#999' }}>Dashboard / 筛选结果分析</span>
        </div>

        {/* Filter Tags */}
        <Card size="small" style={{ marginBottom: '8px' }}>{renderFilterBreadcrumb()}</Card>

        {/* Analysis View - 复用Dashboard的分析视图 */}
        <AnalysisView
          statistics={statistics}
          symptomStats={filterResults.analysis?.symptomStats}
          wfStats={filterResults.analysis?.wfStats}
          testStats={filterResults.analysis?.testStats}
          configStats={filterResults.analysis?.configStats}
          faStatusStats={filterResults.statistics?.faStatusDistribution}
          projectId={projects.current?.id}
          filters={filterContext.appliedFilters}
          loading={false}
          error={null}
          showProjectInfo={false}
        />

        {/* 详细数据表格 */}
        <div style={{ marginTop: '24px' }}>
          <DetailedIssuesTable projectId={projects.current?.id} useFilterResults={true} />
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '24px', color: '#999', fontSize: '12px', padding: '20px 0' }}>
          <div>Issue Analyzer System ©2025 By Vigoss</div>
        </div>
      </Content>
    </Layout>
  );
}

export default FilterResultsPage;
