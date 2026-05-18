// L3: Semantic Memory - extracts patterns from tasks
const SEMANTIC_KEY = 'hermes_semantic_v1';

export const semanticMemory = {
  savePattern(pattern) {
    const patterns = this.getAll();
    const idx = patterns.findIndex(p => p.name === pattern.name);
    if (idx >= 0) {
      patterns[idx] = { ...patterns[idx], ...pattern, updatedAt: new Date().toISOString() };
    } else {
      patterns.push({ ...pattern, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    }
    localStorage.setItem(SEMANTIC_KEY, JSON.stringify(patterns));
  },
  
  getAll() {
    try { return JSON.parse(localStorage.getItem(SEMANTIC_KEY) || '[]'); } catch { return []; }
  },
  
  // Abstract patterns from task history
  abstractPatterns(tasks) {
    const patterns = [];
    const titleCounts = {};
    
    tasks.forEach(t => {
      // Normalize title (lowercase, remove numbers)
      const normalized = t.title.toLowerCase().replace(/\d+/g, '').trim();
      titleCounts[normalized] = titleCounts[normalized] || { count: 0, task: t };
      titleCounts[normalized].count++;
    });
    
    // Find recurring tasks (created 3+ times)
    Object.values(titleCounts).forEach(({ count, task }) => {
      if (count >= 3) {
        this.savePattern({
          name: task.title,
          normalizedName: task.title.toLowerCase(),
          type: 'recurring',
          frequency: count,
          avgInterval: null, // could calculate if we track dates
          suggestedPriority: task.priority,
          suggestedTags: task.tags,
        });
      }
    });
    
    return this.getAll().filter(p => p.type === 'recurring');
  },
  
  getHabitScore(taskTitle) {
    const patterns = this.getAll();
    const match = patterns.find(p => 
      p.normalizedName === taskTitle.toLowerCase() || 
      taskTitle.toLowerCase().includes(p.normalizedName)
    );
    return match ? Math.min(match.frequency / 10, 1) : 0; // 0-1 score
  },
  
  getTopHabits(count = 5) {
    return this.getAll()
      .filter(p => p.type === 'recurring')
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, count);
  }
};