import { useState, useRef, useEffect } from 'react';
import { useImportExport } from '../hooks/useImportExport';
import { importFromJSON } from '../utils/dataImporter';
import { exportTasksToPDF, getProjectList } from '../utils/pdfExporter';
import './ImportExportModal.css';

const TEMPLATE_KEY = 'hermes-export-templates-v2';

// 预设模板
const PRESET_TEMPLATES = [
  {
    id: 'full',
    name: '完整导出',
    description: '导出所有字段',
    fields: ['title', 'content', 'dueDate', 'priority', 'status', 'project', 'tags', 'subtasks'],
    format: 'JSON',
    groupByProject: false,
  },
  {
    id: 'simple',
    name: '简洁导出',
    description: '仅标题+截止日期+状态',
    fields: ['title', 'dueDate', 'status'],
    format: 'CSV',
    groupByProject: false,
  },
  {
    id: 'project-report',
    name: '项目报告',
    description: '按项目分组 + 进度统计',
    fields: ['title', 'dueDate', 'priority', 'status', 'project', 'tags'],
    format: 'PDF',
    groupByProject: true,
  },
];

export default function ImportExportModal({ tasks, onImport, onClose }) {
  const [mode, setMode] = useState('menu'); // menu | preview | importing | notion | notion-linear | template | pdf-export
  const [parsedTasks, setParsedTasks] = useState([]);
  const [fileType, setFileType] = useState('');
  const [error, setError] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [notionToken, setNotionToken] = useState('');
  const [notionLoading, setNotionLoading] = useState(false);
  const [nlJsonInput, setNlJsonInput] = useState('');
  const [nlPreview, setNlPreview] = useState(null);
  
  // PDF 导出相关
  const [pdfScope, setPdfScope] = useState('all');
  const [pdfProjectFilter, setPdfProjectFilter] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  
  // 模板相关
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateMode, setTemplateMode] = useState('select'); // select | create | edit
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    fields: ['title'],
    format: 'JSON',
    groupByProject: false,
  });
  
  const fileInputRef = useRef();
  const { exportJSON, exportCSV, exportICal, exportEPUB, parseFile, importFromNotion } = useImportExport(tasks);

  // 加载保存的模板
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEMPLATE_KEY);
      if (saved) {
        setTemplates(JSON.parse(saved));
      } else {
        setTemplates(PRESET_TEMPLATES);
        localStorage.setItem(TEMPLATE_KEY, JSON.stringify(PRESET_TEMPLATES));
      }
    } catch {
      setTemplates(PRESET_TEMPLATES);
    }
  }, []);

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

  // PDF 导出
  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      await exportTasksToPDF(tasks, {
        scope: pdfScope,
        projectFilter: pdfProjectFilter || null,
      });
      onClose();
    } catch (err) {
      setError(`PDF导出失败: ${err.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // 使用模板导出
  const handleExportWithTemplate = (template) => {
    const date = new Date().toISOString().split('T')[0];
    
    if (template.format === 'PDF') {
      setPdfScope(template.groupByProject ? 'all' : 'all');
      handleExportPDF();
      return;
    }

    // 根据模板字段过滤任务
    const exportTasks = tasks.map(task => {
      const filtered = {};
      for (const field of template.fields) {
        if (field === 'subtasks' && task.subtasks) {
          filtered.subtasks = task.subtasks.map(st => st.title || st);
        } else if (field === 'tags') {
          filtered.tags = task.tags || [];
        } else {
          filtered[field] = task[field];
        }
      }
      return filtered;
    });

    if (template.format === 'JSON') {
      const json = JSON.stringify(exportTasks, null, 2);
      downloadContent(json, `hermes-todos-${template.name}-${date}.json`, 'application/json');
    } else if (template.format === 'CSV') {
      const headers = template.fields.join(',');
      const lines = exportTasks.map(task => {
        return template.fields.map(f => escapeCSV(task[f])).join(',');
      });
      const csv = [headers, ...lines].join('\n');
      downloadContent(csv, `hermes-todos-${template.name}-${date}.csv`, 'text/csv');
    }
    onClose();
  };

  const downloadContent = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const escapeCSV = (val) => {
    if (!val && val !== 0) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // 保存模板
  const handleSaveTemplate = () => {
    if (!newTemplate.name.trim()) {
      setError('请输入模板名称');
      return;
    }
    if (newTemplate.fields.length === 0) {
      setError('请选择至少一个字段');
      return;
    }

    const templateToSave = {
      ...newTemplate,
      id: `custom-${Date.now()}`,
    };

    const updatedTemplates = [...templates, templateToSave];
    setTemplates(updatedTemplates);
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(updatedTemplates));
    
    setNewTemplate({
      name: '',
      description: '',
      fields: ['title'],
      format: 'JSON',
      groupByProject: false,
    });
    setTemplateMode('select');
    setSelectedTemplate(null);
  };

  // 删除模板
  const handleDeleteTemplate = (templateId) => {
    // 不允许删除预设模板
    if (PRESET_TEMPLATES.find(t => t.id === templateId)) {
      setError('预设模板不能删除');
      return;
    }
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    setTemplates(updatedTemplates);
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(updatedTemplates));
    setSelectedTemplate(null);
  };

  // 切换字段
  const toggleField = (field) => {
    setNewTemplate(prev => {
      const fields = prev.fields.includes(field)
        ? prev.fields.filter(f => f !== field)
        : [...prev.fields, field];
      return { ...prev, fields };
    });
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

  const projects = getProjectList(tasks);

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
              <div className="ie-buttons" style={{ marginTop: '8px' }}>
                <button className="ie-btn" onClick={() => setMode('pdf-export')}>📑 导出 PDF</button>
                <button className="ie-btn" onClick={() => setMode('template')}>📋 模板导出</button>
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

        {mode === 'pdf-export' && (
          <div className="ie-preview">
            <h4>📑 导出 PDF 报告</h4>
            <p className="ie-desc">选择导出范围</p>
            
            <div className="pdf-scope-options">
              <label className="pdf-scope-option">
                <input
                  type="radio"
                  name="pdfScope"
                  value="all"
                  checked={pdfScope === 'all'}
                  onChange={(e) => setPdfScope(e.target.value)}
                />
                全部任务
              </label>
              <label className="pdf-scope-option">
                <input
                  type="radio"
                  name="pdfScope"
                  value="completed"
                  checked={pdfScope === 'completed'}
                  onChange={(e) => setPdfScope(e.target.value)}
                />
                仅已完成
              </label>
              <label className="pdf-scope-option">
                <input
                  type="radio"
                  name="pdfScope"
                  value="in-progress"
                  checked={pdfScope === 'in-progress'}
                  onChange={(e) => setPdfScope(e.target.value)}
                />
                仅进行中
              </label>
              {projects.length > 0 && (
                <label className="pdf-scope-option">
                  <input
                    type="radio"
                    name="pdfScope"
                    value="project"
                    checked={pdfScope === 'project'}
                    onChange={(e) => setPdfScope(e.target.value)}
                  />
                  按项目
                </label>
              )}
            </div>

            {pdfScope === 'project' && projects.length > 0 && (
              <div className="pdf-project-select">
                <select
                  value={pdfProjectFilter}
                  onChange={(e) => setPdfProjectFilter(e.target.value)}
                >
                  <option value="">选择项目...</option>
                  {projects.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="ie-error">{error}</p>}

            <div className="ie-actions">
              <button className="btn-cancel" onClick={() => { setMode('menu'); setError(''); }}>取消</button>
              <button className="ie-btn primary" onClick={handleExportPDF} disabled={pdfLoading}>
                {pdfLoading ? '导出中...' : '📑 导出 PDF'}
              </button>
            </div>
          </div>
        )}

        {mode === 'template' && templateMode === 'select' && (
          <div className="ie-preview">
            <h4>📋 模板导出</h4>
            <p className="ie-desc">选择导出模板</p>
            
            <div className="template-list">
              {templates.map(t => (
                <div key={t.id} className="template-item" onClick={() => setSelectedTemplate(t)}>
                  <div className="template-header">
                    <span className="template-name">{t.name}</span>
                    <span className="template-format">{t.format}</span>
                  </div>
                  <div className="template-desc">{t.description}</div>
                  <div className="template-fields">
                    {t.fields.map(f => (
                      <span key={f} className="template-field-tag">{f}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedTemplate && (
              <div className="template-actions">
                <button className="ie-btn primary" onClick={() => handleExportWithTemplate(selectedTemplate)}>
                  使用此模板导出
                </button>
                <button className="ie-btn" onClick={() => setTemplateMode('create')}>创建新模板</button>
                {!PRESET_TEMPLATES.find(t => t.id === selectedTemplate.id) && (
                  <button className="ie-btn danger" onClick={() => handleDeleteTemplate(selectedTemplate.id)}>删除</button>
                )}
              </div>
            )}

            {!selectedTemplate && (
              <div className="template-actions">
                <button className="ie-btn" onClick={() => setTemplateMode('create')}>创建新模板</button>
              </div>
            )}

            {error && <p className="ie-error">{error}</p>}

            <div className="ie-actions">
              <button className="btn-cancel" onClick={() => { setMode('menu'); setError(''); setSelectedTemplate(null); }}>返回</button>
            </div>
          </div>
        )}

        {mode === 'template' && templateMode === 'create' && (
          <div className="ie-preview">
            <h4>创建导出模板</h4>
            
            <div className="template-form">
              <div className="template-form-field">
                <label>模板名称</label>
                <input
                  type="text"
                  placeholder="例如：我的周报模板"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="template-form-field">
                <label>描述</label>
                <input
                  type="text"
                  placeholder="模板用途说明"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="template-form-field">
                <label>导出格式</label>
                <div className="template-format-options">
                  <label>
                    <input
                      type="radio"
                      name="templateFormat"
                      value="JSON"
                      checked={newTemplate.format === 'JSON'}
                      onChange={() => setNewTemplate(prev => ({ ...prev, format: 'JSON' }))}
                    />
                    JSON
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="templateFormat"
                      value="CSV"
                      checked={newTemplate.format === 'CSV'}
                      onChange={() => setNewTemplate(prev => ({ ...prev, format: 'CSV' }))}
                    />
                    CSV
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="templateFormat"
                      value="PDF"
                      checked={newTemplate.format === 'PDF'}
                      onChange={() => setNewTemplate(prev => ({ ...prev, format: 'PDF' }))}
                    />
                    PDF
                  </label>
                </div>
              </div>

              <div className="template-form-field">
                <label>选择字段</label>
                <div className="template-fields-grid">
                  {['title', 'content', 'dueDate', 'priority', 'status', 'project', 'tags', 'subtasks'].map(field => (
                    <label key={field} className="template-field-checkbox">
                      <input
                        type="checkbox"
                        checked={newTemplate.fields.includes(field)}
                        onChange={() => toggleField(field)}
                      />
                      {field}
                    </label>
                  ))}
                </div>
              </div>

              <div className="template-form-field">
                <label>
                  <input
                    type="checkbox"
                    checked={newTemplate.groupByProject}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, groupByProject: e.target.checked }))}
                  />
                  按项目分组（仅 PDF）
                </label>
              </div>
            </div>

            {error && <p className="ie-error">{error}</p>}

            <div className="ie-actions">
              <button className="btn-cancel" onClick={() => { setTemplateMode('select'); setError(''); }}>取消</button>
              <button className="ie-btn primary" onClick={handleSaveTemplate}>保存模板</button>
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
