jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    repos: { get: jest.fn() },
    issues: { listForRepo: jest.fn(), create: jest.fn() },
    pulls: { list: jest.fn() }
  }))
}));

const { GitHubClient } = require('../src/main/github-client');

describe('GitHubClient', () => {
  describe('isConfigured', () => {
    it('returns false when no token', () => {
      const client = new GitHubClient('');
      expect(client.isConfigured()).toBe(false);
    });

    it('returns true with token', () => {
      const client = new GitHubClient('ghp_test123');
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe('updateToken', () => {
    it('updates the token and recreates client', () => {
      const client = new GitHubClient('');
      expect(client.isConfigured()).toBe(false);

      client.updateToken('ghp_new');
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe('getRepoInfo', () => {
    it('returns null when not configured', async () => {
      const client = new GitHubClient('');
      const result = await client.getRepoInfo('user/repo');
      expect(result).toBeNull();
    });

    it('returns null when no ownerRepo', async () => {
      const client = new GitHubClient('ghp_test');
      const result = await client.getRepoInfo(null);
      expect(result).toBeNull();
    });
  });

  describe('getOpenIssues', () => {
    it('returns empty array when not configured', async () => {
      const client = new GitHubClient('');
      const result = await client.getOpenIssues('user/repo');
      expect(result).toEqual([]);
    });
  });

  describe('getOpenPRs', () => {
    it('returns empty array when not configured', async () => {
      const client = new GitHubClient('');
      const result = await client.getOpenPRs('user/repo');
      expect(result).toEqual([]);
    });
  });
});
