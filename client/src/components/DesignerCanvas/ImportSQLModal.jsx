import React, { useState } from 'react';
import { X, FileCode2, Play } from 'lucide-react';
import { useDesignerStore } from '../../store/designerStore';
import { useQueryStore } from '../../store/queryStore';

export default function ImportSQLModal({ onClose }) {
  const [sql, setSql] = useState('');
  const { importFromSQL } = useDesignerStore();
  const { schema } = useQueryStore();

  const handleImport = () => {
    if (!sql.trim()) return;
    const success = importFromSQL(sql, schema);
    if (success) {
      onClose();
    } else {
      alert('Could not find any tables or joins in the provided SQL.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content sql-preview-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCode2 size={20} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>Import Design from SQL Query</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="modal-body">
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
            Paste a SELECT query with JOINs below. The designer will automatically identify the tables and their connections based on the ON conditions.
          </p>
          <textarea
            className="sql-code-block"
            style={{ width: '100%', minHeight: '300px', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', resize: 'vertical' }}
            placeholder="SELECT ... FROM table1 JOIN table2 ON table1.id = table2.table1_id ..."
            value={sql}
            onChange={(e) => setSql(e.target.value)}
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleImport}>
            <Play size={14} /> Import to Designer
          </button>
        </div>
      </div>
    </div>
  );
}
