import { episodicMemory } from './episodicMemory.js';
import { semanticMemory } from './semanticMemory.js';
import { metacognition } from './metacognition.js';

export const memoryManager = {
  episodic: episodicMemory,
  semantic: semanticMemory,
  meta: metacognition,
  
  // Initialize: abstract patterns from tasks
  initialize(tasks) {
    this.semantic.abstractPatterns(tasks);
  },
  
  // On task create: save episode, update patterns
  onTaskCreate(task, context = {}) {
    this.episodic.saveEpisode(task, context);
    this.semantic.abstractPatterns([task]);
  },
  
  // Get insights for dashboard
  getInsights(tasks) {
    const stats = this.meta.getStats(tasks);
    const topHabits = this.semantic.getTopHabits(5);
    const streak = this.meta.getStreakDays(tasks);
    return { stats, topHabits, streak };
  }
};