import { Card, Statistic, Row, Col, Spin, Tag, Table } from 'antd';
import { PictureOutlined, UserOutlined, CloudOutlined, UploadOutlined, TagsOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../../api/admin';
import { formatFileSize } from '../../utils/format';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: () => adminAPI.stats() });
  const { data: trend } = useQuery({ queryKey: ['admin-trend'], queryFn: () => adminAPI.uploadTrend() });
  const { data: tagStats } = useQuery({ queryKey: ['admin-tag-stats'], queryFn: () => adminAPI.tagStats() });

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const s = stats?.data?.data ?? {};
  const ts = tagStats?.data?.data ?? {};

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>管理仪表盘</h2>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}><Card><Statistic title="总用户数" value={s.total_users ?? 0} prefix={<UserOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="总图片数" value={s.total_images ?? 0} prefix={<PictureOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="存储用量" value={s.total_storage ?? 0} prefix={<CloudOutlined />} formatter={(v) => formatFileSize(v as number)} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="今日上传" value={s.today_uploads ?? 0} prefix={<UploadOutlined />} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card title="标签统计" extra={<TagsOutlined />}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Statistic title="已标记图片" value={ts.tagged_image_count ?? 0} suffix={`/ ${ts.total_images ?? 0}`} />
              </Col>
            </Row>
            {ts.top_tags?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ts.top_tags?.map((t: any) => ({ name: t.tag_name, count: t.image_count })) ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1677ff" name="标记数" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: '#999', textAlign: 'center', padding: 40 }}>暂无标签数据</div>
            )}
            {ts.top_tags?.map((t: any) => (
              <Tag key={t.tag_id} color={t.color}>{t.tag_name} ({t.image_count})</Tag>
            ))}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="近30天上传统计">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend?.data?.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#1677ff" name="上传数" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
