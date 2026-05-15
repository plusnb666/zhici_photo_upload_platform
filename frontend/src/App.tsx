// 赤子の相册 - 前端路由入口
// 路由结构：
//   /                   首页（公开图库，无需登录）
//   /login              登录
//   /register           注册
//   /gallery            图库（需登录，显示所有公开图片）
//   /gallery?mine=1     我的上传（需登录，只显示自己的）
//   /gallery/:id        图片详情
//   /upload             上传图片
//   /profile            个人中心
//   /admin/*            管理后台（需 admin 角色，含仪表盘/用户管理/图片管理）
//
// 路由守卫：
//   ProtectedRoute      未登录重定向到 /login
//   AdminRoute          非 admin 重定向到 /gallery
import { Routes, Route, Navigate } from 'react-router-dom';
import { useLenisScroll } from './hooks/useLenis';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { GalleryPage } from './pages/gallery/GalleryPage';
import { UploadPage } from './pages/upload/UploadPage';
import { ImageDetailPage } from './pages/gallery/ImageDetailPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { ImageManagementPage } from './pages/admin/ImageManagementPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AdminRoute } from './components/common/AdminRoute';
import { TagManagePage } from './pages/admin/TagManagePage';

export default function App() {
  useLenisScroll();
  return (
    <Routes>
      {/* 公开路由：不需要登录 */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* 需登录的路由：ProtectedRoute 检查 token */}
      <Route element={<ProtectedRoute />}>
  {/* Gallery 自带布局，不用 AppLayout 包裹 */}
  <Route path="/gallery" element={<GalleryPage />} />
  <Route path="/upload" element={<UploadPage />} />
  <Route path="/profile" element={<ProfilePage />} />
  <Route path="/gallery/:id" element={<ImageDetailPage />} />

  {/* 其他页面继续用 AppLayout */}
  <Route element={<AppLayout />}>
    <Route element={<AdminRoute />}>
      <Route path="/admin" element={<DashboardPage />} />
      <Route path="/admin/users" element={<UserManagementPage />} />
      <Route path="/admin/images" element={<ImageManagementPage />} />
      <Route path="/admin/tags" element={<TagManagePage />} />
    </Route>
  </Route>
</Route>

      {/* 404 兜底 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
