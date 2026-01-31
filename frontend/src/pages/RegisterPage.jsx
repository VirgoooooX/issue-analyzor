import { useState } from 'react';
import { Form, Input, Button, message, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import authService from '../services/authService';
import './loginPage.css';

function RegisterPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { Title, Text } = Typography;

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      await authService.register(values.username, values.password);
      message.success('注册申请已提交，等待管理员审核');
      form.resetFields();
      navigate('/login', { replace: true });
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message || '注册失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-decoration">
        <div className="decoration-content">
          <div style={{ marginBottom: '32px', transform: 'scale(1.5)' }}>
            <Logo light size={80} showText={false} />
          </div>
          <Title level={1} style={{ color: '#fff', marginBottom: '16px', fontWeight: '700' }}>
            Issue Analyzer
          </Title>
          <Text
            style={{
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '16px',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            账号注册申请
          </Text>
          <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '14px' }}>
            注册后需要管理员审核通过才能登录
          </Text>
          <div className="decoration-circles">
            <div className="circle circle-1"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-3"></div>
          </div>
        </div>
      </div>

      <div className="login-form-wrapper">
        <div className="login-card">
          <div className="login-header">
            <Title level={2} style={{ margin: 0, color: '#262626', fontWeight: '600' }}>
              创建账号
            </Title>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              填写信息并提交审核
            </Text>
          </div>

          <Form form={form} onFinish={handleRegister} layout="vertical" autoComplete="off" className="login-form">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined className="input-icon" />} placeholder="用户名" size="large" disabled={loading} />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                {
                  validator: async (_, value) => {
                    if (!value) return;
                    if (String(value).length < 4) throw new Error('密码至少 4 位');
                  },
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

            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请再次输入密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="input-icon" />}
                placeholder="确认密码"
                size="large"
                disabled={loading}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                disabled={loading}
                icon={<CheckCircleOutlined />}
                className="login-button"
              >
                {loading ? '提交中...' : '提交注册申请'}
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Space size={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                已有账号？
              </Text>
              <Link to="/login" style={{ fontSize: 12 }}>
                返回登录
              </Link>
            </Space>
          </div>

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

export default RegisterPage;

