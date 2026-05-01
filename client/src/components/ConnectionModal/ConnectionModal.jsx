import React, { useState, useEffect } from 'react';
import { Database, Server, User, Lock, Hash, AlertCircle, CheckCircle2, Bookmark, Trash2, Plus } from 'lucide-react';
import { useConnectionStore } from '../../store/connectionStore';
import { useQueryStore } from '../../store/queryStore';
import { useAuthStore } from '../../store/authStore';
import './ConnectionModal.css';

export default function ConnectionModal({ onClose }) {
  const { connect, connectSaved, isConnecting, error } = useConnectionStore();
  const { loadSchema } = useQueryStore();
  const { savedConnections, fetchSavedConnections, saveConnection, deleteConnection } = useAuthStore();

  const [activeTab, setActiveTab] = useState('saved'); // 'saved' | 'new'

  const [form, setForm] = useState({
    name:     '',
    host:     'localhost',
    port:     '3306',
    user:     '',
    password: '',
    database: '',
  });

  const [saveCheck, setSaveCheck] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    fetchSavedConnections();
  }, [fetchSavedConnections]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNewSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    try {
      if (saveCheck) {
        if (!form.name) {
          setLocalError('Please provide a name for this saved connection.');
          return;
        }
        const saveRes = await saveConnection(form);
        if (!saveRes.success) {
          setLocalError(saveRes.error);
          return;
        }
      }
      
      await connect(form);
      await loadSchema();
      onClose();
    } catch {
      // Global error shown via store
    }
  };

  const handleConnectSaved = async (connectionId) => {
    setLocalError(null);
    try {
      await connectSaved(connectionId);
      await loadSchema();
      onClose();
    } catch {
      // Global error shown via store
    }
  };

  return (
    <div className="overlay-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal connection-modal">
        {/* Header */}
        <div className="modal-header">
          <div className="conn-icon">
            <Database size={20} />
          </div>
          <div>
            <div className="modal-title">Connect to MySQL</div>
            <p className="modal-subtitle">Choose a saved connection or enter credentials</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="conn-tabs">
          <button 
            className={`conn-tab ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => setActiveTab('saved')}
            type="button"
          >
            Saved Connections
          </button>
          <button 
            className={`conn-tab ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
            type="button"
          >
            New Connection
          </button>
        </div>

        {(error || localError) && (
          <div className="conn-error">
            <AlertCircle size={14} />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Saved Connections Tab */}
        {activeTab === 'saved' && (
          <div className="saved-connections-tab">
            {savedConnections.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Bookmark size={28} color="#8b5cf6" />
                </div>
                <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>No saved connections</h3>
                <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Save your database credentials to connect with one click next time.
                </p>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => setActiveTab('new')}
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '8px' }}
                >
                  <Plus size={16} style={{ marginRight: 6 }} />
                  Create New Connection
                </button>
              </div>
            ) : (
              <div className="saved-list">
                {savedConnections.map(conn => (
                  <div key={conn.id} className="saved-card">
                    <div className="saved-info" onClick={() => handleConnectSaved(conn.id)}>
                      <div className="saved-name">{conn.name}</div>
                      <div className="saved-details">
                        {conn.username}@{conn.host}:{conn.port} — {conn.database_name}
                      </div>
                    </div>
                    <button 
                      className="btn btn-ghost btn-icon" 
                      onClick={() => deleteConnection(conn.id)}
                      title="Delete connection"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="modal-footer" style={{ marginTop: 24 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* New Connection Tab */}
        {activeTab === 'new' && (
          <form onSubmit={handleNewSubmit} autoComplete="off">
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>
                <Bookmark size={12} style={{ marginRight: 4, display: 'inline' }} />
                Connection Name (optional)
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Production Database"
                autoComplete="off"
              />
            </div>

            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>
                  <Server size={12} style={{ marginRight: 4, display: 'inline' }} />
                  Host
                </label>
                <input
                  name="host"
                  value={form.host}
                  onChange={handleChange}
                  placeholder="localhost"
                  autoComplete="off"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>
                  <Hash size={12} style={{ marginRight: 4, display: 'inline' }} />
                  Port
                </label>
                <input
                  name="port"
                  type="number"
                  value={form.port}
                  onChange={handleChange}
                  placeholder="3306"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>
                <User size={12} style={{ marginRight: 4, display: 'inline' }} />
                Username
              </label>
              <input
                name="user"
                value={form.user}
                onChange={handleChange}
                placeholder="root"
                required
                autoComplete="new-password"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>
                <Lock size={12} style={{ marginRight: 4, display: 'inline' }} />
                Password
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>
                <Database size={12} style={{ marginRight: 4, display: 'inline' }} />
                Database
              </label>
              <input
                name="database"
                value={form.database}
                onChange={handleChange}
                placeholder="my_database"
                required
                autoComplete="off"
              />
            </div>

            <label className={`custom-checkbox-container ${saveCheck ? 'checked' : ''}`}>
              <input 
                type="checkbox" 
                className="custom-checkbox-input"
                checked={saveCheck}
                onChange={(e) => setSaveCheck(e.target.checked)}
              />
              <div className="custom-checkbox-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="custom-checkbox-label">
                Save this connection for future use
              </span>
            </label>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isConnecting || !form.user || !form.database}
              >
                {isConnecting ? (
                  <><span className="spinner" /> Connecting…</>
                ) : (
                  <><CheckCircle2 size={14} /> Connect</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
