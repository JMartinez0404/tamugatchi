const cron = require('node-cron');
const { execSync } = require('child_process');
const { PET_STATES } = require('../shared/config');

class Scheduler {
  constructor(store, projectScanner, ollamaClient, actionEngine) {
    this.store = store;
    this.projectScanner = projectScanner;
    this.ollamaClient = ollamaClient;
    this.actionEngine = actionEngine;
    this.job = null;
    this.dailyPlanJob = null;
    this.running = false;
    this.planningRunning = false;
  }

  start() {
    const minutes = this.store.get('checkIntervalMinutes', 30);
    const cronExpr = `*/${minutes} * * * *`;

    this.job = cron.schedule(cronExpr, () => this._runCheck());

    // Daily planning — runs once per day at the start of active hours
    const activeStart = this.store.get('activeHours.start', 9);
    this.dailyPlanJob = cron.schedule(`0 ${activeStart} * * *`, () => this._runDailyPlan());

    // Run initial check after 30 seconds
    setTimeout(() => this._runCheck(), 30000);

    // Run daily plan if it hasn't run today
    const lastPlanDate = this.store.get('lastDailyPlanDate', '');
    const today = new Date().toISOString().slice(0, 10);
    console.log(`Last daily plan: ${lastPlanDate}, today: ${today}`);
    if (lastPlanDate !== today) {
      console.log('Daily plan not yet run today — scheduling in 60s');
      setTimeout(() => this._runDailyPlan(), 60000);
    }

    console.log(`Scheduler started: checking every ${minutes} min, daily plan at ${activeStart}:00`);
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    if (this.dailyPlanJob) {
      this.dailyPlanJob.stop();
      this.dailyPlanJob = null;
    }
    this.running = false;
    this.planningRunning = false;
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
      console.log(`Ollama available: ${ollamaAvailable}, projects: ${projects.length}`);
      if (ollamaAvailable && projects.length > 0) {
        const suggestions = await this.ollamaClient.generateSuggestions(projects);
        console.log(`Ollama returned ${suggestions.length} suggestions`);
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

  _findStaleProjects(projects, staleDays = 5) {
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

  async _runDailyPlan() {
    if (this.planningRunning) return;
    if (!this._isActiveHours()) return;

    const ollamaAvailable = await this.ollamaClient.isAvailable();
    if (!ollamaAvailable) {
      console.log('Daily plan skipped: Ollama not available');
      return;
    }

    this.planningRunning = true;
    this.actionEngine._setPetState(PET_STATES.THINKING);
    console.log('Starting daily project planning...');

    try {
      const projects = this.projectScanner.scanDirectories();
      await this._enrichWithGitHub(projects);

      const githubClient = this.actionEngine.githubClient;

      for (const project of projects) {
        // Gather extra context for deeper analysis
        project.recentCommits = this._getRecentCommits(project.path, 10);

        if (githubClient?.isConfigured() && project.githubRepo) {
          try {
            project.openIssues = await githubClient.getOpenIssues(project.githubRepo, 10);
          } catch {
            project.openIssues = [];
          }
        }

        // Generate plan for this project
        const planItems = await this.ollamaClient.generateDailyPlan(project);
        console.log(`Daily plan for ${project.name}: ${planItems.length} suggestions`);

        for (const item of planItems) {
          await this.actionEngine.propose(item);
        }
      }

      this.store.set('lastDailyPlanDate', new Date().toISOString().slice(0, 10));

      const pending = this.actionEngine.getPendingSuggestions();
      if (pending.length > 0) {
        this.actionEngine._setPetState(PET_STATES.EXCITED);
      } else {
        this.actionEngine._setPetState(PET_STATES.IDLE);
      }
    } catch (err) {
      console.error('Daily planning failed:', err.message);
      this.actionEngine._setPetState(PET_STATES.IDLE);
    } finally {
      this.planningRunning = false;
    }
  }

  _getRecentCommits(repoPath, count = 10) {
    try {
      const output = execSync(
        `git log --oneline -${count} --no-decorate`,
        { cwd: repoPath, encoding: 'utf8', timeout: 5000 }
      ).trim();
      return output ? output.split('\n') : [];
    } catch {
      return [];
    }
  }

  _isActiveHours() {
    const { start, end } = this.store.get('activeHours', { start: 9, end: 18 });
    const hour = new Date().getHours();
    return hour >= start && hour < end;
  }
}

module.exports = { Scheduler };
