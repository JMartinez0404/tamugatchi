const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');

class DiscordBot {
  constructor(config, actionEngine) {
    this.config = config;
    this.actionEngine = actionEngine;
    this.client = null;
    this.channel = null;
    this.digestJob = null;
    this.suggestionMessages = new Map(); // messageId -> suggestionId
  }

  async start() {
    if (!this.config.botToken) {
      console.log('Discord bot: No token configured, skipping');
      return;
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions
      ]
    });

    this.client.on('ready', () => {
      console.log(`Discord bot logged in as ${this.client.user.tag}`);
      this.client.user.setActivity('Watching your projects', { type: 3 });
      this._setupChannel();
      this._startDailyDigest();
    });

    this.client.on('messageReactionAdd', (reaction, user) => {
      this._handleReaction(reaction, user);
    });

    try {
      await this.client.login(this.config.botToken);
    } catch (err) {
      console.error('Discord bot login failed:', err.message);
    }
  }

  async stop() {
    if (this.digestJob) this.digestJob.stop();
    if (this.client) await this.client.destroy();
  }

  async _setupChannel() {
    if (this.config.dmMode) {
      // DM the bot owner (first guild owner found)
      const guild = this.client.guilds.cache.first();
      if (guild) {
        const owner = await guild.fetchOwner();
        this.channel = await owner.createDM();
      }
    } else if (this.config.channelId) {
      this.channel = await this.client.channels.fetch(this.config.channelId);
    }
  }

  async sendSuggestion(suggestion) {
    if (!this.channel) return null;

    const typeEmoji = {
      'create-issue': '\uD83D\uDCDD',
      'update-backlog': '\uD83D\uDCCB',
      'notify': '\uD83D\uDD14',
      'open-project': '\uD83D\uDCC2'
    };

    const embed = new EmbedBuilder()
      .setColor(0xFF96C8)
      .setTitle(`${typeEmoji[suggestion.type] || '\u2728'} ${suggestion.title}`)
      .setDescription(suggestion.description)
      .addFields(
        { name: 'Project', value: suggestion.projectName, inline: true },
        { name: 'Type', value: suggestion.type, inline: true },
        { name: 'Status', value: '\u23F3 Pending', inline: true }
      )
      .setFooter({ text: 'React \u2705 to approve or \u274C to dismiss' })
      .setTimestamp();

    try {
      const message = await this.channel.send({ embeds: [embed] });
      await message.react('\u2705');
      await message.react('\u274C');

      this.suggestionMessages.set(message.id, suggestion.id);
      return message.id;
    } catch (err) {
      console.error('Discord: Failed to send suggestion:', err.message);
      return null;
    }
  }

  async updateSuggestionStatus(messageId, status, result) {
    if (!this.channel) return;

    try {
      const message = await this.channel.messages.fetch(messageId);
      const embed = EmbedBuilder.from(message.embeds[0]);

      if (status === 'approved') {
        embed.setColor(0x00CC66);
        const statusText = result?.url
          ? `\u2705 Approved — [Issue #${result.number}](${result.url})`
          : '\u2705 Approved & Executed';
        embed.spliceFields(2, 1, { name: 'Status', value: statusText, inline: true });
      } else {
        embed.setColor(0x999999);
        embed.spliceFields(2, 1, { name: 'Status', value: '\u274C Dismissed', inline: true });
      }

      await message.edit({ embeds: [embed] });
    } catch (err) {
      console.error('Discord: Failed to update message:', err.message);
    }
  }

  async _handleReaction(reaction, user) {
    // Ignore reactions from bots and from ourselves
    if (user.bot || user.id === this.client.user.id) return;

    const suggestionId = this.suggestionMessages.get(reaction.message.id);
    if (!suggestionId) return;

    const emoji = reaction.emoji.name;

    if (emoji === '\u2705') {
      try {
        await this.actionEngine.approve(suggestionId);
        this.suggestionMessages.delete(reaction.message.id);
      } catch (err) {
        await this.channel.send(`\u26A0\uFE0F Failed to execute: ${err.message}`);
      }
    } else if (emoji === '\u274C') {
      await this.actionEngine.dismiss(suggestionId);
      this.suggestionMessages.delete(reaction.message.id);
    }
  }

  _startDailyDigest() {
    const time = this.config.dailyDigestTime || '09:00';
    const [hour, minute] = time.split(':');

    this.digestJob = cron.schedule(`${minute} ${hour} * * *`, () => {
      this._sendDailyDigest();
    });
  }

  async _sendDailyDigest() {
    if (!this.channel) return;

    const stats = this.actionEngine.getTodayStats();
    const pending = this.actionEngine.getPendingSuggestions();

    const embed = new EmbedBuilder()
      .setColor(0xFF96C8)
      .setTitle('\uD83D\uDCCA Daily Digest from Tamugatchi')
      .addFields(
        { name: 'Suggestions Today', value: `${stats.suggested}`, inline: true },
        { name: 'Approved', value: `${stats.approved}`, inline: true },
        { name: 'Dismissed', value: `${stats.dismissed}`, inline: true },
        { name: 'Pending', value: `${stats.pending}`, inline: true }
      )
      .setTimestamp();

    if (pending.length > 0) {
      const pendingList = pending
        .slice(0, 5)
        .map(s => `\u2022 **${s.projectName}**: ${s.title}`)
        .join('\n');
      embed.addFields({ name: '\u23F3 Pending Suggestions', value: pendingList });
    }

    try {
      await this.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Discord: Failed to send daily digest:', err.message);
    }
  }

  updateActivity(state) {
    if (!this.client?.user) return;
    const activities = {
      idle: 'Watching your projects',
      thinking: 'Analyzing your projects...',
      excited: 'Has suggestions for you!',
      sleeping: 'Zzz...',
      happy: 'Feeling appreciated!',
      sad: 'Maybe next time...'
    };
    this.client.user.setActivity(activities[state] || 'Watching your projects', { type: 3 });
  }
}

module.exports = { DiscordBot };
