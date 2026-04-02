const { DiscordBot } = require('../src/main/discord-bot');

// Mock discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    login: jest.fn(async () => 'token'),
    destroy: jest.fn(async () => {}),
    user: { tag: 'TamuBot#1234', setActivity: jest.fn() },
    guilds: { cache: { first: jest.fn(() => null) } }
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    GuildMessageReactions: 4,
    DirectMessages: 8,
    DirectMessageReactions: 16
  },
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setColor: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    spliceFields: jest.fn().mockReturnThis()
  }))
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() }))
}));

function createMockActionEngine() {
  return {
    approve: jest.fn(async () => ({ number: 1 })),
    dismiss: jest.fn(async () => {}),
    getTodayStats: jest.fn(() => ({ suggested: 5, approved: 2, dismissed: 1, pending: 2 })),
    getPendingSuggestions: jest.fn(() => [])
  };
}

describe('DiscordBot', () => {
  const config = {
    botToken: 'test-token',
    channelId: '',
    dmMode: true,
    dailyDigestTime: '09:00'
  };

  describe('start', () => {
    it('logs into Discord when token provided', async () => {
      const bot = new DiscordBot(config, createMockActionEngine());
      await bot.start();

      expect(bot.client).not.toBeNull();
      expect(bot.client.login).toHaveBeenCalledWith('test-token');
    });

    it('skips login when no token', async () => {
      const bot = new DiscordBot({ ...config, botToken: '' }, createMockActionEngine());
      await bot.start();

      expect(bot.client).toBeNull();
    });
  });

  describe('stop', () => {
    it('destroys client on stop', async () => {
      const bot = new DiscordBot(config, createMockActionEngine());
      await bot.start();
      await bot.stop();

      expect(bot.client.destroy).toHaveBeenCalled();
    });
  });

  describe('updateActivity', () => {
    it('sets Discord activity based on pet state', async () => {
      const bot = new DiscordBot(config, createMockActionEngine());
      await bot.start();

      bot.updateActivity('thinking');
      expect(bot.client.user.setActivity).toHaveBeenCalledWith(
        'Analyzing your projects...', { type: 3 }
      );
    });
  });

  describe('sendSuggestion', () => {
    it('returns null when no channel configured', async () => {
      const bot = new DiscordBot(config, createMockActionEngine());
      await bot.start();
      // channel is null because no guild found in mock
      const result = await bot.sendSuggestion({
        id: 'sug_1', type: 'create-issue', projectName: 'proj', title: 'Test', description: 'desc'
      });
      expect(result).toBeNull();
    });
  });
});
