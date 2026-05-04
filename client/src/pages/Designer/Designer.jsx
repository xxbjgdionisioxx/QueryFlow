import React, { useState, useEffect } from 'react';
import {
  Database, Save, Play, Plus, Layout, 
  RotateCcw, Download, Code2, Check, AlertCircle, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Sidebar         from '../../components/Sidebar/Sidebar';
import DesignerCanvas  from '../../components/DesignerCanvas/DesignerCanvas';
import ConnectionModal from '../../components/ConnectionModal/ConnectionModal';
import ImportSQLModal  from '../../components/DesignerCanvas/ImportSQLModal';

import { useConnectionStore } from '../../store/connectionStore';
import { useDesignerStore }   from '../../store/designerStore';
import { useAuthStore }       from '../../store/authStore';
import { useQueryStore }      from '../../store/queryStore';

import '../../App.css';

export default function Designer() {
  const { isConnected, database, versionString, disconnect } = useConnectionStore();
  const { schema, loadSchema } = useQueryStore();
  const { 
    nodes, edges, loadLayout, saveLayout, 
    generateSQL, executeSQL, addTable, isLoading, error 
  } = useDesignerStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [showConnModal, setShowConnModal] = useState(!isConnected);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [generatedSql, setGeneratedSql] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Initial load
  useEffect(() => {
    if (isConnected) {
      loadSchema().then(() => {
        // useQueryStore schema is updated
      });
    } else {
      setShowConnModal(true);
    }
  }, [isConnected]);

  // Load layout once schema is available
  useEffect(() => {
    if (schema.length > 0) {
      loadLayout(schema);
    }
  }, [schema]);

  const handleApply = async () => {
    const sql = generateSQL();
    const success = await executeSQL(sql);
    if (success) {
      setSuccessMessage('Schema applied successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadSchema(); // Refresh schema
    }
  };

  const handlePreview = () => {
    setGeneratedSql(generateSQL());
    setShowSqlPreview(true);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {showConnModal && (
        <ConnectionModal onClose={() => setShowConnModal(false)} />
      )}

      <div className={`app-layout ${!sidebarOpen ? 'sidebar-closed' : ''}`}>
        <header className="app-header">
          <div className="app-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="app-logo-icon">
              <Database size={18} />
            </div>
            <span className="app-logo-text">QueryFlow <small style={{ fontSize: '0.6rem', opacity: 0.5 }}>DESIGNER</small></span>
          </div>

          <div className="app-header-sep" />

          {isConnected && (
            <div className="conn-status connected">
              <Layout size={13} />
              <span className="conn-db">{database}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/builder')}>
                Query Builder
              </button>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* User profile */}
          <div className="user-profile">
            <span className="user-name">{user?.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ marginLeft: '0.5rem' }}>
              Logout
            </button>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={saveLayout} title="Save visual layout">
            <Save size={14} /> Save Layout
          </button>

          <button className="btn btn-ghost btn-sm" onClick={() => setShowImportModal(true)} title="Import design from SQL query">
            <Download size={14} /> Import SQL
          </button>

          <button className="btn btn-ghost btn-sm" onClick={() => reverseEngineer(schema)} title="Re-organize tables in a grid">
            <RotateCcw size={14} /> Auto-Layout
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handlePreview} style={{ marginLeft: '0.5rem' }}>
            <Code2 size={14} /> Preview SQL
          </button>

          <button 
            className="btn btn-primary" 
            onClick={handleApply} 
            disabled={isLoading || nodes.length === 0}
            style={{ marginLeft: '0.5rem' }}
          >
            {isLoading ? <span className="spinner" /> : <Play size={14} fill="currentColor" />} Apply Changes
          </button>
        </header>

        {isConnected ? (
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        ) : (
          <aside className="app-sidebar app-sidebar--empty">
            <div className="sidebar-connect-prompt">
              <span>Connect to a database</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowConnModal(true)}>Connect</button>
            </div>
          </aside>
        )}

        <main className="app-main">
          <div className="canvas-area" style={{ flex: 1 }}>
            <DesignerCanvas />
            
            {/* Toolbar overlay */}
            <div className="designer-overlay-toolbar">
              <button className="btn btn-glass btn-sm" onClick={() => addTable('new_table')}>
                <Plus size={14} /> New Table
              </button>
            </div>

            {/* Messages */}
            {successMessage && (
              <div className="status-toast success">
                <Check size={16} /> {successMessage}
              </div>
            )}
            {error && (
              <div className="status-toast error">
                <AlertCircle size={16} /> {error}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* SQL Preview Modal */}
      {showSqlPreview && (
        <div className="modal-overlay">
          <div className="modal-content sql-preview-modal">
            <div className="modal-header">
              <h3>Generated SQL</h3>
              <button className="btn-icon" onClick={() => setShowSqlPreview(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <pre className="sql-code-block">
                <code>{generatedSql}</code>
              </pre>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowSqlPreview(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                navigator.clipboard.writeText(generatedSql);
                setSuccessMessage('SQL copied to clipboard!');
                setTimeout(() => setSuccessMessage(''), 2000);
              }}>Copy to Clipboard</button>
            </div>
          </div>
        </div>
      )}
      {/* Import SQL Modal */}
      {showImportModal && (
        <ImportSQLModal onClose={() => setShowImportModal(false)} />
      )}
    </>
  );
}
