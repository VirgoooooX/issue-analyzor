import { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import useStore from '../store';
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
      <Card className="login-card" bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #1890ff 0%, #003366 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 'bold'
          }}>
            📊
          </div>
          <Title level={3} style={{ 
            margin: 0, 
            color: '#001529',
            fontWeight: '600'
          }}>
            Failure Tracker
          </Title>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            设备故障数据分析平台
          </Text>
        </div>
        
        <Form
          form={form}
          onFinish={handleLogin}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              {
                required: true,
                message: '请输入用户名',
              },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              placeholder="请输入用户名"
              size="large"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              {
                required: true,
                message: '请输入密码',
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#1890ff' }} />}
              placeholder="请输入密码"
              size="large"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              disabled={loading}
              icon={<LoginOutlined />}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </Form.Item>
        </Form>
        
        <div style={{ 
          marginTop: '24px', 
          textAlign: 'center', 
          padding: '16px',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e8e8e8'
        }}>
          <Space direction="vertical" size="small">
            {import.meta.env.MODE === 'development' ? (
              // 开发环境显示默认凭据
              <>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  开发环境默认凭据
                </Text>
                <Text code>用户名: admin</Text>
                <Text code>密码: password123</Text>
                <Text type="warning" style={{ fontSize: '11px', marginTop: '8px' }}>
                  ⚠️ 部署到生产环境时请修改默认密码
                </Text>
              </>
            ) : (
              // 生产环境只显示提示信息
              <>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  请联系管理员获取登录凭据
                </Text>
                <Text type="warning" style={{ fontSize: '11px', marginTop: '8px' }}>
                  ⚠️ 请确保使用安全的用户名和密码
                </Text>
              </>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
}

export default LoginPage;
