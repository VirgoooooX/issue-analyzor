import React from 'react';
import { Layout } from 'antd';
import FailureRateMatrix from '../components/FailureRateMatrix';

const { Content } = Layout;

function FailureRateMatrixPage() {
  return (
    <Layout style={{ height: '100%' }}>
      <Content style={{ padding: '24px', overflow: 'auto', background: '#f0f2f5' }}>
        <FailureRateMatrix />
        <div style={{ textAlign: 'center', marginTop: '24px', color: '#999', fontSize: '12px', padding: '20px 0' }}>
          <div>Issue Analyzer System ©2025 By Vigoss</div>
        </div>
      </Content>
    </Layout>
  );
}

export default FailureRateMatrixPage;
