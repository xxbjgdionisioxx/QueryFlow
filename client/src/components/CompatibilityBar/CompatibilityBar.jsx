/**
 * CompatibilityBar.jsx — MySQL version mode selector + warning chip display
 *
 * Shows: detected version, manual tier override dropdown, and any
 * version-specific warnings produced by the last query execution.
 */

import React from 'react';
import { AlertTriangle, Cpu, ChevronDown } from 'lucide-react';
import { useConnectionStore } from '../../store/connectionStore';
import { useQueryStore } from '../../store/queryStore';
import './CompatibilityBar.css';

const TIERS = ['Auto', '5.6', '5.7', '8.0+'];

export default function CompatibilityBar() {
  const { versionString, compat, overrideTier, setOverrideTier } = useConnectionStore();
  const { sqlWarnings } = useQueryStore();

  const effectiveTier = overrideTier && overrideTier !== 'Auto'
    ? overrideTier
    : compat?.tier;

  const tierClass = {
    '5.6':  'tier-56',
    '5.7':  'tier-57',
    '8.0+': 'tier-80',
  }[effectiveTier] ?? 'tier-auto';

  return (
    <div className="compat-bar">
      {/* Version info */}
      <div className="compat-version">
        <Cpu size={13} />
        <span className="compat-version-string">{versionString || '—'}</span>
        {effectiveTier && (
          <span className={`badge compat-tier ${tierClass}`}>{effectiveTier}</span>
        )}
      </div>

      {/* Mode selector */}
      <div className="compat-mode">
        <span className="compat-mode-label">Compatibility:</span>
        <div className="compat-select-wrap">
          <select
            id="compat-mode-select"
            value={overrideTier || 'Auto'}
            onChange={(e) => setOverrideTier(e.target.value === 'Auto' ? null : e.target.value)}
            className="compat-select"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>{t === 'Auto' ? 'Auto-detect' : `MySQL ${t}`}</option>
            ))}
          </select>
          <ChevronDown size={12} className="compat-select-icon" />
        </div>
      </div>

      {/* Feature flags */}
      {compat && (
        <div className="compat-flags">
          <CompatFlag label="CTEs"     enabled={compat.ctes}            />
          <CompatFlag label="Window"   enabled={compat.windowFunctions} />
          <CompatFlag label="JSON"     enabled={compat.jsonFunctions}   partial={compat.jsonFunctionsPartial} />
          <CompatFlag label="Strict GB" enabled={compat.onlyFullGroupBy} />
        </div>
      )}

      {/* Warnings from last execution */}
      {sqlWarnings.length > 0 && (
        <div className="compat-warnings">
          <AlertTriangle size={12} />
          <span>{sqlWarnings.length} warning{sqlWarnings.length > 1 ? 's' : ''}</span>
          <div className="compat-warning-list">
            {sqlWarnings.map((w, i) => (
              <div key={i} className="compat-warning-item">{w}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompatFlag({ label, enabled, partial }) {
  const cls = partial ? 'flag-partial' : enabled ? 'flag-on' : 'flag-off';
  return (
    <span className={`compat-flag ${cls}`} data-tooltip={partial ? 'Partial support' : enabled ? 'Supported' : 'Not supported'}>
      {label}
    </span>
  );
}
