const path = require('path');
const fs = require('fs');
const { ProjectScanner } = require('../src/main/project-scanner');

function createMockStore(data = {}) {
  const store = {
    scanDirectories: [],
    trackedProjects: [],
    ...data
  };
  return {
    get: jest.fn((key, def) => store[key] ?? def),
    set: jest.fn((key, val) => { store[key] = val; })
  };
}

describe('ProjectScanner', () => {
  let scanner, store;

  beforeEach(() => {
    store = createMockStore();
    scanner = new ProjectScanner(store);
  });

  describe('_parseGitHubRemote', () => {
    it('parses HTTPS remote', () => {
      const result = scanner._parseGitHubRemote('https://github.com/user/repo.git');
      expect(result).toBe('user/repo');
    });

    it('parses SSH remote', () => {
      const result = scanner._parseGitHubRemote('git@github.com:user/repo.git');
      expect(result).toBe('user/repo');
    });

    it('returns null for non-GitHub remotes', () => {
      const result = scanner._parseGitHubRemote('https://gitlab.com/user/repo.git');
      expect(result).toBeNull();
    });
  });

  describe('_hasBacklogFile', () => {
    it('returns true when BACKLOG.md exists', () => {
      const tmpDir = path.join(__dirname, '__tmp_test');
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'BACKLOG.md'), '# Backlog\n- Item 1');

      expect(scanner._hasBacklogFile(tmpDir)).toBe(true);

      fs.rmSync(tmpDir, { recursive: true });
    });

    it('returns false when no backlog file exists', () => {
      const tmpDir = path.join(__dirname, '__tmp_test2');
      fs.mkdirSync(tmpDir, { recursive: true });

      expect(scanner._hasBacklogFile(tmpDir)).toBe(false);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe('_readBacklog', () => {
    it('extracts list items from markdown', () => {
      const tmpDir = path.join(__dirname, '__tmp_test3');
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'TODO.md'),
        '# TODO\n\n- Add auth\n- Fix login bug\n* Improve perf\n\nSome text'
      );

      const items = scanner._readBacklog(tmpDir);
      expect(items).toEqual(['Add auth', 'Fix login bug', 'Improve perf']);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe('scanDirectories', () => {
    it('returns empty array when no directories configured', () => {
      const projects = scanner.scanDirectories();
      expect(projects).toEqual([]);
    });

    it('preserves manually added projects', () => {
      const manualProject = {
        name: 'manual-proj',
        path: '/some/path',
        manuallyAdded: true
      };
      store.trackedProjects = [manualProject];
      store = createMockStore({ trackedProjects: [manualProject] });
      scanner = new ProjectScanner(store);

      const projects = scanner.scanDirectories();
      expect(projects).toContainEqual(expect.objectContaining({ name: 'manual-proj' }));
    });
  });
});
