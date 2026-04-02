const { ActionEngine } = require('../src/main/action-engine');
const { ACTION_TYPES, PET_STATES } = require('../src/shared/config');

function createMockStore() {
  const data = {};
  return {
    get: jest.fn((key, def) => data[key] ?? def),
    set: jest.fn((key, val) => { data[key] = val; })
  };
}

function createMockGitHubClient() {
  return {
    isConfigured: jest.fn(() => true),
    createIssue: jest.fn(async () => ({
      number: 42,
      url: 'https://github.com/test/repo/issues/42',
      title: 'Test Issue'
    }))
  };
}

function createMockPetWindow() {
  return {
    isDestroyed: jest.fn(() => false),
    webContents: {
      send: jest.fn()
    }
  };
}

function makeSuggestion(overrides = {}) {
  return {
    id: `sug_${Date.now()}`,
    type: ACTION_TYPES.CREATE_ISSUE,
    projectName: 'test-project',
    title: 'Add dark mode',
    description: 'Support dark theme for better UX',
    createdAt: new Date().toISOString(),
    status: 'pending',
    payload: { githubRepo: 'user/test-project' },
    ...overrides
  };
}

describe('ActionEngine', () => {
  let engine, store, githubClient, petWindow;

  beforeEach(() => {
    store = createMockStore();
    githubClient = createMockGitHubClient();
    petWindow = createMockPetWindow();
    engine = new ActionEngine(store, githubClient, petWindow);
  });

  describe('propose', () => {
    it('stores suggestion and notifies pet', async () => {
      const suggestion = makeSuggestion();
      await engine.propose(suggestion);

      expect(engine.getPendingSuggestions()).toHaveLength(1);
      expect(petWindow.webContents.send).toHaveBeenCalledWith('new-suggestion', suggestion);
    });

    it('sets pet state to excited', async () => {
      await engine.propose(makeSuggestion());

      expect(store.set).toHaveBeenCalledWith('currentPetState', PET_STATES.EXCITED);
    });
  });

  describe('approve', () => {
    it('executes create-issue and removes from pending', async () => {
      const suggestion = makeSuggestion();
      await engine.propose(suggestion);
      const result = await engine.approve(suggestion.id);

      expect(result).toEqual(expect.objectContaining({ number: 42 }));
      expect(engine.getPendingSuggestions()).toHaveLength(0);
      expect(githubClient.createIssue).toHaveBeenCalled();
    });

    it('returns null for non-pending suggestion', async () => {
      const result = await engine.approve('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('dismiss', () => {
    it('removes suggestion and sets pet sad', async () => {
      const suggestion = makeSuggestion();
      await engine.propose(suggestion);
      await engine.dismiss(suggestion.id);

      expect(engine.getPendingSuggestions()).toHaveLength(0);
      expect(store.set).toHaveBeenCalledWith('currentPetState', PET_STATES.SAD);
    });
  });

  describe('getTodayStats', () => {
    it('returns correct counts', async () => {
      const s1 = makeSuggestion({ id: 'sug_1' });
      const s2 = makeSuggestion({ id: 'sug_2' });
      const s3 = makeSuggestion({ id: 'sug_3' });

      await engine.propose(s1);
      await engine.propose(s2);
      await engine.propose(s3);

      await engine.approve(s1.id);
      await engine.dismiss(s2.id);

      const stats = engine.getTodayStats();
      expect(stats.approved).toBe(1);
      expect(stats.dismissed).toBe(1);
      expect(stats.pending).toBe(1);
    });
  });
});
