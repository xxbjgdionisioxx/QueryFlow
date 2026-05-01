/**
 * ResultsPanel.jsx — Paginated query results table
 */

import React from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Loader2, Download, FileJson, FileText, FileSpreadsheet, FileCode } from 'lucide-react';
import { useQueryStore } from '../../store/queryStore';
import './ResultsPanel.css';

export default function ResultsPanel() {
  const {
    results, resultColumns, pagination,
    isExecuting, executeError, executeQuery,
  } = useQueryStore();

  const { page = 1, pageSize = 100, totalRows, totalPages } = pagination;

  const goToPage = (p) => executeQuery(p, pageSize);

  const exportData = (format) => {
    if (!results || results.length === 0) return;

    let content = '';
    let fileName = `query_export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}`;
    let mimeType = '';

    switch (format) {
      case 'csv':
        const headers = resultColumns.map(col => col.name).join(',');
        const csvRows = results.map(row => 
          resultColumns.map(col => {
            let val = row[col.name];
            if (val === null) return 'NULL';
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
          }).join(',')
        );
        content = [headers, ...csvRows].join('\n');
        fileName += '.csv';
        mimeType = 'text/csv;charset=utf-8;';
        break;

      case 'json':
        content = JSON.stringify(results, null, 2);
        fileName += '.json';
        mimeType = 'application/json;charset=utf-8;';
        break;

      case 'txt':
        const columnWidths = resultColumns.map(col => {
          const maxLen = Math.max(
            col.name.length,
            ...results.map(r => String(r[col.name] ?? 'NULL').length)
          );
          return maxLen + 2;
        });
        
        const headerRow = resultColumns.map((col, i) => col.name.padEnd(columnWidths[i])).join('|');
        const separator = columnWidths.map(w => '-'.repeat(w)).join('+');
        const dataRows = results.map(row => 
          resultColumns.map((col, i) => String(row[col.name] ?? 'NULL').padEnd(columnWidths[i])).join('|')
        );
        content = [headerRow, separator, ...dataRows].join('\n');
        fileName += '.txt';
        mimeType = 'text/plain;charset=utf-8;';
        break;

      case 'excel':
        let xml = '<?xml version="1.0"?><ss:Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
        xml += '<ss:Worksheet ss:Name="Sheet1"><ss:Table>';
        xml += '<ss:Row>';
        resultColumns.forEach(col => {
          xml += `<ss:Cell><ss:Data ss:Type="String">${col.name}</ss:Data></ss:Cell>`;
        });
        xml += '</ss:Row>';
        results.forEach(row => {
          xml += '<ss:Row>';
          resultColumns.forEach(col => {
            const val = row[col.name];
            const type = typeof val === 'number' ? 'Number' : 'String';
            xml += `<ss:Cell><ss:Data ss:Type="${type}">${val === null ? 'NULL' : val}</ss:Data></ss:Cell>`;
          });
          xml += '</ss:Row>';
        });
        xml += '</ss:Table></ss:Worksheet></ss:Workbook>';
        content = xml;
        fileName += '.xls';
        mimeType = 'application/vnd.ms-excel';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        <div className="results-meta-left">
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

        <div className="results-export">
          <span className="export-label">Export:</span>
          <button className="btn btn-ghost btn-icon btn-xs" onClick={() => exportData('csv')} title="Export as CSV">
            <FileCode size={14} />
            <span>CSV</span>
          </button>
          <button className="btn btn-ghost btn-icon btn-xs" onClick={() => exportData('excel')} title="Export as Excel">
            <FileSpreadsheet size={14} />
            <span>Excel</span>
          </button>
          <button className="btn btn-ghost btn-icon btn-xs" onClick={() => exportData('json')} title="Export as JSON">
            <FileJson size={14} />
            <span>JSON</span>
          </button>
          <button className="btn btn-ghost btn-icon btn-xs" onClick={() => exportData('txt')} title="Export as TXT">
            <FileText size={14} />
            <span>TXT</span>
          </button>
        </div>
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
