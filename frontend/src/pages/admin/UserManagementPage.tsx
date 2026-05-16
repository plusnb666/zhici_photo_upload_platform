import { useState } from 'react';
import { Card, Table, Input, Select, Button, Space, Popconfirm, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../../api/admin';
import { formatDate } from '../../utils/format';

export function UserManagementPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => adminAPI.listUsers({ page, limit: 20, search }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => adminAPI.updateUser(id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      message.success('已更新');
    },
  });

  const resetPwdMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      adminAPI.resetUserPassword(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      message.success('密码已重置');
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || '重置失败');
    },
  });

  const handleResetPassword = (record: any) => {
    const pwd = prompt(`为 ${record.username} (${record.email}) 输入新密码（至少6位）：`);
    if (!pwd) return;
    if (pwd.length < 6) {
      message.error('密码至少6位');
      return;
    }
    resetPwdMutation.mutate({ id: record.id, password: pwd });
  };

  const users = data?.data?.data?.items ?? [];
  const total = data?.data?.data?.total ?? 0;

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '角色', dataIndex: 'role', key: 'role',
      render: (role: string, record: any) => (
        <Select
          value={role}
          onChange={(v) => updateMutation.mutate({ id: record.id, role: v })}
          style={{ width: 100 }}
          options={[
            { label: '用户', value: 'user' },
            { label: '管理员', value: 'admin' },
          ]}
        />
      ),
    },
    { title: '存储用量', dataIndex: 'storage_used', key: 'storage_used' },
    { title: '注册时间', dataIndex: 'created_at', key: 'created_at', render: (d: string) => formatDate(d) },
    { title: '操作', key: 'actions',
      render: (_: any, record: any) => (
        <Popconfirm
          title={`重置 ${record.username} 的密码？`}
          description="将为其设置新密码"
          onConfirm={() => handleResetPassword(record)}
        >
          <Button size="small" type="link" danger>重置密码</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>用户管理</h2>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search placeholder="搜索用户名或邮箱..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 300 }} allowClear />
      </Space>
      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
      />
    </div>
  );
}
