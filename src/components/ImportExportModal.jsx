import { useState, useRef } from 'react';
import { useImportExport } from '../hooks/useImportExport';
import { importFromJSON } from '../utils/dataImporter';
import './ImportExportModal.css';

export default function ImportExportModal({ tasks, onImport, onClose }) {
  const [mode, setMode] = useState('menu'); // menu | preview | importing | notion | notion-linear
  const [parsedTasks, setParsedTasks] = useState([]);
  const [fileType, setFileType] = useState('');
  const [error, setError] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [notionToken, setNotionToken] = useState('');
  const [notionLoading, setNotionLoading] = useState(false);
  const [nlJsonInput, setNlJsonInput] = useState('');
  const [nlPreview, setNlPreview] = useState(null);
  const fileInputRef = useRef();
  const { exportJSON, exportCSV, exportICal, exportEPUB, parseFile, importFromNotion } = useImportExport(tasks);

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

  const handleNotionImport = async () => {
    if (!notionDbId.trim() || !notionToken.trim()) {
      setError('请填写 Notion Database ID 和 API Token');
      return;
    }
    setNotionLoading(true);
    setError('');
    try {
      const notionTasks = await importFromNotion(notionDbId.trim(), notionToken.trim());
      setParsedTasks(notionTasks);
      setFileType('notion');
      setMode('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setNotionLoading(false);
    }
  };

  const handleNotionLinearImport = () => {
    setError('');
    setNlPreview(null);
    if (!nlJsonInput.trim()) {
      setError('请粘贴 Notion CSV 或 Linear JSON 数据');
      return;
    }
    importFromJSON(nlJsonInput)
      .then((result) => {
        setParsedTasks(result.tasks);
        setFileType(result.format === 'notion-csv' ? 'Notion CSV' : 'Linear JSON');
        setNlPreview(result);
        setMode('notion-linear-preview');
      })
      .catch((err) => {
        setError(err.message);
      });
  };

  const handleNlImportMerge = () => {
    const merged = [...tasks, ...parsedTasks];
    onImport(merged);
    onClose();
  };

  const handleNlImportReplace = () => {
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
              <h4>Notion 导入</h4>
              <p className="ie-desc">从 Notion Database 导入任务（需要 Notion API Integration Token）</p>
              <div className="notion-fields">
                <div className="notion-field">
                  <label>Database ID</label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={notionDbId}
                    onChange={(e) => setNotionDbId(e.target.value)}
                  />
                </div>
                <div className="notion-field">
                  <label>Integration Token</label>
                  <input
                    type="password"
                    placeholder="secret_xxxxxxxxxxxx"
                    value={notionToken}
                    onChange={(e) => setNotionToken(e.target.value)}
                  />
                </div>
                {error && <p className="ie-error">{error}</p>}
                <button className="ie-btn primary" onClick={handleNotionImport} disabled={notionLoading}>
                  {notionLoading ? '导入中...' : '🔗 从 Notion 导入'}
                </button>
              </div>
            </div>

            <div className="ie-divider" />

            <div className="ie-section">
              <h4>📋 Notion / Linear 导入</h4>
              <p className="ie-desc">粘贴 Notion CSV 导出或 Linear JSON 数据</p>
              <div className="nl-fields">
                <textarea
                  placeholder="在此粘贴 Notion CSV 或 Linear JSON 数据..."
                  value={nlJsonInput}
                  onChange={(e) => setNlJsonInput(e.target.value)}
                  rows={5}
                />
                {error && <p className="ie-error">{error}</p>}
                <button className="ie-btn primary" onClick={handleNotionLinearImport}>
                  🔍 解析数据
                </button>
              </div>
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

        {mode === 'notion-linear-preview' && (
          <div className="ie-preview">
            <h4>导入预览</h4>
            <p>文件类型：<strong>{fileType}</strong></p>
            <p>将导入 <strong>{parsedTasks.length}</strong> 个任务：</p>
            <ul className="ie-preview-list">
              {parsedTasks.slice(0, 5).map((t, i) => (
                <li key={i}>
                  <span className={`ie-priority ${t.priority}`}>{t.priority}</span>
                  {t.title}
                  {t.dueDate && <span className="ie-tags"> 📅 {t.dueDate}</span>}
                  {t.tags.length > 0 && <span className="ie-tags"> {t.tags.join(', ')}</span>}
                </li>
              ))}
              {parsedTasks.length > 5 && <li>... 还有 {parsedTasks.length - 5} 项</li>}
            </ul>

            {error && <p className="ie-error">{error}</p>}

            <div className="ie-actions">
              <button className="btn-cancel" onClick={() => setMode('menu')}>取消</button>
              <button className="ie-btn" onClick={handleNlImportMerge}>🔗 合并（追加）</button>
              <button className="ie-btn danger" onClick={handleNlImportReplace}>🔄 覆盖（清空后导入）</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
