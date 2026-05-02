// GitHub API 封装 — 操作仓库中的文件

const BASE_URL = 'https://api.github.com';

// 通用请求
async function ghRequest(path, options = {}, token) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `GitHub API error: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// 获取文件内容 + SHA
export async function getFile(owner, repo, path, token) {
  try {
    const data = await ghRequest(`/repos/${owner}/${repo}/contents/${path}`, {}, token);
    return {
      content: data.content ? JSON.parse(atob(data.content)) : null,
      sha: data.sha,
    };
  } catch (err) {
    if (err.message.includes('Not Found')) {
      return { content: null, sha: null };
    }
    throw err;
  }
}

// 创建或更新文件
export async function upsertFile(owner, repo, path, content, token, sha = null) {
  const body = {
    message: sha ? `chore: update ${path}` : `chore: create ${path}`,
    content: btoa(JSON.stringify(content, null, 2)),
  };
  if (sha) body.sha = sha;

  const data = await ghRequest(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }, token);

  return data.commit.sha;
}

// 删除文件
export async function deleteFile(owner, repo, path, token, sha) {
  await ghRequest(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message: `chore: delete ${path}`, sha }),
  }, token);
}

// 解析 repo 字符串 "owner/repo" 或 "repo"（默认用 todo-list）
export function parseRepo(repoStr, defaultOwner = 'YeLuo45') {
  const parts = repoStr.trim().split('/');
  if (parts.length === 2) {
    return { owner: parts[0], repo: parts[1] };
  }
  return { owner: defaultOwner, repo: repoStr.trim() };
}
