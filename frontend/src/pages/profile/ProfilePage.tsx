import { Card, Descriptions, Statistic, Row, Col, Progress } from 'antd';
import { UserOutlined, CloudOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { formatFileSize } from '../../utils/format';
import { QUOTA_GB } from '../../utils/constants';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  const storagePercent = (user.storage_used / (QUOTA_GB * 1024 * 1024 * 1024)) * 100;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>个人中心</h2>
      <Card>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
          <Descriptions.Item label="角色">
            {user.role === 'admin' ? '管理员' : '普通用户'}
          </Descriptions.Item>
          <Descriptions.Item label="存储用量">
            {user.role === 'admin' ? (
              <span style={{ color: '#52c41a', fontWeight: 500 }}>{formatFileSize(user.storage_used)} · 无限制</span>
            ) : (
              <Progress
                percent={Math.round(storagePercent * 100) / 100}
                format={() => `${formatFileSize(user.storage_used)} / ${QUOTA_GB} GB`}
                status={storagePercent > 80 ? 'exception' : 'active'}
              />
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
