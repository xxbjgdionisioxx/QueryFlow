import React, { useState, useEffect } from 'react';
import {
  Database, Play, Plug, PlugZap, ChevronDown,
  Filter, BarChart2, Code2, Table2, Trash2, RotateCcw, PanelLeft, PanelLeftClose, Layout
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Sidebar         from '../../components/Sidebar/Sidebar';
import Canvas          from '../../components/Canvas/Canvas';
import CompatibilityBar from '../../components/CompatibilityBar/CompatibilityBar';
import ConnectionModal  from '../../components/ConnectionModal/ConnectionModal';
import FilterBuilder    from '../../components/FilterBuilder/FilterBuilder';
import AggregationPanel from '../../components/AggregationPanel/AggregationPanel';
import SQLPreview       from '../../components/SQLPreview/SQLPreview';
import ResultsPanel     from '../../components/ResultsPanel/ResultsPanel';
import AiAssistant      from '../../components/AiAssistant/AiAssistant';

import { useConnectionStore } from '../../store/connectionStore';
import { useQueryStore }      from '../../store/queryStore';
import { useAuthStore }       from '../../store/authStore';
import '../../App.css';

const BOTTOM_TABS = [
  { id: 'filters',    label: 'Filters',     icon: Filter },
  { id: 'aggregation', label: 'Aggregation', icon: BarChart2 },
  { id: 'sql',        label: 'SQL',          icon: Code2 },
  { id: 'results',    label: 'Results',      icon: Table2 },
];

export default function Builder() {
  const { isConnected, database, versionString, disconnect } = useConnectionStore();
  const { executeQuery, resetCanvas, isExecuting, nodes } = useQueryStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [showConnModal, setShowConnModal] = useState(!isConnected);
  const [activeTab, setActiveTab] = useState('sql');
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Show connection modal on first load if not connected
  useEffect(() => {
    if (!isConnected) setShowConnModal(true);
  }, [isConnected]);

  const canExecute = isConnected && nodes.length > 0 && !isExecuting;

  const handleExecute = async () => {
    setActiveTab('results');
    if (!bottomPanelOpen) setBottomPanelOpen(true);
    await executeQuery(1, 100);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* ── Connection modal ──────────────────────────── */}
      {showConnModal && (
        <ConnectionModal onClose={() => setShowConnModal(false)} />
      )}

      <div className={`app-layout ${!sidebarOpen ? 'sidebar-closed' : ''}`}>
        {/* ── Header ───────────────────────────────────── */}
        <header className="app-header">
          <div className="app-logo">
            <div className="app-logo-icon">
              <Database size={18} />
            </div>
            <span className="app-logo-text">QueryFlow</span>
          </div>

          <div className="app-header-sep" />

          {/* Connection status */}
          {isConnected ? (
            <div className="conn-status connected">
              <PlugZap size={13} />
              <span className="conn-db">{database}</span>
              <span className="conn-version">{versionString}</span>
              <button
                id="header-disconnect-btn"
                className="btn btn-ghost btn-sm"
                onClick={() => { disconnect(); setShowConnModal(false); }}
              >
                Disconnect
              </button>
              <div className="app-header-sep" />
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/designer')}>
                <Layout size={13} /> Designer
              </button>
            </div>
          ) : (
            <button
              id="header-connect-btn"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowConnModal(true)}
            >
              <Plug size={13} />
              Connect
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* User profile / Logout */}
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-email-header">{user?.email}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ marginLeft: '0.5rem' }}>
              Logout
            </button>
          </div>

          {/* Reset canvas */}
          {nodes.length > 0 && (
            <button
              id="header-reset-btn"
              className="btn btn-ghost btn-sm"
              onClick={resetCanvas}
              title="Reset canvas"
              style={{ marginLeft: '1rem' }}
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}

          {/* Run query */}
          <button
            id="header-run-btn"
            className="btn btn-primary"
            onClick={handleExecute}
            disabled={!canExecute}
            style={{ marginLeft: '1rem' }}
          >
            {isExecuting
              ? <><span className="spinner" /> Running…</>
              : <><Play size={14} fill="currentColor" /> Run Query</>
            }
          </button>
        </header>

        {/* ── Sidebar ───────────────────────────────────── */}
        {isConnected ? (
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        ) : (
          <aside className="app-sidebar app-sidebar--empty">
            <div className="sidebar-connect-prompt">
              <Database size={28} opacity={0.3} />
              <span>Connect to a database<br />to view its schema</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowConnModal(true)}>
                Connect
              </button>
            </div>
          </aside>
        )}

        {/* ── Main area ────────────────────────────────── */}
        <main className="app-main">
          {/* Compatibility bar */}
          {isConnected && <CompatibilityBar />}

          {/* Canvas — takes remaining space above bottom panel */}
          <div className="canvas-area" style={{ flex: 1 }}>
            <Canvas />
          </div>

          {/* ── Bottom panel ───────────────────────────── */}
          <div className={`bottom-panel ${bottomPanelOpen ? 'open' : ''}`}>
            {/* Tab bar */}
            <div className="bottom-tabs">
              {BOTTOM_TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  id={`tab-${id}-btn`}
                  className={`bottom-tab ${activeTab === id ? 'active' : ''}`}
                  onClick={() => {
                    if (activeTab === id && bottomPanelOpen) {
                      setBottomPanelOpen(false);
                    } else {
                      setActiveTab(id);
                      setBottomPanelOpen(true);
                    }
                  }}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
              <button
                className="bottom-panel-toggle btn btn-ghost btn-icon btn-sm"
                onClick={() => setBottomPanelOpen((o) => !o)}
                title={bottomPanelOpen ? 'Collapse' : 'Expand'}
              >
                <ChevronDown size={14} className={bottomPanelOpen ? '' : 'flip'} />
              </button>
            </div>

            {/* Tab content */}
            {bottomPanelOpen && (
              <div className="bottom-panel-content">
                {activeTab === 'filters'     && <FilterBuilder />}
                {activeTab === 'aggregation' && <AggregationPanel />}
                {activeTab === 'sql'         && <SQLPreview />}
                {activeTab === 'results'     && <ResultsPanel />}
              </div>
            )}
          </div>
        </main>
        <AiAssistant />
      </div>
    </>
  );
}
