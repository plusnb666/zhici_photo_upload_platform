import { useState } from 'react';
import { Card, Table, Input, Button, Space, Popconfirm, Image, Tag, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../../api/admin';
import { formatFileSize, formatDate } from '../../utils/format';

export function ImageManagementPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-images', page, search],
    queryFn: () => adminAPI.listImages({ page, limit: 20, search }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminAPI.deleteImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-images'] });
      message.success('已删除');
    },
  });

  const images = data?.data?.data?.items ?? [];
  const total = data?.data?.data?.total ?? 0;

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '缩略图', dataIndex: 'thumbnail_url', key: 'thumb', width: 100,
      render: (url: string) => url ? <Image src={url} width={60} /> : '-' },
    { title: '文件名', dataIndex: 'filename', key: 'filename' },
    { title: '上传者', dataIndex: 'username', key: 'username' },
    { title: '大小', dataIndex: 'file_size', key: 'size', render: (v: number) => formatFileSize(v) },
    { title: '类型', dataIndex: 'mime_type', key: 'mime' },
    { title: '上传时间', dataIndex: 'created_at', key: 'created', render: (d: string) => formatDate(d) },
    { title: '操作', key: 'actions', width: 80,
      render: (_: any, record: any) => (
        <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
          <Button danger size="small">删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>图片管理</h2>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search placeholder="搜索文件名..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 300 }} allowClear />
      </Space>
      <Table
        dataSource={images}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
      />
    </div>
  );
}
