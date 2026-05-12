// Axios 实例 + 拦截器
// 封装了所有 HTTP 请求的通用逻辑：
//   1. 自动注入 JWT Token（请求拦截器）
//   2. Token 过期自动刷新（响应拦截器，401 时静默重试）
//   3. 刷新失败自动跳到登录页

import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const client = axios.create({
  baseURL: '/api/v1',    // 所有请求以 /api/v1 开头
  timeout: 30000,        // 30 秒超时
});

// ── 请求拦截器：自动附加 Authorization 头 ──
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── 响应拦截器：401 自动刷新 Token ──
client.interceptors.response.use(
  (response) => response,  // 正常响应直接透传
  async (error) => {
    const original = error.config;

    // 如果收到 401 且还没重试过，尝试用 refresh_token 换新的 access_token
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;  // 防止无限重试

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const res = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
          const { access_token, refresh_token } = res.data.data;
          useAuthStore.getState().setAccessToken(access_token);
          if (refresh_token) {
            useAuthStore.getState().setAuth(access_token, refresh_token, useAuthStore.getState().user!);
          }
          original.headers.Authorization = `Bearer ${access_token}`;
          return client(original);  // 用新 token 重试原请求
        } catch {
          // 刷新失败，清除状态，跳转登录
          useAuthStore.getState().clearAuth();
          window.location.href = '/login';
        }
      } else {
        // 没有 refresh_token，直接跳登录
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default client;
