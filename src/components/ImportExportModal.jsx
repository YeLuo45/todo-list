import { useState, useRef } from 'react';
import { useImportExport } from '../hooks/useImportExport';
import './ImportExportModal.css';

export default function ImportExportModal({ tasks, onImport, onClose }) {
  const [mode, setMode] = useState('menu'); // menu | preview | importing
  const [parsedTasks, setParsedTasks] = useState([]);
  const [fileType, setFileType] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef();
  const { exportJSON, exportCSV, exportICal, exportEPUB, parseFile } = useImportExport(tasks);

  const handleExportJSON = () => {
    exportJSON();
    onClose();
  };

  const handleExportCSV = () => {
    exportCSV();
    onClose();
  };

  const handleExportICal = () => {
    exportICal();
    onClose();
  };

  const handleExportEPUB = async () => {
    await exportEPUB();
    onClose();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');

    try {
      const result = await parseFile(file);
      setParsedTasks(result.tasks);
      setFileType(result.type);
      setMode('preview');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImportMerge = () => {
    const merged = [...tasks, ...parsedTasks];
    onImport(merged);
    onClose();
  };

  const handleImportReplace = () => {
    onImport(parsedTasks);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content import-export-modal">
        <h3>📥 导入 / 📤 导出</h3>

        {mode === 'menu' && (
          <div className="ie-menu">
            <div className="ie-section">
              <h4>导出</h4>
              <p className="ie-desc">下载当前所有任务</p>
              <div className="ie-buttons">
                <button className="ie-btn" onClick={handleExportJSON}>📄 导出 JSON</button>
                <button className="ie-btn" onClick={handleExportCSV}>📊 导出 CSV</button>
                <button className="ie-btn" onClick={handleExportICal}>📅 导出 iCal</button>
                <button className="ie-btn" onClick={handleExportEPUB}>📚 导出 EPUB</button>
              </div>
            </div>

            <div className="ie-divider" />

            <div className="ie-section">
              <h4>导入</h4>
              <p className="ie-desc">从 CSV 或 JSON 文件导入任务</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button className="ie-btn primary" onClick={() => fileInputRef.current.click()}>
                📂 选择文件
              </button>
              {error && <p className="ie-error">{error}</p>}
            </div>

            <div className="ie-divider" />

            <div className="ie-section">
              <h4>CSV 格式说明</h4>
              <pre className="ie-format">
title,content,tags,priority,status,dueDate
任务标题,描述,工作;紧急,P0,todo,2026-05-10
              </pre>
            </div>

            <div className="ie-actions">
              <button className="btn-cancel" onClick={onClose}>关闭</button>
            </div>
          </div>
        )}

        {mode === 'preview' && (
          <div className="ie-preview">
            <h4>导入预览</h4>
            <p>文件类型：<strong>{fileType.toUpperCase()}</strong></p>
            <p>将导入 <strong>{parsedTasks.length}</strong> 个任务：</p>
            <ul className="ie-preview-list">
              {parsedTasks.slice(0, 5).map((t, i) => (
                <li key={i}>
                  <span className={`ie-priority ${t.priority}`}>{t.priority}</span>
                  {t.title}
                  {t.tags.length > 0 && <span className="ie-tags"> {t.tags.join(', ')}</span>}
                </li>
              ))}
              {parsedTasks.length > 5 && <li>... 还有 {parsedTasks.length - 5} 项</li>}
            </ul>

            {error && <p className="ie-error">{error}</p>}

            <div className="ie-actions">
              <button className="btn-cancel" onClick={() => setMode('menu')}>取消</button>
              <button className="ie-btn" onClick={handleImportMerge}>🔗 合并（追加）</button>
              <button className="ie-btn danger" onClick={handleImportReplace}>🔄 覆盖（清空后导入）</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
