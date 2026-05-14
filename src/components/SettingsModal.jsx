import { useState } from 'react';
import './SettingsModal.css';
import { getGoogleCalendarApiKey, setGoogleCalendarApiKey } from '../utils/googleCalendarSync';
import { getSlackWebhookUrl, setSlackWebhookUrl } from '../utils/slackNotifier';

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

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>取消</button>
            <button type="submit" className="btn-save">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
