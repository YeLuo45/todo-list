// L2: Episodic Memory - stores task execution contexts
const EPISODIC_KEY = 'hermes_episodic_v1';

export const episodicMemory = {
  saveEpisode(task, context = {}) {
    const episodes = this.getAll();
    const episode = {
      id: crypto.randomUUID(),
      taskId: task.id,
      taskTitle: task.title,
      createdAt: new Date().toISOString(),
      context, // { source, externalUrl, agent }
    };
    episodes.unshift(episode); // newest first
    // Keep last 100 episodes
    const trimmed = episodes.slice(0, 100);
    localStorage.setItem(EPISODIC_KEY, JSON.stringify(trimmed));
    return episode;
  },
  
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(EPISODIC_KEY) || '[]');
    } catch { return []; }
  },
  
  getRecent(count = 10) {
    return this.getAll().slice(0, count);
  },
  
  searchEpisodes(query) {
    const q = query.toLowerCase();
    return this.getAll().filter(e => 
      e.taskTitle.toLowerCase().includes(q) ||
      e.taskId.includes(q)
    );
  },
  
  getByTaskId(taskId) {
    return this.getAll().filter(e => e.taskId === taskId);
  }
};