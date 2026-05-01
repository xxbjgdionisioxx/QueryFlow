/**
 * ResultsPanel.jsx — Paginated query results table
 */

import React from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { useQueryStore } from '../../store/queryStore';
import './ResultsPanel.css';

export default function ResultsPanel() {
  const {
    results, resultColumns, pagination,
    isExecuting, executeError, executeQuery,
  } = useQueryStore();

  const { page = 1, pageSize = 100, totalRows, totalPages } = pagination;

  const goToPage = (p) => executeQuery(p, pageSize);

  if (isExecuting) {
    return (
      <div className="results-panel results-loading">
        <Loader2 size={20} className="spin" />
        <span>Executing query…</span>
      </div>
    );
  }

  if (executeError) {
    return (
      <div className="results-panel results-error">
        <AlertCircle size={16} />
        <div>
          <strong>Query Error</strong>
          <p>{executeError}</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="results-panel results-empty">
        Execute a query to see results here
      </div>
    );
  }

  return (
    <div className="results-panel">
      {/* Meta bar */}
      <div className="results-meta">
        <span className="results-count">
          {totalRows != null
            ? `${totalRows.toLocaleString()} row${totalRows !== 1 ? 's' : ''}`
            : `${results.length} row${results.length !== 1 ? 's' : ''} (page ${page})`}
        </span>
        {totalRows != null && (
          <span className="results-page-info">
            Page {page} of {totalPages ?? '?'}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="results-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {resultColumns.map((col) => (
                <th key={col.name}>{col.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row, ri) => (
              <tr key={ri}>
                {resultColumns.map((col) => (
                  <td key={col.name} title={String(row[col.name] ?? '')}>
                    {row[col.name] === null
                      ? <span className="null-value">NULL</span>
                      : String(row[col.name])
                    }
                  </td>
                ))}
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={resultColumns.length || 1} className="results-no-rows">
                  No rows returned
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-ghost btn-sm"
            id="results-prev-btn"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="pagination-info">Page {page} / {totalPages}</span>
          <button
            className="btn btn-ghost btn-sm"
            id="results-next-btn"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
