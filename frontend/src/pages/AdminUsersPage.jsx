import { Button, Form, Input, Modal, Result, Select, Space, Table, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import useStore from '../store';
import { adminUserService } from '../services/adminUserService';

function AdminUsersPage() {
  const { auth } = useStore();
  const isAdmin = auth?.role === 'admin';

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadUsers = async (query) => {
    setLoading(true);
    try {
      const response = await adminUserService.listUsers(query ? { q: query } : {});
      setUsers(response.data.users || []);
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message || '加载用户失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers('');
    }
  }, [isAdmin]);

  const columns = useMemo(
    () => [
      {
        title: '用户名',
        dataIndex: 'username',
        key: 'username',
      },
      {
        title: '角色',
        dataIndex: 'role',
        key: 'role',
        render: (role) => (role === 'admin' ? <Tag color="red">admin</Tag> : <Tag>user</Tag>),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (status) => {
          if (status === 'active') return <Tag color="green">active</Tag>;
          if (status === 'pending') return <Tag color="gold">pending</Tag>;
          if (status === 'rejected') return <Tag color="red">rejected</Tag>;
          return <Tag>{status || '-'}</Tag>;
        },
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
      },
      {
        title: '操作',
        key: 'actions',
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              onClick={() => {
                setEditingUser(record);
                editForm.setFieldsValue({ role: record.role, status: record.status || 'active', password: '' });
                setEditOpen(true);
              }}
            >
              编辑
            </Button>
            {record.status === 'pending' && (
              <>
                <Button
                  type="link"
                  onClick={() => {
                    Modal.confirm({
                      title: '批准注册申请',
                      content: `确定批准用户 "${record.username}" 吗？`,
                      okText: '批准',
                      cancelText: '取消',
                      async onOk() {
                        try {
                          await adminUserService.updateUser(record.id, { status: 'active' });
                          message.success('已批准');
                          await loadUsers(q);
                        } catch (error) {
                          const errorMessage = error.response?.data?.error?.message || error.message || '操作失败';
                          message.error(errorMessage);
                        }
                      },
                    });
                  }}
                >
                  批准
                </Button>
                <Button
                  type="link"
                  danger
                  onClick={() => {
                    Modal.confirm({
                      title: '拒绝注册申请',
                      content: `确定拒绝用户 "${record.username}" 吗？`,
                      okText: '拒绝',
                      okType: 'danger',
                      cancelText: '取消',
                      async onOk() {
                        try {
                          await adminUserService.updateUser(record.id, { status: 'rejected' });
                          message.success('已拒绝');
                          await loadUsers(q);
                        } catch (error) {
                          const errorMessage = error.response?.data?.error?.message || error.message || '操作失败';
                          message.error(errorMessage);
                        }
                      },
                    });
                  }}
                >
                  拒绝
                </Button>
              </>
            )}
            <Button
              type="link"
              danger
              onClick={() => {
                Modal.confirm({
                  title: '确认删除用户',
                  content: `确定要删除用户 "${record.username}" 吗？该用户保存的筛选器也会被删除。`,
                  okText: '删除',
                  okType: 'danger',
                  cancelText: '取消',
                  async onOk() {
                    try {
                      await adminUserService.deleteUser(record.id);
                      message.success('删除成功');
                      await loadUsers(q);
                    } catch (error) {
                      const errorMessage = error.response?.data?.error?.message || error.message || '删除失败';
                      message.error(errorMessage);
                    }
                  },
                });
              }}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [editForm, q]
  );

  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <Result status="403" title="403" subTitle="仅管理员可访问该页面" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <Input.Search
          placeholder="按用户名搜索"
          value={q}
          allowClear
          onChange={(e) => setQ(e.target.value)}
          onSearch={async (value) => {
            await loadUsers(value);
          }}
          style={{ width: 360 }}
        />
        <Button
          type="primary"
          onClick={() => {
            createForm.resetFields();
            createForm.setFieldsValue({ role: 'user' });
            setCreateOpen(true);
          }}
        >
          新建用户
        </Button>
        <Button
          onClick={async () => {
            await loadUsers(q);
          }}
        >
          刷新
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={users}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />

      <Modal
        title="新建用户"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        cancelText="取消"
        onOk={async () => {
          try {
            const values = await createForm.validateFields();
            await adminUserService.createUser(values);
            message.success('创建成功');
            setCreateOpen(false);
            await loadUsers(q);
          } catch (error) {
            if (error?.errorFields) return;
            const errorMessage = error.response?.data?.error?.message || error.message || '创建失败';
            message.error(errorMessage);
          }
        }}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              options={[
                { label: 'user', value: 'user' },
                { label: 'admin', value: 'admin' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑用户${editingUser ? `：${editingUser.username}` : ''}`}
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditingUser(null);
        }}
        okText="保存"
        cancelText="取消"
        onOk={async () => {
          try {
            const values = await editForm.validateFields();
            const payload = { role: values.role, status: values.status };
            if (values.password && String(values.password).trim()) {
              payload.password = values.password;
            }
            await adminUserService.updateUser(editingUser.id, payload);
            message.success('保存成功');
            setEditOpen(false);
            setEditingUser(null);
            await loadUsers(q);
          } catch (error) {
            if (error?.errorFields) return;
            const errorMessage = error.response?.data?.error?.message || error.message || '保存失败';
            message.error(errorMessage);
          }
        }}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              options={[
                { label: 'user', value: 'user' },
                { label: 'admin', value: 'admin' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              options={[
                { label: 'active', value: 'active' },
                { label: 'pending', value: 'pending' },
                { label: 'rejected', value: 'rejected' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="重置密码（可选）"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) return;
                  if (String(value).length < 4) throw new Error('密码至少 4 位');
                },
              },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AdminUsersPage;
