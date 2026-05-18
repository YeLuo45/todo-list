import { useState } from 'react';
import './SettingsModal.css';
import { getGoogleCalendarApiKey, setGoogleCalendarApiKey } from '../utils/googleCalendarSync';
import { getSlackWebhookUrl, setSlackWebhookUrl } from '../utils/slackNotifier';
import { getUsers, addUser, updateUser, deleteUser, getCurrentUser, setCurrentUser } from '../utils/comment';
import { isEncryptionEnabled, setEncryptionEnabled } from '../utils/storage';
import { keyManager } from '../crypto/keyManager';

const AI_TOKEN_KEY = 'hermes_ai_token';

export default function SettingsModal({ token, repo, onSave, onClose }) {
  const [inputToken, setInputToken] = useState(token || '');
  const [inputRepo, setInputRepo] = useState(repo || 'YeLuo45/todo-list');
  const [aiToken, setAiToken] = useState(localStorage.getItem(AI_TOKEN_KEY) || '');
  const [showToken, setShowToken] = useState(false);
  const [showAiToken, setShowAiToken] = useState(false);
  const [gcalApiKey, setGcalApiKey] = useState(getGoogleCalendarApiKey());
  const [showGcalKey, setShowGcalKey] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState(getSlackWebhookUrl());
  const [showSlackWebhook, setShowSlackWebhook] = useState(false);
  const [users, setUsers] = useState(getUsers());
  const [currentUser, setCurrentUserState] = useState(getCurrentUser());
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserAvatar, setNewUserAvatar] = useState('👤');
  const [newUserColor, setNewUserColor] = useState('#6b7280');
  const [encryptionEnabled, setEncryptionEnabledState] = useState(isEncryptionEnabled());

  const handleEncryptionToggle = (enabled) => {
    setEncryptionEnabled(enabled);
    setEncryptionEnabledState(enabled);
  };

  const handleExportKey = async () => {
    try {
      const key = await keyManager.getOrCreateKey();
      const base64Key = await keyManager.exportKey(key);
      const blob = new Blob([base64Key], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hermes-encryption-key.txt';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export key:', err);
      alert('导出密钥失败');
    }
  };

  const handleImportKey = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.key';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const trimmed = text.trim();
        await keyManager.importKey(trimmed);
        localStorage.setItem('hermes_enc_key_v1', trimmed);
        alert('密钥导入成功');
      } catch (err) {
        console.error('Failed to import key:', err);
        alert('导入密钥失败：请确保是有效的 Base64 密钥文件');
      }
    };
    input.click();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Save AI token
    if (aiToken.trim()) {
      localStorage.setItem(AI_TOKEN_KEY, aiToken.trim());
    } else {
      localStorage.removeItem(AI_TOKEN_KEY);
    }
    // Save Google Calendar API Key
    setGoogleCalendarApiKey(gcalApiKey.trim());
    // Save Slack Webhook URL
    setSlackWebhookUrl(slackWebhook.trim());
    onSave(inputToken.trim(), inputRepo.trim());
  };

  const handleAddUser = () => {
    if (!newUserName.trim()) return;
    const user = addUser({ name: newUserName.trim(), avatar: newUserAvatar, color: newUserColor });
    setUsers(getUsers());
    setNewUserName('');
    setNewUserAvatar('👤');
    setNewUserColor('#6b7280');
    setShowUserForm(false);
  };

  const handleUpdateUser = () => {
    if (!newUserName.trim() || !editingUser) return;
    updateUser(editingUser.id, { name: newUserName.trim(), avatar: newUserAvatar, color: newUserColor });
    setUsers(getUsers());
    setNewUserName('');
    setNewUserAvatar('👤');
    setNewUserColor('#6b7280');
    setEditingUser(null);
    setShowUserForm(false);
  };

  const handleDeleteUser = (id) => {
    if (window.confirm('确定删除该用户？')) {
      deleteUser(id);
      setUsers(getUsers());
    }
  };

  const handleSelectCurrentUser = (userId) => {
    setCurrentUser(userId);
    setCurrentUserState(getCurrentUser());
  };

  const startEditUser = (user) => {
    setEditingUser(user);
    setNewUserName(user.name);
    setNewUserAvatar(user.avatar);
    setNewUserColor(user.color);
    setShowUserForm(true);
  };

  const cancelUserForm = () => {
    setShowUserForm(false);
    setEditingUser(null);
    setNewUserName('');
    setNewUserAvatar('👤');
    setNewUserColor('#6b7280');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <h3>⚙️ 设置</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h4>🤖 AI 功能设置</h4>
            <div className="form-group">
              <label>MiniMax API Token</label>
              <div className="token-input-row">
                <input
                  type={showAiToken ? 'text' : 'password'}
                  value={aiToken}
                  onChange={(e) => setAiToken(e.target.value)}
                  placeholder="用于 AI 任务拆解"
                  autoFocus
                />
                <button type="button" className="btn-toggle" onClick={() => setShowAiToken(!showAiToken)}>
                  {showAiToken ? '🙈' : '👁️'}
                </button>
              </div>
              <small>用于 AI 智能拆解子任务功能。Token 仅保存在本地浏览器。</small>
            </div>
          </div>

          <div className="form-section">
            <h4>📤 GitHub 同步设置</h4>
            <div className="form-group">
              <label>GitHub Personal Access Token</label>
              <div className="token-input-row">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="***"
                />
                <button type="button" className="btn-toggle" onClick={() => setShowToken(!showToken)}>
                  {showToken ? '🙈' : '👁️'}
                </button>
              </div>
              <small>需要 repo 权限。Token 仅保存在本地浏览器。</small>
            </div>

            <div className="form-group">
              <label>仓库</label>
              <input
                type="text"
                value={inputRepo}
                onChange={(e) => setInputRepo(e.target.value)}
                placeholder="YeLuo45/todo-list"
              />
              <small>格式：owner/repo，数据将保存在该仓库的 data/todos.json</small>
            </div>
          </div>

          <div className="form-section">
            <h4>📅 Google Calendar 同步</h4>
            <div className="form-group">
              <label>Google Calendar API Key</label>
              <div className="token-input-row">
                <input
                  type={showGcalKey ? 'text' : 'password'}
                  value={gcalApiKey}
                  onChange={(e) => setGcalApiKey(e.target.value)}
                  placeholder="AIza..."
                />
                <button type="button" className="btn-toggle" onClick={() => setShowGcalKey(!showGcalKey)}>
                  {showGcalKey ? '🙈' : '👁️'}
                </button>
              </div>
              <small>用于导出任务到 Google Calendar。获取方式：Google Cloud Console → APIs &amp; Services → Credentials</small>
            </div>
          </div>

          <div className="form-section">
            <h4>💬 Slack 提醒通知</h4>
            <div className="form-group">
              <label>Slack Webhook URL</label>
              <div className="token-input-row">
                <input
                  type={showSlackWebhook ? 'text' : 'password'}
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                />
                <button type="button" className="btn-toggle" onClick={() => setShowSlackWebhook(!showSlackWebhook)}>
                  {showSlackWebhook ? '🙈' : '👁️'}
                </button>
              </div>
              <small>用于发送任务到期提醒到 Slack。获取方式：Slack App → Incoming Webhooks</small>
            </div>
          </div>

          <div className="form-section">
            <h4>👥 协作成员管理</h4>
            <div className="current-user-display">
              <span>当前用户：</span>
              <span 
                className="current-user-badge" 
                style={{ backgroundColor: currentUser.color }}
              >
                {currentUser.avatar} {currentUser.name}
              </span>
            </div>
            
            <div className="users-list">
              {users.map(user => (
                <div key={user.id} className={`user-item ${user.id === currentUser.id ? 'is-current' : ''}`}>
                  <span 
                    className="user-avatar" 
                    style={{ backgroundColor: user.color }}
                    onClick={() => handleSelectCurrentUser(user.id)}
                    title="点击设为当前用户"
                  >
                    {user.avatar}
                  </span>
                  <span className="user-name">{user.name}</span>
                  <div className="user-actions">
                    <button 
                      type="button" 
                      className="btn-user-edit"
                      onClick={() => startEditUser(user)}
                    >
                      ✏️
                    </button>
                    <button 
                      type="button" 
                      className="btn-user-delete"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {showUserForm ? (
              <div className="user-form">
                <div className="form-group">
                  <label>名称</label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="成员名称"
                  />
                </div>
                <div className="form-group">
                  <label>头像</label>
                  <select value={newUserAvatar} onChange={(e) => setNewUserAvatar(e.target.value)}>
                    <option value="👤">👤</option>
                    <option value="🧑">🧑</option>
                    <option value="👨">👨</option>
                    <option value="👩">👩</option>
                    <option value="🧔">🧔</option>
                    <option value="👴">👴</option>
                    <option value="👵">👵</option>
                    <option value="🧑‍💻">🧑‍💻</option>
                    <option value="👨‍🎓">👨‍🎓</option>
                    <option value="👩‍🎓">👩‍🎓</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>颜色</label>
                  <input
                    type="color"
                    value={newUserColor}
                    onChange={(e) => setNewUserColor(e.target.value)}
                  />
                </div>
                <div className="user-form-actions">
                  {editingUser ? (
                    <>
                      <button type="button" className="btn-save" onClick={handleUpdateUser}>保存</button>
                      <button type="button" className="btn-cancel" onClick={cancelUserForm}>取消</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn-save" onClick={handleAddUser}>添加</button>
                      <button type="button" className="btn-cancel" onClick={cancelUserForm}>取消</button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button 
                type="button" 
                className="btn-add-user"
                onClick={() => setShowUserForm(true)}
              >
                ➕ 添加成员
              </button>
            )}
          </div>

          <div className="form-section">
            <h4>🔒 端到端加密设置</h4>
            <div className="encryption-status">
              <span className={`status-badge ${encryptionEnabled ? 'active' : 'inactive'}`}>
                {encryptionEnabled ? '🔐 已启用' : '🔓 已禁用'}
              </span>
              {keyManager.hasKey() && (
                <span className="key-indicator">密钥已存在</span>
              )}
            </div>
            <div className="form-group">
              <label className="toggle-label">
                <span>启用加密模式</span>
                <input
                  type="checkbox"
                  checked={encryptionEnabled}
                  onChange={(e) => handleEncryptionToggle(e.target.checked)}
                  className="toggle-input"
                />
                <span className="toggle-switch"></span>
              </label>
              <small>开启后，所有任务数据将使用 AES-256-GCM 加密存储。请妥善保管密钥！</small>
            </div>
            <div className="encryption-actions">
              <button type="button" className="btn-secondary" onClick={handleExportKey}>
                📤 导出密钥
              </button>
              <button type="button" className="btn-secondary" onClick={handleImportKey}>
                📥 导入密钥
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>取消</button>
            <button type="submit" className="btn-save">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
