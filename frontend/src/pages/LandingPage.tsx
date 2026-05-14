import { useState } from 'react';
import { Input, Select, Card, Image, Tag, Space, Spin, Empty, Button, Pagination } from 'antd';
import { SearchOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { imagesAPI } from '../api/images';
import { tagsAPI } from '../api/tags';
import { useAuthStore } from '../store/authStore';
import { formatFileSize, formatDate } from '../utils/format';

export function LandingPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>();

  const { data: imageData, isLoading } = useQuery({
    queryKey: ['public-images', page, search, tagFilter],
    queryFn: () => imagesAPI.listPublic({ page, limit: 20, search, tag: tagFilter }),
  });

  const { data: tagData } = useQuery({
    queryKey: ['public-tags'],
    queryFn: () => tagsAPI.list(),
  });

  const images = imageData?.data?.data?.items ?? [];
  const total = imageData?.data?.data?.total ?? 0;
  const tags = tagData?.data?.data?.items ?? [];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ background: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1677ff' }}>赤子の相册</h1>
        <Space>
          {isAuthenticated ? (
            <Button type="primary" onClick={() => navigate('/gallery')}>进入我的图库</Button>
          ) : (
            <>
              <Button onClick={() => navigate('/login')}>登录</Button>
              <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/register')}>注册</Button>
            </>
          )}
        </Space>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <h2 style={{ marginBottom: 16 }}>公开图片</h2>
        <Space style={{ marginBottom: 16 }} size="middle">
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索图片..."
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
            <Empty description="暂无公开图片" />
          ) : (
            <div className="image-grid">
              {images.map((img: any) => (
                <Card
                  key={img.id}
                  hoverable
                  cover={
                    <div style={{ height: 200, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                      <Image
                        src={img.thumbnail_url || img.url}
                        alt={img.alt_text || img.filename}
                        preview={{ mask: '查看大图' }}
                        style={{ maxHeight: 200, objectFit: 'cover' }}
                      />
                    </div>
                  }
                  onClick={() => navigate(isAuthenticated ? `/gallery/${img.id}` : '/login')}
                >
                  <Card.Meta
                    title={img.filename}
                    description={
                      <div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {formatFileSize(img.file_size)} · {formatDate(img.created_at)} · 上传者: {img.username}
                        </div>
                        {img.tags?.map((t: any) => <Tag key={t.id} color={t.color}>{t.name}</Tag>)}
                      </div>
                    }
                  />
                </Card>
              ))}
            </div>
          )}
        </Spin>

        {total > 20 && (
          <div style={{ textAlign: 'center', marginTop: 24, paddingBottom: 24 }}>
            <Pagination
              current={page}
              pageSize={20}
              total={total}
              onChange={(p) => setPage(p)}
              showTotal={(t) => `共 ${t} 张图片`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
