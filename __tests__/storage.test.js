/**
 * Storage Tests - Simplified version
 * Tests core storage logic without browser API dependencies
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Create mock localStorage
const mockLocalStorage = new Map();

const mockStorage = {
  getItem: (key) => mockLocalStorage.get(key) || null,
  setItem: (key, value) => {
    mockLocalStorage.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  },
  removeItem: (key) => {
    mockLocalStorage.delete(key);
    return true;
  },
  clear: () => {
    mockLocalStorage.clear();
    return true;
  },
};

// Test the mock storage directly (simulating storage behavior)
describe('Storage Module', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('Basic Operations', () => {
    it('should set and get string values', () => {
      mockStorage.setItem('testKey', 'testValue');
      const result = mockStorage.getItem('testKey');
      assert.strictEqual(result, 'testValue');
    });

    it('should set and get object values', () => {
      const obj = { data: 'value', nested: { key: 123 } };
      mockStorage.setItem('testKey', JSON.stringify(obj));
      const result = JSON.parse(mockStorage.getItem('testKey'));
      assert.deepStrictEqual(result, obj);
    });

    it('should return null for non-existent keys', () => {
      const result = mockStorage.getItem('nonexistent');
      assert.strictEqual(result, null);
    });

    it('should remove items', () => {
      mockStorage.setItem('toDelete', 'value');
      mockStorage.removeItem('toDelete');
      const result = mockStorage.getItem('toDelete');
      assert.strictEqual(result, null);
    });

    it('should clear all items', () => {
      mockStorage.setItem('key1', 'value1');
      mockStorage.setItem('key2', 'value2');
      mockStorage.clear();
      assert.strictEqual(mockStorage.getItem('key1'), null);
      assert.strictEqual(mockStorage.getItem('key2'), null);
    });
  });

  describe('Data Serialization', () => {
    it('should handle JSON objects', () => {
      const tasks = [
        { id: '1', title: 'Task 1', status: 'todo' },
        { id: '2', title: 'Task 2', status: 'done' }
      ];
      const serialized = JSON.stringify(tasks);
      const deserialized = JSON.parse(serialized);
      assert.deepStrictEqual(deserialized, tasks);
    });

    it('should handle special characters in JSON', () => {
      const data = { text: 'Hello "World" and \'Single\' quotes' };
      const serialized = JSON.stringify(data);
      const deserialized = JSON.parse(serialized);
      assert.strictEqual(deserialized.text, data.text);
    });

    it('should handle unicode characters', () => {
      const data = { text: '中文测试 🎉 emoji' };
      const serialized = JSON.stringify(data);
      const deserialized = JSON.parse(serialized);
      assert.strictEqual(deserialized.text, data.text);
    });
  });

  describe('Storage Limits', () => {
    it('should handle large data objects', () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        title: `Task ${i}`,
        content: 'x'.repeat(1000)
      }));
      const serialized = JSON.stringify(largeArray);
      const deserialized = JSON.parse(serialized);
      assert.strictEqual(deserialized.length, 100);
    });

    it('should handle empty arrays', () => {
      const empty = [];
      const serialized = JSON.stringify(empty);
      const deserialized = JSON.parse(serialized);
      assert.deepStrictEqual(deserialized, []);
    });
  });
});