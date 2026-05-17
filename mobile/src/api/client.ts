import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const client = axios.create({
  baseURL: 'http://47.116.137.143:8080/api/v1',
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const res = await axios.post(
            'http://47.116.137.143:8080/api/v1/auth/refresh',
            { refresh_token: refreshToken }
          );
          const { access_token, refresh_token } = res.data.data;
          useAuthStore.getState().setAccessToken(access_token);
          if (refresh_token) {
            useAuthStore.getState().setAuth(
              access_token, refresh_token, useAuthStore.getState().user!
            );
          }
          original.headers.Authorization = `Bearer ${access_token}`;
          return client(original);
        } catch {
          useAuthStore.getState().clearAuth();
        }
      } else {
        useAuthStore.getState().clearAuth();
      }
    }
    return Promise.reject(error);
  }
);

export default client;
