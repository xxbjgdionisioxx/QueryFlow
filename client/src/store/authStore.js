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
        user: { ...data.user, name: data.user.name || data.user.email }, 
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
      set({ 
        user: { ...data, name: data.name || data.email }, 
        isAuthenticated: true 
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  },

  signup: async (email, password, name) => {
    try {
      await api.post('/auth/signup', { email, password, name });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Signup failed' };
    }
  },

  forgotPassword: async (email) => {
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to request reset' };
    }
  },

  resetPassword: async (email, otp, newPassword) => {
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Reset failed' };
    }
  },

  verifyOtp: async (email, otp) => {
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp });
      set({ user: { id: data.id, email }, isAuthenticated: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Verification failed' };
    }
  },

  resendOtp: async (email) => {
    try {
      await api.post('/auth/resend-otp', { email });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to resend OTP' };
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
