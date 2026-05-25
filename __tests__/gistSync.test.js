/**
 * GistSync Utility Tests
 * Tests for gist sync functions with mocked localStorage and fetch
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get store() { return store; },
    setStore: (s) => { store = s; }
  };
})();
global.localStorage = localStorageMock;

// Mock fetch
let mockFetch;
function setupFetch(response, ok = true) {
  mockFetch = mock.fn(async () => ({
    ok,
    status: ok ? 200 : 400,
    json: async () => response,
  }));
  global.fetch = mockFetch;
}

// Import after mocks are set up
const {
  getGistConfig,
  saveGistConfig,
  getBackupHistory,
  saveBackupHistory,
  getLastBackupTime,
  setLastBackupTime,
  fetchGist,
  pushGist,
  createGist,
  createBackupGist,
  fetchBackupList,
  fetchBackupContent,
  mergeTasks,
} = await import('../src/utils/gistSync.js');

describe('GistSync Module - Config Functions', () => {
  beforeEach(() => {
    localStorageMock.clear();
    if (mockFetch) mockFetch.mock.resetCalls();
  });

  it('should get null for non-existent config', () => {
    assert.strictEqual(getGistConfig(), null);
  });

  it('should save and get config', () => {
    const config = { gistId: 'abc123', pat: 'tok123' };
    saveGistConfig(config);
    const result = getGistConfig();
    assert.deepStrictEqual(result, config);
  });

  it('should return null for invalid JSON config', () => {
    localStorage.setItem('gist-sync-config', 'not json');
    assert.strictEqual(getGistConfig(), null);
  });

  it('should get empty array for non-existent backup history', () => {
    assert.deepStrictEqual(getBackupHistory(), []);
  });

  it('should save and get backup history', () => {
    const history = [
      { gistId: 'a', timestamp: '2024-01-01' },
      { gistId: 'b', timestamp: '2024-01-02' },
    ];
    saveBackupHistory(history);
    assert.deepStrictEqual(getBackupHistory(), history);
  });

  it('should trim backup history to 7 items', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      gistId: `gist-${i}`,
      timestamp: `2024-01-${i.toString().padStart(2, '0')}`
    }));
    saveBackupHistory(history);
    const result = getBackupHistory();
    assert.strictEqual(result.length, 7);
    assert.strictEqual(result[0].gistId, 'gist-0');
  });

  it('should return null for non-existent last backup time', () => {
    assert.strictEqual(getLastBackupTime(), null);
  });

  it('should save and get last backup time', () => {
    const time = '2024-06-01T10:00:00Z';
    setLastBackupTime(time);
    assert.strictEqual(getLastBackupTime(), time);
  });
});

describe('GistSync Module - API Functions', () => {
  beforeEach(() => {
    localStorageMock.clear();
    if (mockFetch) mockFetch.mock.resetCalls();
  });

  it('should fetch gist content', async () => {
    const mockData = {
      files: {
        'tasks.json': { content: JSON.stringify([{ id: 't1', title: 'Test' }]) }
      }
    };
    setupFetch(mockData);

    const result = await fetchGist('gist123', 'token123');

    assert.deepStrictEqual(result, [{ id: 't1', title: 'Test' }]);
    assert.strictEqual(mockFetch.mock.callCount(), 1);
    const call = mockFetch.mock.calls[0];
    assert.ok(call.arguments[0].includes('api.github.com/gists/gist123'));
  });

  it('should throw error when fetch fails', async () => {
    setupFetch({ message: 'Not Found' }, false);

    await assert.rejects(
      () => fetchGist('bad gist', 'token'),
      /Gist fetch failed/
    );
  });

  it('should throw error when tasks.json not found', async () => {
    setupFetch({ files: { 'other.json': { content: '{}' } } });

    await assert.rejects(
      () => fetchGist('gist123', 'token'),
      /tasks\.json not found/
    );
  });

  it('should push gist with full data', async () => {
    setupFetch({ id: 'new-gist', description: 'Updated' });
    const backupData = {
      tasks: [{ id: 't1', title: 'Task 1' }],
      projects: [{ id: 'p1', name: 'Project 1' }],
      tagColors: { tag1: '#ff0000' },
      tagGroups: [{ id: 'g1', name: 'Group 1' }],
      hermesTagColors: { tag1: '#00ff00' },
    };

    const result = await pushGist('gist123', 'token123', backupData);

    assert.strictEqual(result.id, 'new-gist');
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call.arguments[1].body);
    assert.ok(body.files['tasks.json']);
    const content = JSON.parse(body.files['tasks.json'].content);
    assert.strictEqual(content.version, 2);
    assert.deepStrictEqual(content.tasks, backupData.tasks);
    assert.deepStrictEqual(content.projects, backupData.projects);
    assert.deepStrictEqual(content.tagColors, backupData.tagColors);
    assert.deepStrictEqual(content.tagGroups, backupData.tagGroups);
    assert.deepStrictEqual(content.hermesTagColors, backupData.hermesTagColors);
  });

  it('should throw error when push fails', async () => {
    setupFetch({ message: 'Bad Request' }, false);

    await assert.rejects(
      () => pushGist('gist123', 'token', {}),
      /Gist push failed/
    );
  });

  it('should create new gist', async () => {
    setupFetch({ id: 'new-gist-id', description: 'Hermes TodoList' });
    const backupData = { tasks: [{ id: 't1' }], projects: [] };

    const result = await createGist('token123', backupData);

    assert.strictEqual(result.id, 'new-gist-id');
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call.arguments[1].body);
    assert.strictEqual(body.description, 'Hermes TodoList');
    assert.strictEqual(body.public, false);
  });

  it('should throw error when create fails', async () => {
    setupFetch({ message: 'Unauthorized' }, false);

    await assert.rejects(
      () => createGist('bad-token', {}),
      /Gist create failed/
    );
  });

  it('should create backup gist with timestamp', async () => {
    setupFetch({ id: 'backup-gist', description: 'Hermes TodoList Backup 06/01 10:00' });
    const backupData = {
      tasks: [{ id: 't1', title: 'Task' }],
      projects: [{ id: 'p1', name: 'Project' }],
      tagColors: {},
      tagGroups: [],
      hermesTagColors: {},
    };

    const result = await createBackupGist('token', backupData);

    assert.strictEqual(result.gistId, 'backup-gist');
    assert.strictEqual(result.taskCount, 1);
    assert.strictEqual(result.projectCount, 1);
    assert.ok(result.timestamp);
    assert.ok(result.description.includes('Hermes TodoList Backup'));
  });

  it('should handle empty backup data in createBackupGist', async () => {
    setupFetch({ id: 'backup-gist', description: 'Hermes TodoList Backup' });

    const result = await createBackupGist('token', {});

    assert.strictEqual(result.taskCount, 0);
    assert.strictEqual(result.projectCount, 0);
  });

  it('should throw error when backup create fails', async () => {
    setupFetch({ message: 'Forbidden' }, false);

    await assert.rejects(
      () => createBackupGist('token', {}),
      /Backup Gist create failed/
    );
  });

  it('should fetch backup list filtered by description', async () => {
    setupFetch([
      { id: 'b1', description: 'Hermes TodoList Backup 06/01 10:00', updated_at: '2024-06-01T10:00:00Z' },
      { id: 'b2', description: 'Hermes TodoList Backup 06/02 11:00', updated_at: '2024-06-02T11:00:00Z' },
      { id: 'b3', description: 'Some other gist', updated_at: '2024-06-03T12:00:00Z' },
      { id: 'b4', description: null, updated_at: '2024-06-04T12:00:00Z' },
    ]);

    const result = await fetchBackupList('token', 7);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].gistId, 'b1');
    assert.strictEqual(result[1].gistId, 'b2');
    assert.ok(result[0].description.includes('Hermes TodoList Backup'));
  });

  it('should limit backup list results', async () => {
    const gists = Array.from({ length: 15 }, (_, i) => ({
      id: `b${i}`,
      description: `Hermes TodoList Backup ${i}`,
      updated_at: `2024-01-${((i * 3) % 28 + 1).toString().padStart(2, '0')}T10:00:00Z`
    }));
    setupFetch(gists);

    const result = await fetchBackupList('token', 5);

    assert.strictEqual(result.length, 5);
  });

  it('should throw error when backup list fetch fails', async () => {
    setupFetch({ message: 'Rate limit' }, false);

    await assert.rejects(
      () => fetchBackupList('token'),
      /Gist list fetch failed/
    );
  });

  it('should fetch backup content v1 format (array)', async () => {
    setupFetch({
      files: {
        'tasks.json': { content: JSON.stringify([{ id: 't1' }, { id: 't2' }]) }
      }
    });

    const result = await fetchBackupContent('backup-gist', 'token');

    assert.strictEqual(result.version, 1);
    assert.deepStrictEqual(result.tasks, [{ id: 't1' }, { id: 't2' }]);
  });

  it('should fetch backup content v2 format (object)', async () => {
    setupFetch({
      files: {
        'tasks.json': {
          content: JSON.stringify({
            version: 2,
            tasks: [{ id: 't1' }],
            projects: [{ id: 'p1' }],
            tagColors: { tag1: '#ff0000' },
          })
        }
      }
    });

    const result = await fetchBackupContent('backup-gist', 'token');

    assert.strictEqual(result.version, 2);
    assert.deepStrictEqual(result.tasks, [{ id: 't1' }]);
    assert.deepStrictEqual(result.projects, [{ id: 'p1' }]);
    assert.deepStrictEqual(result.tagColors, { tag1: '#ff0000' });
  });

  it('should throw error when backup content fetch fails', async () => {
    setupFetch({ message: 'Not Found' }, false);

    await assert.rejects(
      () => fetchBackupContent('bad-backup', 'token'),
      /Backup fetch failed/
    );
  });

  it('should throw error when tasks.json missing in backup', async () => {
    setupFetch({ files: { 'other.json': { content: '{}' } } });

    await assert.rejects(
      () => fetchBackupContent('backup-gist', 'token'),
      /tasks\.json not found/
    );
  });
});

describe('GistSync Module - mergeTasks', () => {
  it('should merge tasks keeping newer version', () => {
    const local = [
      { id: 't1', title: 'Local Task', updatedAt: '2024-01-01T10:00:00Z' },
      { id: 't2', title: 'Local Only', updatedAt: '2024-01-01T10:00:00Z' },
    ];
    const remote = [
      { id: 't1', title: 'Remote Task', updatedAt: '2024-01-02T10:00:00Z' },
      { id: 't3', title: 'Remote Only', updatedAt: '2024-01-01T10:00:00Z' },
    ];

    const result = mergeTasks(local, remote);

    assert.strictEqual(result.length, 3);
    const t1 = result.find(t => t.id === 't1');
    assert.strictEqual(t1.title, 'Remote Task'); // newer version
    assert.ok(result.find(t => t.id === 't2')); // local only
    assert.ok(result.find(t => t.id === 't3')); // remote only
  });

  it('should prefer local when remote is older', () => {
    const local = [
      { id: 't1', title: 'Local', updatedAt: '2024-01-02T00:00:00Z' },
    ];
    const remote = [
      { id: 't1', title: 'Remote', updatedAt: '2024-01-01T00:00:00Z' },
    ];

    const result = mergeTasks(local, remote);

    assert.strictEqual(result[0].title, 'Local');
  });

  it('should handle empty local', () => {
    const result = mergeTasks([], [{ id: 't1', title: 'Remote' }]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 't1');
  });

  it('should handle empty remote', () => {
    const result = mergeTasks([{ id: 't1' }], []);
    assert.strictEqual(result.length, 1);
  });

  it('should handle both empty', () => {
    const result = mergeTasks([], []);
    assert.deepStrictEqual(result, []);
  });
});
