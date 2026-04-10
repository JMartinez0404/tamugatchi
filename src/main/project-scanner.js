const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ProjectScanner {
  constructor(store) {
    this.store = store;
  }

  scanDirectories() {
    const dirs = this.store.get('scanDirectories', []);
    const manualProjects = this.store.get('trackedProjects', [])
      .filter(p => p.manuallyAdded);

    const excludedPaths = new Set(this.store.get('excludedProjects', []));

    const discovered = [];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      discovered.push(...this._findGitRepos(dir, 2));
    }

    // Merge discovered + manual, dedup by path, skip excluded
    const allPaths = new Set();
    const projects = [];

    for (const proj of [...manualProjects, ...discovered]) {
      if (!allPaths.has(proj.path) && !excludedPaths.has(proj.path)) {
        allPaths.add(proj.path);
        projects.push(proj);
      }
    }

    this.store.set('trackedProjects', projects);
    return projects;
  }

  _findGitRepos(dir, maxDepth, currentDepth = 0) {
    if (currentDepth > maxDepth) return [];
    const repos = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(dir, entry.name);
        const gitPath = path.join(fullPath, '.git');

        if (fs.existsSync(gitPath)) {
          repos.push(this._analyzeRepo(fullPath));
        } else {
          repos.push(...this._findGitRepos(fullPath, maxDepth, currentDepth + 1));
        }
      }
    } catch {
      // Permission denied or inaccessible — skip
    }

    return repos;
  }

  _analyzeRepo(repoPath) {
    const name = path.basename(repoPath);
    let lastCommitDate = null;
    let githubRemote = null;

    try {
      const dateStr = execSync('git log -1 --format=%cI', {
        cwd: repoPath, encoding: 'utf8', timeout: 5000
      }).trim();
      lastCommitDate = dateStr || null;
    } catch {
      lastCommitDate = null;
    }

    try {
      const remote = execSync('git remote get-url origin', {
        cwd: repoPath, encoding: 'utf8', timeout: 5000
      }).trim();
      githubRemote = this._parseGitHubRemote(remote);
    } catch {
      githubRemote = null;
    }

    const hasBacklog = this._hasBacklogFile(repoPath);
    const backlogItems = hasBacklog ? this._readBacklog(repoPath) : [];

    return {
      name,
      path: repoPath,
      githubRepo: githubRemote,
      lastChecked: new Date().toISOString(),
      lastCommitDate,
      openIssuesCount: 0,
      hasBacklog,
      backlogItems,
      manuallyAdded: false
    };
  }

  _parseGitHubRemote(remote) {
    // Match github.com/owner/repo from HTTPS or SSH URLs
    const match = remote.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    return match ? `${match[1]}/${match[2]}` : null;
  }

  _hasBacklogFile(repoPath) {
    const names = ['BACKLOG.md', 'TODO.md', 'backlog.md', 'todo.md', 'FEATURES.md'];
    return names.some(n => fs.existsSync(path.join(repoPath, n)));
  }

  _readBacklog(repoPath) {
    const names = ['BACKLOG.md', 'TODO.md', 'backlog.md', 'todo.md', 'FEATURES.md'];
    for (const name of names) {
      const filePath = path.join(repoPath, name);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          // Extract list items
          return content.split('\n')
            .filter(line => /^[\s]*[-*]\s/.test(line))
            .map(line => line.replace(/^[\s]*[-*]\s+/, '').trim())
            .filter(Boolean)
            .slice(0, 20);
        } catch {
          return [];
        }
      }
    }
    return [];
  }

  async getProjectDetails(project) {
    return this._analyzeRepo(project.path);
  }
}

module.exports = { ProjectScanner };
