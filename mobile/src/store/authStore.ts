import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../api/auth';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;

  setAuth: (accessToken: string, refreshToken: string, user: User) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  hydrate: () => Promise<void>;
}

const AUTH_KEY = 'auth_store';

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: true,

  setAuth: (accessToken, refreshToken, user) => {
    const payload = JSON.stringify({ accessToken, refreshToken, user });
    AsyncStorage.setItem(AUTH_KEY, payload);
    set({ accessToken, refreshToken, user, isAuthenticated: true, isAdmin: user.role === 'admin' });
  },

  setAccessToken: (token) => {
    set({ accessToken: token });
  },

  clearAuth: () => {
    AsyncStorage.removeItem(AUTH_KEY);
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, isAdmin: false });
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTH_KEY);
      if (raw) {
        const { accessToken, refreshToken, user } = JSON.parse(raw);
        set({ accessToken, refreshToken, user, isAuthenticated: !!accessToken, isAdmin: user?.role === 'admin', isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
