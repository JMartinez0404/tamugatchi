const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  petName: 'Tamu',
  scanDirectories: [path.join(os.homedir(), 'Documents')],
  trackedProjects: [],
  checkIntervalMinutes: 30,
  activeHours: { start: 9, end: 18 },
  ollama: {
    host: 'http://localhost:11434',
    model: 'llama3.2'
  },
  github: {
    token: ''
  },
  discord: {
    enabled: false,
    botToken: '',
    channelId: '',
    dmMode: true,
    dailyDigestTime: '09:00'
  },
  notificationStyle: 'speech-bubble',
  petPosition: { x: 100, y: 100 }
};

const PET_STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  EXCITED: 'excited',
  HAPPY: 'happy',
  SAD: 'sad',
  SLEEPING: 'sleeping'
};

const ACTION_TYPES = {
  CREATE_ISSUE: 'create-issue',
  UPDATE_BACKLOG: 'update-backlog',
  NOTIFY: 'notify',
  OPEN_PROJECT: 'open-project'
};

module.exports = { DEFAULT_CONFIG, PET_STATES, ACTION_TYPES };
