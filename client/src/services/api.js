/**
 * api.js — Axios client with session credentials and error normalization
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,  // Send session cookie
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor — normalize errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Surface the backend error message if available
    const serverMessage = error.response?.data?.error;
    if (serverMessage) {
      error.message = serverMessage;
    }
    return Promise.reject(error);
  }
);

export default api;
