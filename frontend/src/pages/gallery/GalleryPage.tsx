import { useState } from 'react';
import { Input, Select, Card, Image, Tag, Space, Button, message, Popconfirm, Empty, Spin } from 'antd';
import { SearchOutlined, DeleteOutlined, CopyOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { imagesAPI } from '../../api/images';
import { tagsAPI } from '../../api/tags';
import { formatFileSize, formatDate } from '../../utils/format';

export function GalleryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mine = searchParams.get('mine') === '1';
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>();

  const { data: imageData, isLoading } = useQuery({
    queryKey: [mine ? 'images' : 'public-images', page, search, tagFilter],
    queryFn: () => mine
      ? imagesAPI.list({ page, limit: 20, search, tag: tagFilter })
      : imagesAPI.listPublic({ page, limit: 20, search, tag: tagFilter }),
  });

  const { data: tagData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => imagesAPI.delete(id),
    onSuccess: () => {
      message.success('已删除');
      queryClient.invalidateQueries({ queryKey: ['images'] });
    },
  });

  const images = imageData?.data?.data?.items ?? [];
  const tags = tagData?.data?.data?.items ?? [];

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    message.success('链接已复制');
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%' }} size="middle">
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索图片名称..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          placeholder="按标签筛选"
          value={tagFilter}
          onChange={(v) => { setTagFilter(v); setPage(1); }}
          allowClear
          style={{ width: 160 }}
          options={tags.map((t: any) => ({ label: t.name, value: t.name }))}
        />
      </Space>

      <Spin spinning={isLoading}>
        {images.length === 0 ? (
          <Empty description="暂无图片，快去上传吧" />
        ) : (
          <div className="image-grid">
            {images.map((img: any) => (
              <Card
                key={img.id}
                hoverable
                cover={
                  <div style={{ position: 'relative', height: 200, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                    {!mine && (
                      <span style={{ position: 'absolute', top: 4, left: 4, zIndex: 1, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, padding: '1px 8px', borderRadius: 10, pointerEvents: 'none' }}>
                        {img.username}
                      </span>
                    )}
                    <Image
                      src={img.thumbnail_url || img.url}
                      alt={img.alt_text || img.filename}
                      preview={false}
                      style={{ maxHeight: 200, objectFit: 'cover' }}
                      onClick={() => navigate(`/gallery/${img.id}`)}
                    />
                  </div>
                }
                actions={[
                  <EyeOutlined key="view" onClick={() => navigate(`/gallery/${img.id}`)} />,
                  <CopyOutlined key="copy" onClick={() => handleCopyUrl(img.url)} />,
                  <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate(img.id)}>
                    <DeleteOutlined key="delete" />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  title={img.filename}
                  description={
                    <div>
                      <div>{formatFileSize(img.file_size)} · {formatDate(img.created_at)}</div>
                      {img.tags?.map((t: any) => <Tag key={t.id} color={t.color}>{t.name}</Tag>)}
                    </div>
                  }
                />
              </Card>
            ))}
          </div>
        )}
      </Spin>
    </div>
  );
}
