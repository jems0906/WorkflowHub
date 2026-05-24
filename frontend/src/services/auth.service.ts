import api from './api';
import type { AuthResponse, User } from '../types';

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem('wh_token', data.token);
    localStorage.setItem('wh_user', JSON.stringify(data.user));
    return data;
  },

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', { name, email, password });
    localStorage.setItem('wh_token', data.token);
    localStorage.setItem('wh_user', JSON.stringify(data.user));
    return data;
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  logout() {
    localStorage.removeItem('wh_token');
    localStorage.removeItem('wh_user');
  },

  getStoredUser(): User | null {
    try {
      const raw = localStorage.getItem('wh_user');
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('wh_token');
  },
};
