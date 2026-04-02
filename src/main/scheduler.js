const cron = require('node-cron');
const { PET_STATES } = require('../shared/config');

class Scheduler {
  constructor(store, projectScanner, ollamaClient, actionEngine) {
    this.store = store;
    this.projectScanner = projectScanner;
    this.ollamaClient = ollamaClient;
    this.actionEngine = actionEngine;
    this.job = null;
    this.running = false;
  }

  start() {
    const minutes = this.store.get('checkIntervalMinutes', 30);
    const cronExpr = `*/${minutes} * * * *`;

    this.job = cron.schedule(cronExpr, () => this._runCheck());

    // Run initial check after 30 seconds
    setTimeout(() => this._runCheck(), 30000);

    console.log(`Scheduler started: checking every ${minutes} minutes`);
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    this.running = false;
    console.log('Scheduler stopped');
  }

  async _runCheck() {
    if (this.running) return;
    if (!this._isActiveHours()) {
      this.actionEngine._setPetState(PET_STATES.SLEEPING);
      return;
    }

    this.running = true;
    this.actionEngine._setPetState(PET_STATES.THINKING);

    try {
      // 1. Scan for projects
      const projects = this.projectScanner.scanDirectories();
      console.log(`Scanned ${projects.length} projects`);

      // 2. Enrich with GitHub data
      await this._enrichWithGitHub(projects);

      // 3. Check for stale projects
      const staleProjects = this._findStaleProjects(projects);
      for (const stale of staleProjects) {
        await this.actionEngine.propose({
          id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'notify',
          projectName: stale.name,
          title: `${stale.name} hasn't been updated recently`,
          description: `Last commit was ${stale.daysSinceCommit} days ago. Consider reviewing the backlog or archiving if no longer active.`,
          createdAt: new Date().toISOString(),
          status: 'pending',
          payload: { githubRepo: stale.githubRepo }
        });
      }

      // 4. Get AI suggestions from Ollama
      const ollamaAvailable = await this.ollamaClient.isAvailable();
      if (ollamaAvailable && projects.length > 0) {
        const suggestions = await this.ollamaClient.generateSuggestions(projects);
        for (const suggestion of suggestions) {
          await this.actionEngine.propose(suggestion);
        }
      }

      // 5. Return to idle
      const pending = this.actionEngine.getPendingSuggestions();
      if (pending.length > 0) {
        this.actionEngine._setPetState(PET_STATES.EXCITED);
      } else {
        this.actionEngine._setPetState(PET_STATES.IDLE);
      }
    } catch (err) {
      console.error('Scheduled check failed:', err.message);
      this.actionEngine._setPetState(PET_STATES.IDLE);
    } finally {
      this.running = false;
    }
  }

  async _enrichWithGitHub(projects) {
    const githubClient = this.actionEngine.githubClient;
    if (!githubClient?.isConfigured()) return;

    for (const project of projects) {
      if (!project.githubRepo) continue;
      try {
        const info = await githubClient.getRepoInfo(project.githubRepo);
        if (info) {
          project.openIssuesCount = info.openIssuesCount;
        }
      } catch {
        // Skip failed GitHub lookups
      }
    }
  }

  _findStaleProjects(projects, staleDays = 14) {
    return projects
      .filter(p => p.lastCommitDate)
      .map(p => ({
        ...p,
        daysSinceCommit: Math.floor(
          (Date.now() - new Date(p.lastCommitDate)) / (1000 * 60 * 60 * 24)
        )
      }))
      .filter(p => p.daysSinceCommit > staleDays);
  }

  _isActiveHours() {
    const { start, end } = this.store.get('activeHours', { start: 9, end: 18 });
    const hour = new Date().getHours();
    return hour >= start && hour < end;
  }
}

module.exports = { Scheduler };
