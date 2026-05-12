import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  avatar_url?: string;
  storage_used: number;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;

  setAuth: (accessToken: string, refreshToken: string, user: User) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  loadFromStorage: () => void;
}

function getStored(): { accessToken: string | null; refreshToken: string | null; user: User | null } {
  try {
    const token = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return { accessToken: token, refreshToken: refresh, user };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

const stored = getStored();

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: stored.accessToken,
  refreshToken: stored.refreshToken,
  user: stored.user,
  isAuthenticated: !!stored.accessToken && !!stored.user,
  isAdmin: stored.user?.role === 'admin',

  setAuth: (accessToken, refreshToken, user) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ accessToken, refreshToken, user, isAuthenticated: true, isAdmin: user.role === 'admin' });
  },

  setAccessToken: (token) => {
    localStorage.setItem('access_token', token);
    set({ accessToken: token });
  },

  clearAuth: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, isAdmin: false });
  },

  loadFromStorage: () => {
    const s = getStored();
    set({
      accessToken: s.accessToken,
      refreshToken: s.refreshToken,
      user: s.user,
      isAuthenticated: !!s.accessToken && !!s.user,
      isAdmin: s.user?.role === 'admin',
    });
  },
}));
