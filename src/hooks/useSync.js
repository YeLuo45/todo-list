import { useState, useEffect, useCallback, useRef } from 'react';
import { getFile, upsertFile, parseRepo } from '../utils/githubApi';
import { useAppStore } from '../store/useAppStore';

const TOKEN_KEY = 'github_token_sync';
const REPO_KEY = 'github_repo_sync';
const FILE_PATH = 'data/todos.json';
const DEBOUNCE_MS = 3000;

export function useSync(tasks, setTasks) {
  const [status, setStatus] = useState('idle'); // idle|syncing|synced|error|offline|unauthenticated
  const [lastSynced, setLastSynced] = useState(null);
  const githubToken = useAppStore((s) => s.githubToken);
  const githubRepo = useAppStore((s) => s.githubRepo);
  const syncSha = useAppStore((s) => s.syncSha);

  const debounceTimer = useRef(null);
  const isLoadingRef = useRef(false); // 防止 pull→tasks变化→push 的循环

  // 保存 token/repo
  const saveSettings = useCallback((token, repo) => {
    if (token) useAppStore.getState().setGithubToken(token);
    if (repo) useAppStore.getState().setGithubRepo(repo || 'YeLuo45/todo-list');
  }, []);

  const clearSettings = useCallback(() => {
    useAppStore.getState().setGithubToken(null);
    useAppStore.getState().setGithubRepo('YeLuo45/todo-list');
    useAppStore.getState().setSyncSha(null);
    setStatus('idle');
    setLastSynced(null);
  }, []);

  // 拉取数据
  const pull = useCallback(async () => {
    if (!githubToken) { setStatus('unauthenticated'); return; }
    if (!navigator.onLine) { setStatus('offline'); return; }

    setStatus('syncing');
    isLoadingRef.current = true;
    try {
      const { owner, repo } = parseRepo(githubRepo);
      const result = await getFile(owner, repo, FILE_PATH, githubToken);
      if (result.content) {
        useAppStore.getState().setSyncSha(result.sha);
        setTasks(result.content);
        localStorage.setItem('hermes_todos_v2', JSON.stringify(result.content));
      } else {
        useAppStore.getState().setSyncSha(null);
      }
      setLastSynced(new Date());
      setStatus('synced');
    } catch (err) {
      console.error('[useSync] pull error:', err);
      setStatus('error');
    } finally {
      isLoadingRef.current = false;
    }
  }, [githubToken, githubRepo, setTasks]);

  // 推送（debounce）
  const push = useCallback(async (tasksToSave) => {
    if (!githubToken) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    if (isLoadingRef.current) return; // 忽略 pull 引起的任务变化

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setStatus('syncing');
      try {
        const { owner, repo } = parseRepo(githubRepo);
        // 获取最新 SHA
        let currentSha = syncSha;
        try {
          const result = await getFile(owner, repo, FILE_PATH, githubToken);
          if (result.sha) { currentSha = result.sha; useAppStore.getState().setSyncSha(result.sha); }
        } catch (e) { /* 文件不存在，后续创建 */ }

        const commitSha = await upsertFile(owner, repo, FILE_PATH, tasksToSave, githubToken, currentSha);
        useAppStore.getState().setSyncSha(commitSha);
        setLastSynced(new Date());
        setStatus('synced');
      } catch (err) {
        console.error('[useSync] push error:', err);
        setStatus('error');
      }
    }, DEBOUNCE_MS);
  }, [githubToken, githubRepo, syncSha]);

  // 主动同步
  const sync = useCallback(() => pull(), [pull]);

  // 初始化
  useEffect(() => {
    if (!githubToken) return;
    pull();

    const handleOnline = () => { if (githubToken) pull(); };
    const handleOffline = () => setStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [githubToken]); // eslint-disable-line

  // 监听 tasks 变化自动 push
  useEffect(() => {
    if (!githubToken) return;
    push(tasks);
  }, [tasks]); // eslint-disable-line

  return {
    status,
    lastSynced,
    githubToken,
    githubRepo,
    login: saveSettings,
    logout: clearSettings,
    pull,
    push,
    sync,
  };
}
