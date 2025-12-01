import { useState } from 'react';
import { Form, Input, Button, message, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import useStore from '../store';
import Logo from '../components/Logo';
import './loginPage.css';

function LoginPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login } = useStore();
  
  const { Title, Text } = Typography;

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功！');
      // 登录成功后会自动重定向到主页面
    } catch (error) {
      message.error(error.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* 左侧背景装饰 */}
      <div className="login-decoration">
        <div className="decoration-content">
          {/* 使用新 Logo */}
          <div style={{ marginBottom: '32px', transform: 'scale(1.5)' }}>
            <Logo light size={80} showText={false} />
          </div>
          <Title level={1} style={{ color: '#fff', marginBottom: '16px', fontWeight: '700' }}>
            Issue Analyzer
          </Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '16px', display: 'block', marginBottom: '8px' }}>
            设备故障数据分析平台
          </Text>
          <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '14px' }}>
            多维度分析 · 智能统计 · 可视化报表
          </Text>
          
          {/* 装饰性图形 */}
          <div className="decoration-circles">
            <div className="circle circle-1"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-3"></div>
          </div>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="login-form-wrapper">
        <div className="login-card">
          <div className="login-header">
            <Title level={2} style={{ margin: 0, color: '#262626', fontWeight: '600' }}>
              欢迎登录
            </Title>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              请输入您的账号和密码
            </Text>
          </div>
        
          <Form
            form={form}
            onFinish={handleLogin}
            layout="vertical"
            autoComplete="off"
            className="login-form"
          >
            <Form.Item
              name="username"
              rules={[
                {
                  required: true,
                  message: '请输入用户名',
                },
              ]}
            >
              <Input
                prefix={<UserOutlined className="input-icon" />}
                placeholder="用户名"
                size="large"
                disabled={loading}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                {
                  required: true,
                  message: '请输入密码',
                },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="input-icon" />}
                placeholder="密码"
                size="large"
                disabled={loading}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: '12px' }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                disabled={loading}
                icon={<LoginOutlined />}
                className="login-button"
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </Form.Item>
          </Form>
        
          {import.meta.env.MODE === 'development' && (
            <div className="dev-info">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  开发环境默认凭据
                </Text>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <Text code style={{ fontSize: '12px' }}>admin</Text>
                  <Text type="secondary">/</Text>
                  <Text code style={{ fontSize: '12px' }}>password123</Text>
                </div>
              </Space>
            </div>
          )}

          <div className="login-footer">
            <Text type="secondary" style={{ fontSize: '12px' }}>
              ©2025 Issue Analyzer System · By Vigoss
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
