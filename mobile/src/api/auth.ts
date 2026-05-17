import client from './client';

export interface User {
  id: number; username: string; email: string;
  role: 'user' | 'admin'; avatar_url?: string; storage_used: number;
}

export const authAPI = {
  register: (username: string, email: string, password: string) =>
    client.post('/auth/register', { username, email, password }),
  login: (email: string, password: string) =>
    client.post('/auth/login', { email, password }),
  refresh: (refreshToken: string) =>
    client.post('/auth/refresh', { refresh_token: refreshToken }),
  logout: (refreshToken: string) =>
    client.post('/auth/logout', { refresh_token: refreshToken }),
  me: () => client.get('/auth/me'),
};
