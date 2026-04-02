const { Octokit } = require('@octokit/rest');

class GitHubClient {
  constructor(token) {
    this.token = token;
    this.octokit = token ? new Octokit({ auth: token }) : null;
  }

  isConfigured() {
    return !!this.token && !!this.octokit;
  }

  updateToken(token) {
    this.token = token;
    this.octokit = token ? new Octokit({ auth: token }) : null;
  }

  async getRepoInfo(ownerRepo) {
    if (!this.isConfigured() || !ownerRepo) return null;

    const [owner, repo] = ownerRepo.split('/');
    try {
      const { data } = await this.octokit.repos.get({ owner, repo });
      return {
        openIssuesCount: data.open_issues_count,
        lastPush: data.pushed_at,
        defaultBranch: data.default_branch,
        description: data.description
      };
    } catch (err) {
      console.error(`GitHub: Failed to get repo ${ownerRepo}:`, err.message);
      return null;
    }
  }

  async getOpenIssues(ownerRepo, limit = 10) {
    if (!this.isConfigured() || !ownerRepo) return [];

    const [owner, repo] = ownerRepo.split('/');
    try {
      const { data } = await this.octokit.issues.listForRepo({
        owner, repo, state: 'open', per_page: limit, sort: 'updated'
      });
      return data.map(issue => ({
        number: issue.number,
        title: issue.title,
        labels: issue.labels.map(l => l.name),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at
      }));
    } catch (err) {
      console.error(`GitHub: Failed to list issues for ${ownerRepo}:`, err.message);
      return [];
    }
  }

  async createIssue(ownerRepo, title, body, labels = []) {
    if (!this.isConfigured() || !ownerRepo) {
      throw new Error('GitHub not configured or no repo specified');
    }

    const [owner, repo] = ownerRepo.split('/');
    try {
      const { data } = await this.octokit.issues.create({
        owner, repo, title, body,
        labels: labels.length > 0 ? labels : ['tamugatchi-suggestion']
      });
      return {
        number: data.number,
        url: data.html_url,
        title: data.title
      };
    } catch (err) {
      console.error(`GitHub: Failed to create issue on ${ownerRepo}:`, err.message);
      throw err;
    }
  }

  async getOpenPRs(ownerRepo, limit = 5) {
    if (!this.isConfigured() || !ownerRepo) return [];

    const [owner, repo] = ownerRepo.split('/');
    try {
      const { data } = await this.octokit.pulls.list({
        owner, repo, state: 'open', per_page: limit, sort: 'updated'
      });
      return data.map(pr => ({
        number: pr.number,
        title: pr.title,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        draft: pr.draft
      }));
    } catch (err) {
      console.error(`GitHub: Failed to list PRs for ${ownerRepo}:`, err.message);
      return [];
    }
  }
}

module.exports = { GitHubClient };
