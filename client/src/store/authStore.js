import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isAuthLoading: true,
  savedConnections: [],

  // ── Authentication ─────────────────────────────────────────────────────────

  checkAuth: async () => {
    try {
      set({ isAuthLoading: true });
      const { data } = await api.get('/auth/me');
      set({ 
        user: data.user, 
        isAuthenticated: true, 
        isAuthLoading: false 
      });
      return data;
    } catch (err) {
      set({ user: null, isAuthenticated: false, isAuthLoading: false });
      return null;
    }
  },

  login: async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      set({ user: data, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  },

  signup: async (email, password) => {
    try {
      const { data } = await api.post('/auth/signup', { email, password });
      set({ user: data, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Signup failed' };
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
      set({ user: null, isAuthenticated: false, savedConnections: [] });
    } catch (err) {
      console.error('Logout failed', err);
    }
  },

  // ── Saved Connections ──────────────────────────────────────────────────────

  fetchSavedConnections: async () => {
    try {
      const { data } = await api.get('/connections');
      set({ savedConnections: data.connections });
    } catch (err) {
      console.error('Failed to fetch connections', err);
    }
  },

  saveConnection: async (payload) => {
    try {
      await api.post('/connections', payload);
      await get().fetchSavedConnections();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to save connection' };
    }
  },

  deleteConnection: async (id) => {
    try {
      await api.delete(`/connections/${id}`);
      await get().fetchSavedConnections();
    } catch (err) {
      console.error('Failed to delete connection', err);
    }
  }
}));
