import client from './client';

export interface LoginParams {
  email: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    avatar_url?: string;
    storage_used: number;
  };
}

export const authAPI = {
  login: (params: LoginParams) => client.post<{ data: AuthResponse }>('/auth/login', params),
  register: (params: RegisterParams) => client.post<{ data: AuthResponse }>('/auth/register', params),
  refresh: (refreshToken: string) => client.post('/auth/refresh', { refresh_token: refreshToken }),
  logout: (refreshToken: string) => client.post('/auth/logout', { refresh_token: refreshToken }),
  me: () => client.get('/auth/me'),
};
