const { Scheduler } = require('../src/main/scheduler');

function createMockStore(overrides = {}) {
  const data = {
    checkIntervalMinutes: 30,
    activeHours: { start: 0, end: 24 },
    ...overrides
  };
  return {
    get: jest.fn((key, def) => data[key] ?? def),
    set: jest.fn()
  };
}

function createMockScanner(projects = []) {
  return {
    scanDirectories: jest.fn(() => projects)
  };
}

function createMockOllama(suggestions = []) {
  return {
    isAvailable: jest.fn(async () => true),
    generateSuggestions: jest.fn(async () => suggestions)
  };
}

function createMockActionEngine() {
  return {
    propose: jest.fn(async (s) => s),
    getPendingSuggestions: jest.fn(() => []),
    _setPetState: jest.fn(),
    githubClient: {
      isConfigured: jest.fn(() => false)
    }
  };
}

describe('Scheduler', () => {
  let scheduler;

  afterEach(() => {
    if (scheduler) scheduler.stop();
  });

  describe('_isActiveHours', () => {
    it('returns true during active hours', () => {
      const store = createMockStore({ activeHours: { start: 0, end: 24 } });
      scheduler = new Scheduler(store, null, null, null);
      expect(scheduler._isActiveHours()).toBe(true);
    });

    it('returns false outside active hours', () => {
      // Set active hours to a time that's definitely not now
      const hour = new Date().getHours();
      const store = createMockStore({
        activeHours: { start: (hour + 2) % 24, end: (hour + 3) % 24 }
      });
      scheduler = new Scheduler(store, null, null, null);
      expect(scheduler._isActiveHours()).toBe(false);
    });
  });

  describe('_findStaleProjects', () => {
    it('identifies projects with old commits', () => {
      const store = createMockStore();
      scheduler = new Scheduler(store, null, null, null);

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);

      const projects = [
        { name: 'stale', lastCommitDate: oldDate.toISOString() },
        { name: 'fresh', lastCommitDate: new Date().toISOString() }
      ];

      const stale = scheduler._findStaleProjects(projects, 14);
      expect(stale).toHaveLength(1);
      expect(stale[0].name).toBe('stale');
    });
  });

  describe('_runCheck', () => {
    it('scans projects and generates suggestions', async () => {
      const projects = [
        { name: 'proj', path: '/proj', lastCommitDate: new Date().toISOString(), githubRepo: null }
      ];
      const suggestions = [
        { id: 'sug_1', type: 'create-issue', projectName: 'proj', title: 'Add tests' }
      ];

      const store = createMockStore();
      const scanner = createMockScanner(projects);
      const ollama = createMockOllama(suggestions);
      const actionEngine = createMockActionEngine();

      scheduler = new Scheduler(store, scanner, ollama, actionEngine);
      await scheduler._runCheck();

      expect(scanner.scanDirectories).toHaveBeenCalled();
      expect(ollama.generateSuggestions).toHaveBeenCalledWith(projects);
      expect(actionEngine.propose).toHaveBeenCalled();
    });
  });
});
