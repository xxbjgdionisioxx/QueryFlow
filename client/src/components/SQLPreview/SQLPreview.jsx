/**
 * SQLPreview.jsx — Live SQL preview with syntax highlighting and export
 *
 * Builds the SQL preview in real time from the current query store state
 * using the same buildQueryDef() logic as execution, then calls
 * a local (client-side) SQL formatter for display.
 */

import React, { useEffect, useState } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Copy, Download, Check } from 'lucide-react';
import { useQueryStore } from '../../store/queryStore';
import { buildClientSQL } from '../../utils/clientSqlBuilder';
import './SQLPreview.css';

SyntaxHighlighter.registerLanguage('sql', sql);

export default function SQLPreview() {
  const { buildQueryDef, generatedSql } = useQueryStore();
  const [copied, setCopied] = useState(false);

  // Build a live preview SQL from current canvas state
  const queryDef = buildQueryDef();
  const previewSql = generatedSql || (queryDef ? buildClientSQL(queryDef) : '-- Drag tables to the canvas to start');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(previewSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([previewSql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sql-preview">
      <div className="sql-preview-toolbar">
        <span className="sql-preview-label">SQL Preview</span>
        <div className="sql-preview-actions">
          <button
            id="sql-copy-btn"
            className="btn btn-ghost btn-sm"
            onClick={handleCopy}
            disabled={!previewSql || previewSql.startsWith('--')}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            id="sql-export-btn"
            className="btn btn-ghost btn-sm"
            onClick={handleExport}
            disabled={!previewSql || previewSql.startsWith('--')}
          >
            <Download size={12} />
            Export .sql
          </button>
        </div>
      </div>

      <div className="sql-preview-body">
        <SyntaxHighlighter
          language="sql"
          style={atomOneDark}
          customStyle={{
            background: 'transparent',
            margin: 0,
            padding: '12px 16px',
            fontSize: '12px',
            lineHeight: '1.7',
            fontFamily: 'var(--font-mono)',
            flex: 1,
          }}
          showLineNumbers
          lineNumberStyle={{ color: 'rgba(255,255,255,0.2)', minWidth: '2em' }}
          wrapLongLines
        >
          {previewSql}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
