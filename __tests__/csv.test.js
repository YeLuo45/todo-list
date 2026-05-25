/**
 * CSV Utility Tests
 * Tests for parseCSV, generateCSV, generateICal, generateEPUB and helper functions
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Import the module - csv.js uses ES module exports
import * as csvModule from '../src/utils/csv.js';
const { parseCSV, generateCSV, generateICal, generateEPUB, generateJSON } = csvModule;

describe('CSV Module', () => {
  describe('parseCSV', () => {
    it('should parse valid CSV with all fields', () => {
      const csv = `title,content,tags,priority,status,dueDate
Test Task,This is content,work;urgent,P0,in-progress,2024-12-31`;
      
      const tasks = parseCSV(csv);
      
      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].title, 'Test Task');
      assert.strictEqual(tasks[0].content, 'This is content');
      assert.deepStrictEqual(tasks[0].tags, ['work', 'urgent']);
      assert.strictEqual(tasks[0].priority, 'P0');
      assert.strictEqual(tasks[0].status, 'in-progress');
      assert.strictEqual(tasks[0].dueDate, '2024-12-31');
    });

    it('should return empty array for empty input', () => {
      assert.deepStrictEqual(parseCSV(''), []);
      assert.deepStrictEqual(parseCSV('   '), []);
    });

    it('should return empty array for header-only CSV', () => {
      const csv = `title,content,tags,priority,status,dueDate`;
      assert.deepStrictEqual(parseCSV(csv), []);
    });

    it('should handle CSV with missing fields', () => {
      const csv = `title,content,tags,priority,status,dueDate
Test Task`;
      
      const tasks = parseCSV(csv);
      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].title, 'Test Task');
      assert.strictEqual(tasks[0].content, '');
      assert.strictEqual(tasks[0].priority, 'P1');
      assert.strictEqual(tasks[0].status, 'todo');
    });

    it('should handle quoted CSV fields with commas', () => {
      const csv = `title,content,tags,priority,status,dueDate
"Task with, comma","Content with, comma","tag1;tag2",P1,todo,2024-01-01`;
      
      const tasks = parseCSV(csv);
      assert.strictEqual(tasks[0].title, 'Task with, comma');
      assert.strictEqual(tasks[0].content, 'Content with, comma');
      assert.deepStrictEqual(tasks[0].tags, ['tag1', 'tag2']);
    });

    it('should handle escaped quotes inside quoted fields', () => {
      const csv = `title,content,tags,priority,status,dueDate
"Task with ""quotes""","Normal content","tag",P2,done,2024-06-15`;
      
      const tasks = parseCSV(csv);
      assert.strictEqual(tasks[0].title, 'Task with "quotes"');
    });

    it('should normalize priority values', () => {
      const testCases = [
        { input: 'high', expected: 'P0' },
        { input: 'medium', expected: 'P1' },
        { input: 'low', expected: 'P2' },
        { input: 'P0', expected: 'P0' },
        { input: 'invalid', expected: 'P1' },
        { input: '', expected: 'P1' },
      ];

      for (const tc of testCases) {
        const csv = `title,content,tags,priority,status,dueDate\nTask,content,,${tc.input},todo,`;
        const tasks = parseCSV(csv);
        assert.strictEqual(tasks[0].priority, tc.expected, `Input: ${tc.input}`);
      }
    });

    it('should normalize status values', () => {
      const testCases = [
        { input: 'todo', expected: 'todo' },
        { input: 'in-progress', expected: 'in-progress' },
        { input: 'done', expected: 'done' },
        { input: 'in progress', expected: 'in-progress' },
        { input: 'inprogress', expected: 'in-progress' },
        { input: 'invalid', expected: 'todo' },
        { input: '', expected: 'todo' },
      ];

      for (const tc of testCases) {
        const csv = `title,content,tags,priority,status,dueDate\nTask,content,,P1,${tc.input},`;
        const tasks = parseCSV(csv);
        assert.strictEqual(tasks[0].status, tc.expected, `Input: ${tc.input}`);
      }
    });

    it('should normalize date values', () => {
      const testCases = [
        { input: '2024-12-31', expected: '2024-12-31' },
        { input: '2024/12/31', expected: '2024-12-31' },
        { input: 'invalid', expected: null },
        { input: '', expected: null },
        { input: '2024-1-1', expected: null },
      ];

      for (const tc of testCases) {
        const csv = `title,content,tags,priority,status,dueDate\nTask,content,,P1,todo,${tc.input}`;
        const tasks = parseCSV(csv);
        assert.strictEqual(tasks[0].dueDate, tc.expected, `Input: ${tc.input}`);
      }
    });

    it('should skip rows with empty title', () => {
      const csv = `title,content,tags,priority,status,dueDate
Valid Task,content,,P1,todo,
,empty title row,,P2,done,2024-01-01
Another Valid,,P0,in-progress,`;
      
      const tasks = parseCSV(csv);
      assert.strictEqual(tasks.length, 2);
      assert.strictEqual(tasks[0].title, 'Valid Task');
      assert.strictEqual(tasks[1].title, 'Another Valid');
    });

    it('should handle multiple rows', () => {
      const csv = `title,content,tags,priority,status,dueDate
Task1,Content1,tag1,P0,todo,2024-01-01
Task2,Content2,tag2;tag3,P1,in-progress,2024-02-01
Task3,Content3,,P2,done,`;
      
      const tasks = parseCSV(csv);
      assert.strictEqual(tasks.length, 3);
      assert.strictEqual(tasks[0].title, 'Task1');
      assert.strictEqual(tasks[1].tags.length, 2);
      assert.strictEqual(tasks[2].dueDate, null);
    });

    it('should set default timestamps and metadata', () => {
      const csv = `title,content,tags,priority,status,dueDate
Task,Content,,P1,todo,2024-12-31`;
      
      const tasks = parseCSV(csv);
      assert.ok(tasks[0].createdAt);
      assert.ok(tasks[0].updatedAt);
      assert.ok(tasks[0].generatedDate);
      assert.strictEqual(tasks[0].recurrence, null);
      assert.strictEqual(tasks[0].parentId, null);
      assert.strictEqual(tasks[0].reminded, false);
    });
  });

  describe('generateCSV', () => {
    it('should generate valid CSV from tasks', () => {
      const tasks = [
        {
          title: 'Test Task',
          content: 'Content here',
          tags: ['work', 'urgent'],
          priority: 'P0',
          status: 'todo',
          dueDate: '2024-12-31'
        }
      ];

      const csv = generateCSV(tasks);
      const lines = csv.split('\n');
      
      assert.ok(lines[0].includes('title'));
      assert.ok(lines[0].includes('content'));
      assert.ok(lines[0].includes('tags'));
      assert.strictEqual(lines[1].includes('Test Task'), true);
    });

    it('should handle empty tasks array', () => {
      const csv = generateCSV([]);
      assert.strictEqual(csv, 'title,content,tags,priority,status,dueDate');
    });

    it('should escape fields with commas', () => {
      const tasks = [
        { title: 'Task, with comma', content: 'Normal', tags: [], priority: 'P1', status: 'todo', dueDate: '' }
      ];

      const csv = generateCSV(tasks);
      assert.strictEqual(csv.includes('"Task, with comma"'), true);
    });

    it('should escape fields with quotes', () => {
      const tasks = [
        { title: 'Task "quoted"', content: 'Normal', tags: [], priority: 'P1', status: 'todo', dueDate: '' }
      ];

      const csv = generateCSV(tasks);
      assert.strictEqual(csv.includes('"Task ""quoted"""'), true);
    });

    it('should escape fields with newlines', () => {
      const tasks = [
        { title: 'Task\nWith\nNewlines', content: 'Normal', tags: [], priority: 'P1', status: 'todo', dueDate: '' }
      ];

      const csv = generateCSV(tasks);
      assert.strictEqual(csv.includes('"Task\nWith\nNewlines"'), true);
    });

    it('should join tags with semicolon', () => {
      const tasks = [
        { title: 'Task', content: '', tags: ['tag1', 'tag2', 'tag3'], priority: 'P1', status: 'todo', dueDate: '' }
      ];

      const csv = generateCSV(tasks);
      assert.strictEqual(csv.includes('tag1;tag2;tag3'), true);
    });

    it('should handle missing optional fields', () => {
      const tasks = [
        { title: 'Task' }
      ];

      const csv = generateCSV(tasks);
      assert.ok(csv.includes('Task'));
      assert.strictEqual(csv.includes('P1'), true);
      assert.strictEqual(csv.includes('todo'), true);
    });
  });

  describe('generateJSON', () => {
    it('should generate valid JSON', () => {
      const tasks = [{ title: 'Task', content: 'Content' }];
      const json = generateJSON(tasks);
      
      const parsed = JSON.parse(json);
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].title, 'Task');
    });

    it('should format JSON with indentation', () => {
      const tasks = [{ title: 'Task' }];
      const json = generateJSON(tasks);
      assert.ok(json.includes('\n'));
    });
  });

  describe('generateICal', () => {
    it('should generate valid iCal format with tasks', () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Test Task',
          content: 'Description',
          tags: ['work'],
          priority: 'P1',
          status: 'todo',
          dueDate: '2024-12-31'
        }
      ];

      const ical = generateICal(tasks);
      
      assert.ok(ical.includes('BEGIN:VCALENDAR'));
      assert.ok(ical.includes('END:VCALENDAR'));
      assert.ok(ical.includes('BEGIN:VEVENT'));
      assert.ok(ical.includes('END:VEVENT'));
      assert.ok(ical.includes('SUMMARY:Test Task'));
      assert.ok(ical.includes('DTSTART;VALUE=DATE:20241231'));
    });

    it('should skip tasks without dueDate', () => {
      const tasks = [
        { id: 'task-1', title: 'No Date Task', content: '', tags: [], priority: 'P1', status: 'todo', dueDate: null }
      ];

      const ical = generateICal(tasks);
      
      assert.ok(ical.includes('BEGIN:VCALENDAR'));
      assert.ok(ical.includes('END:VCALENDAR'));
      assert.ok(!ical.includes('BEGIN:VEVENT'));
    });

    it('should handle tasks with @ in id', () => {
      const tasks = [
        { id: 'task@domain.com', title: 'Task', content: '', tags: [], priority: 'P1', status: 'todo', dueDate: '2024-06-15' }
      ];

      const ical = generateICal(tasks);
      
      assert.ok(ical.includes('UID:task@domain.com'));
    });

    it('should map priority correctly', () => {
      const testCases = [
        { priority: 'P0', expected: '1' },
        { priority: 'P1', expected: '5' },
        { priority: 'P2', expected: '9' },
      ];

      for (const tc of testCases) {
        const tasks = [{
          id: `task-${tc.priority}`,
          title: `Task ${tc.priority}`,
          content: '',
          tags: [],
          priority: tc.priority,
          status: 'todo',
          dueDate: '2024-06-15'
        }];

        const ical = generateICal(tasks);
        assert.ok(ical.includes(`PRIORITY:${tc.expected}`), `Priority ${tc.priority} should map to ${tc.expected}`);
      }
    });

    it('should include categories for tags', () => {
      const tasks = [{
        id: 'task-1',
        title: 'Task',
        content: '',
        tags: ['work', 'urgent'],
        priority: 'P1',
        status: 'todo',
        dueDate: '2024-06-15'
      }];

      const ical = generateICal(tasks);
      assert.ok(ical.includes('CATEGORIES:work,urgent'));
    });

    it('should include description for content', () => {
      const tasks = [{
        id: 'task-1',
        title: 'Task',
        content: 'This is a description',
        tags: [],
        priority: 'P1',
        status: 'todo',
        dueDate: '2024-06-15'
      }];

      const ical = generateICal(tasks);
      assert.ok(ical.includes('DESCRIPTION:This is a description'));
    });

    it('should escape special iCal characters', () => {
      const tasks = [{
        id: 'task-1',
        title: 'Task; with; semicolons',
        content: 'New\nLine\\Backslash,Comma',
        tags: [],
        priority: 'P1',
        status: 'todo',
        dueDate: '2024-06-15'
      }];

      const ical = generateICal(tasks);
      assert.ok(ical.includes('SUMMARY:Task\\; with\\; semicolons'));
      assert.ok(ical.includes('DESCRIPTION:New\\nLine\\\\Backslash\\,Comma'));
    });

    // Recurring task tests use future dates to avoid being filtered out
    // The code filters out past dates, so we use dates 1 year in the future
    it('should handle recurring tasks with future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const tasks = [{
        id: 'task-1',
        title: 'Weekly Task',
        content: '',
        tags: [],
        priority: 'P1',
        status: 'todo',
        dueDate: futureDateStr,
        recurrence: 'weekly',
        isRecurring: true
      }];

      const ical = generateICal(tasks);
      assert.ok(ical.includes('BEGIN:VEVENT'));
      assert.ok(ical.includes('RRULE:FREQ=WEEKLY'));
    });

    it('should handle daily recurrence with future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const tasks = [{
        id: 'task-1',
        title: 'Daily Task',
        content: '',
        tags: [],
        priority: 'P1',
        status: 'todo',
        dueDate: futureDateStr,
        recurrence: 'daily',
        isRecurring: true
      }];

      const ical = generateICal(tasks);
      assert.ok(ical.includes('FREQ=DAILY'));
    });

    it('should handle biweekly recurrence with future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const tasks = [{
        id: 'task-1',
        title: 'Biweekly Task',
        content: '',
        tags: [],
        priority: 'P1',
        status: 'todo',
        dueDate: futureDateStr,
        recurrence: 'biweekly',
        isRecurring: true
      }];

      const ical = generateICal(tasks);
      assert.ok(ical.includes('FREQ=WEEKLY'));
      assert.ok(ical.includes('INTERVAL=2'));
    });

    it('should handle monthly recurrence with future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const tasks = [{
        id: 'task-1',
        title: 'Monthly Task',
        content: '',
        tags: [],
        priority: 'P1',
        status: 'todo',
        dueDate: futureDateStr,
        recurrence: 'monthly',
        isRecurring: true
      }];

      const ical = generateICal(tasks);
      assert.ok(ical.includes('FREQ=MONTHLY'));
    });

    it('should handle weekdays recurrence with future dates', () => {
      // Note: weekdays expansion generates individual instances without RRULE
      // because recurrence is expanded inline (Mon-Fri for each week)
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const tasks = [{
        id: 'task-1',
        title: 'Weekdays Task',
        content: '',
        tags: [],
        priority: 'P1',
        status: 'todo',
        dueDate: futureDateStr,
        recurrence: 'weekdays',
        isRecurring: true
      }];

      const ical = generateICal(tasks);
      // weekdays expansion creates instances but no RRULE (expanded inline)
      assert.ok(ical.includes('BEGIN:VEVENT'));
    });

    it('should use CRLF line endings', () => {
      const tasks = [{
        id: 'task-1',
        title: 'Task',
        content: '',
        tags: [],
        priority: 'P1',
        status: 'todo',
        dueDate: '2024-06-15'
      }];

      const ical = generateICal(tasks);
      assert.ok(ical.includes('\r\n'));
    });

    it('should include PRODID and VERSION', () => {
      const tasks = [{
        id: 'task-1',
        title: 'Task',
        content: '',
        tags: [],
        priority: 'P1',
        status: 'todo',
        dueDate: '2024-06-15'
      }];

      const ical = generateICal(tasks);
      assert.ok(ical.includes('PRODID:-//Hermes TodoList//EN'));
      assert.ok(ical.includes('VERSION:2.0'));
    });
  });

  describe('generateEPUB', () => {
    it('should export function exists', () => {
      assert.ok(typeof generateEPUB === 'function');
    });
  });

  describe('Helper Functions (via parseCSV and generateCSV coverage)', () => {
    it('should handle whitespace in headers', () => {
      const csv = `  title  ,  content  ,  tags  ,  priority  ,  status  ,  dueDate  
Task,Content,,P1,todo,2024-01-01`;
      
      const tasks = parseCSV(csv);
      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].title, 'Task');
    });

    it('should handle various priority case variations', () => {
      const testCases = ['HIGH', 'Medium', 'Low', 'P0', 'p1', 'P2'];
      
      for (const p of testCases) {
        const csv = `title,content,tags,priority,status,dueDate\nT,,,${p},,`;
        const tasks = parseCSV(csv);
        assert.ok(['P0', 'P1', 'P2'].includes(tasks[0].priority), `Priority ${p} should normalize`);
      }
    });
  });
});
