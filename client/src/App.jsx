import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useConnectionStore } from './store/connectionStore';
import { useQueryStore } from './store/queryStore';

import Builder from './pages/Builder/Builder';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';

import './App.css';

export default function App() {
  const { checkAuth, isAuthenticated, isAuthLoading } = useAuthStore();
  const { rehydrateConnection } = useConnectionStore();
  const { loadSchema } = useQueryStore();

  useEffect(() => {
    const initAuth = async () => {
      const data = await checkAuth();
      if (data?.activeConnection) {
        await rehydrateConnection(data.activeConnection.database);
        await loadSchema();
      }
    };
    initAuth();
  }, [checkAuth, rehydrateConnection, loadSchema]);

  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        Loading QueryFlow...
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={isAuthenticated ? <Builder /> : <Navigate to="/login" replace />} 
      />
      <Route 
        path="/login" 
        element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} 
      />
      <Route 
        path="/signup" 
        element={!isAuthenticated ? <Signup /> : <Navigate to="/" replace />} 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
