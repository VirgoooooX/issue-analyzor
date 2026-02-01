import { Button, Space, Table, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import { projectService } from '../services/projectService';

const { Title } = Typography;

function formatSpecFailureRate(overview) {
  const totalSampleSize = overview?.totalSampleSize || 0;
  const specSNCount = overview?.specSNCount || 0;
  if (!totalSampleSize) return null;
  return ((specSNCount / totalSampleSize) * 100).toFixed(2);
}

function KpiDashboardPage() {
  const navigate = useNavigate();
  const { projects, auth, loadProjects, selectProject } = useStore();
  const { list, loading } = projects;
  const isPowerUser = auth?.role === 'admin' || auth?.role === 'manager';

  const [kpiById, setKpiById] = useState({});
  const [kpiLoading, setKpiLoading] = useState(false);

  const rows = useMemo(() => {
    const sorted = [...(list || [])].sort((a, b) => {
      const keyA = (a.project_key || a.name || '').toUpperCase();
      const keyB = (b.project_key || b.name || '').toUpperCase();
      if (keyA !== keyB) return keyA.localeCompare(keyB);
      const phaseA = (a.phase || '').toUpperCase();
      const phaseB = (b.phase || '').toUpperCase();
      if (phaseA !== phaseB) return phaseA.localeCompare(phaseB);
      const timeA = a.upload_time || '';
      const timeB = b.upload_time || '';
      return timeB.localeCompare(timeA);
    });

    const groupSizes = new Map();
    sorted.forEach((p) => {
      const k = p.project_key || p.name || '-';
      groupSizes.set(k, (groupSizes.get(k) || 0) + 1);
    });

    const seen = new Map();
    return sorted.map((p) => {
      const k = p.project_key || p.name || '-';
      const indexInGroup = seen.get(k) || 0;
      seen.set(k, indexInGroup + 1);
      return { ...p, __groupKey: k, __rowSpan: indexInGroup === 0 ? groupSizes.get(k) : 0 };
    });
  }, [list]);

  const fetchKpis = async (targets) => {
    if (!targets.length) return;
    setKpiLoading(true);
    try {
      const results = await Promise.allSettled(
        targets.map(async (p) => {
          const response = await projectService.getAnalysis(p.id);
          return { id: p.id, overview: response.data?.overview || null };
        })
      );

      const next = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          next[r.value.id] = r.value.overview;
        }
      });
      setKpiById((prev) => ({ ...prev, ...next }));
    } catch (e) {
      message.error('KPI加载失败，请重试');
    } finally {
      setKpiLoading(false);
    }
  };

  useEffect(() => {
    const targets = rows.filter((p) => !kpiById[p.id]);
    if (targets.length === 0) return;
    fetchKpis(targets);
  }, [rows]);

  const columns = [
    {
      title: '项目',
      dataIndex: '__groupKey',
      key: 'project_key',
      render: (_, record) => ({
        children: record.__groupKey,
        props: { rowSpan: record.__rowSpan },
      }),
    },
    {
      title: 'Build',
      key: 'phase',
      render: (_, record) => (
        <Space size={8}>
          {record.phase ? <Tag color="blue">{record.phase}</Tag> : <Tag>UNKNOWN</Tag>}
          <span>{record.name}</span>
        </Space>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'upload_time',
      key: 'upload_time',
      width: 180,
    },
    {
      title: '截止时间',
      dataIndex: 'last_issue_date',
      key: 'last_issue_date',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: 'Issues',
      dataIndex: 'total_issues',
      key: 'total_issues',
      width: 90,
    },
    {
      title: 'WF',
      key: 'uniqueWFs',
      width: 70,
      render: (_, record) => kpiById[record.id]?.uniqueWFs ?? '-',
    },
    {
      title: 'Symptoms',
      key: 'uniqueSymptoms',
      width: 110,
      render: (_, record) => kpiById[record.id]?.uniqueSymptoms ?? '-',
    },
    {
      title: 'Spec失败率',
      key: 'specFailureRate',
      width: 110,
      render: (_, record) => {
        const percent = formatSpecFailureRate(kpiById[record.id]);
        return percent === null ? '-' : `${percent}%`;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          onClick={async () => {
            await selectProject(record.id);
            navigate(`/build/${record.id}`);
          }}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>项目KPI面板</Title>
        <Space>
          <Button
            onClick={async () => {
              setKpiById({});
              await loadProjects();
            }}
            loading={loading || kpiLoading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#999' }}>
          {isPowerUser ? '暂无Build，请上传Excel创建Build' : '暂无Build，请联系管理员或manager上传Excel'}
        </div>
      ) : (
        <Table
          rowKey="id"
          loading={loading || kpiLoading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 50, showSizeChanger: false }}
        />
      )}
    </div>
  );
}

export default KpiDashboardPage;
