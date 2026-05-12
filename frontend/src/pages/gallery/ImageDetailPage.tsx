import { useParams, useNavigate } from 'react-router-dom';
import { Card, Image, Descriptions, Tag, Button, Space, Spin, Select, Popconfirm, message } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { imagesAPI } from '../../api/images';
import { tagsAPI } from '../../api/tags';
import { formatFileSize, formatDateTime } from '../../utils/format';

export function ImageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tagData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
  });
  const availableTags = tagData?.data?.data?.items ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['image', id],
    queryFn: () => imagesAPI.get(Number(id)),
    enabled: !!id,
  });

  const toggleMutation = useMutation({
    mutationFn: (tagId: number) => imagesAPI.toggleTag(Number(id), tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image', id] });
    },
  });

  const addTagMutation = useMutation({
    mutationFn: (tagNames: string[]) => imagesAPI.addTags(Number(id), tagNames),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image', id] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      message.success('标签已添加');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => imagesAPI.delete(Number(id)),
    onSuccess: () => {
      message.success('已删除');
      navigate('/gallery');
    },
  });

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const img = data?.data?.data;
  if (!img) return null;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/gallery')} style={{ marginBottom: 16 }}>
        返回
      </Button>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Image src={img.url} alt={img.alt_text || img.filename} style={{ maxHeight: 600 }} />
        </div>

        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="文件名">{img.filename}</Descriptions.Item>
          <Descriptions.Item label="大小">{formatFileSize(img.file_size)}</Descriptions.Item>
          <Descriptions.Item label="类型">{img.mime_type}</Descriptions.Item>
          <Descriptions.Item label="尺寸">{img.width} × {img.height}</Descriptions.Item>
          <Descriptions.Item label="上传时间">{formatDateTime(img.created_at)}</Descriptions.Item>
          <Descriptions.Item label="浏览次数">{img.view_count}</Descriptions.Item>
          <Descriptions.Item label="标记">
            <Space wrap>
              {availableTags.map((t: any) => {
                const imgTag = img.tags?.find((it: any) => it.id === t.id);
                const count = imgTag?.count ?? 0;
                const active = imgTag?.active ?? false;
                return (
                  <Tag
                    key={t.id}
                    color={active ? t.color : undefined}
                    style={{ cursor: 'pointer', opacity: active ? 1 : 0.6, fontSize: 14, padding: '2px 12px', userSelect: 'none' }}
                    onClick={() => toggleMutation.mutate(t.id)}
                  >
                    {t.name} {count > 0 ? count : ''}
                  </Tag>
                );
              })}
              <Select
                mode="tags"
                placeholder="+ 自定义标签"
                style={{ minWidth: 140 }}
                onChange={(vals) => {
                  if (vals.length > 0) addTagMutation.mutate(vals as string[]);
                }}
                value={[]}
                notFoundContent={null}
              />
            </Space>
          </Descriptions.Item>
        </Descriptions>

        <Space style={{ marginTop: 24 }}>
          <Button icon={<DownloadOutlined />} href={img.download_url} target="_blank">
            下载
          </Button>
          <Button icon={<CopyOutlined />} onClick={() => {
            navigator.clipboard.writeText(img.url);
            message.success('链接已复制');
          }}>
            复制链接
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate()}>
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </Card>
    </div>
  );
}
