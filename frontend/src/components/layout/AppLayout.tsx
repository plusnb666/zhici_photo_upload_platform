import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Dropdown, theme } from 'antd';
import {
  PictureOutlined,
  CloudUploadOutlined,
  UserOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, clearAuth } = useAuthStore();
  const { token: themeToken } = theme.useToken();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const menuItems = [
    { key: '/gallery', icon: <PictureOutlined />, label: '图片库' },
    { key: '/gallery?mine=1', icon: <UserOutlined />, label: '我的上传' },
    { key: '/upload', icon: <CloudUploadOutlined />, label: '上传' },
    ...(isAdmin
      ? [
          {
            key: 'admin',
            icon: <DashboardOutlined />,
            label: '管理',
            children: [
              { key: '/admin', label: '仪表盘' },
              { key: '/admin/users', label: '用户管理' },
              { key: '/admin/images', label: '图片管理' },
            ],
          },
        ]
      : []),
  ];

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人中心', onClick: () => navigate('/profile') },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        style={{ background: themeToken.colorBgContainer }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: collapsed ? 14 : 18,
          fontWeight: 700,
          color: themeToken.colorPrimary,
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          {collapsed ? '🖼' : '赤子の相册'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname + location.search]}
          defaultOpenKeys={isAdmin ? ['admin'] : []}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: themeToken.colorBgContainer,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{ items: userMenuItems }}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserOutlined />
              <span>{user?.username}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
