/**
 * AI Subtask Tests - CommonJS module test
 * Tests for getAPIToken, setAPIToken, breakIntoSubtasks
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock localStorage before requiring module
const localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = value;
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

global.localStorage = localStorageMock;

const { getAPIToken, setAPIToken, breakIntoSubtasks } = require('../src/utils/aiSubtask.js');

describe('AI Subtask Module', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('getAPIToken', () => {
    it('should return ai_token when available', () => {
      localStorageMock.setItem('hermes_ai_token', 'test-token-123');
      const token = getAPIToken();
      assert.strictEqual(token, 'test-token-123');
    });

    it('should fallback to github_token when ai_token not available', () => {
      localStorageMock.setItem('hermes_github_token', 'github-token-456');
      const token = getAPIToken();
      assert.strictEqual(token, 'github-token-456');
    });

    it('should prioritize ai_token over github_token', () => {
      localStorageMock.setItem('hermes_ai_token', 'ai-token');
      localStorageMock.setItem('hermes_github_token', 'github-token');
      const token = getAPIToken();
      assert.strictEqual(token, 'ai-token');
    });

    it('should return null when no tokens available', () => {
      const token = getAPIToken();
      assert.strictEqual(token, null);
    });
  });

  describe('setAPIToken', () => {
    it('should set ai_token when token provided', () => {
      setAPIToken('new-token');
      assert.strictEqual(localStorageMock.store['hermes_ai_token'], 'new-token');
    });

    it('should remove ai_token when null passed', () => {
      localStorageMock.setItem('hermes_ai_token', 'old-token');
      setAPIToken(null);
      assert.strictEqual(localStorageMock.store['hermes_ai_token'], undefined);
    });

    it('should remove ai_token when empty string passed', () => {
      localStorageMock.setItem('hermes_ai_token', 'old-token');
      setAPIToken('');
      assert.strictEqual(localStorageMock.store['hermes_ai_token'], undefined);
    });
  });

  describe('breakIntoSubtasks', () => {
    it('should throw NO_TOKEN error when no API token', async () => {
      const task = { id: 'task-1', title: 'Test Task' };
      
      await assert.rejects(
        () => breakIntoSubtasks(task, []),
        { message: 'NO_TOKEN' }
      );
    });
  });

  describe('API Token Priority', () => {
    it('should prefer hermes_ai_token over hermes_github_token', () => {
      localStorageMock.setItem('hermes_ai_token', 'ai-token-value');
      localStorageMock.setItem('hermes_github_token', 'github-token-value');
      assert.strictEqual(getAPIToken(), 'ai-token-value');
    });
  });

  describe('Token Storage', () => {
    it('should store token in hermes_ai_token key', () => {
      setAPIToken('my-secret-token');
      assert.strictEqual(localStorageMock.store['hermes_ai_token'], 'my-secret-token');
    });

    it('should remove token when setting null', () => {
      setAPIToken('some-token');
      setAPIToken(null);
      assert.strictEqual('hermes_ai_token' in localStorageMock.store, false);
    });
  });
});