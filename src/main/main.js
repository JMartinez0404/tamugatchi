const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { DEFAULT_CONFIG, PET_STATES } = require('../shared/config');
const { createTray } = require('./tray');
const { ProjectScanner } = require('./project-scanner');
const { ActionEngine } = require('./action-engine');
const { Scheduler } = require('./scheduler');
const { OllamaClient } = require('./ollama-client');
const { GitHubClient } = require('./github-client');
const { DiscordBot } = require('./discord-bot');

const store = new Store({ defaults: DEFAULT_CONFIG });

let petWindow = null;
let settingsWindow = null;
let tray = null;
let scheduler = null;
let actionEngine = null;
let discordBot = null;

function createPetWindow() {
  const { x, y } = store.get('petPosition', DEFAULT_CONFIG.petPosition);

  petWindow = new BrowserWindow({
    width: 200,
    height: 250,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  petWindow.setIgnoreMouseEvents(false);

  petWindow.on('moved', () => {
    const [px, py] = petWindow.getPosition();
    store.set('petPosition', { x: px, y: py });
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });

  return petWindow;
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    frame: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

async function initServices() {
  const ollamaClient = new OllamaClient(store.get('ollama'));
  const githubClient = new GitHubClient(store.get('github.token'));
  const projectScanner = new ProjectScanner(store);

  actionEngine = new ActionEngine(store, githubClient, petWindow);

  // Init Discord bot if enabled
  const discordConfig = store.get('discord');
  if (discordConfig.enabled && discordConfig.botToken) {
    discordBot = new DiscordBot(discordConfig, actionEngine);
    await discordBot.start();
    actionEngine.setDiscordBot(discordBot);
  }

  scheduler = new Scheduler(store, projectScanner, ollamaClient, actionEngine);
  scheduler.start();
}

// IPC handlers
ipcMain.handle('get-config', () => store.store);
ipcMain.handle('set-config', (_, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('get-pet-state', () => ({
  name: store.get('petName'),
  state: store.get('currentPetState', PET_STATES.IDLE),
  pendingSuggestions: actionEngine ? actionEngine.getPendingSuggestions() : []
}));

ipcMain.handle('approve-suggestion', (_, suggestionId) => {
  if (actionEngine) return actionEngine.approve(suggestionId);
});

ipcMain.handle('dismiss-suggestion', (_, suggestionId) => {
  if (actionEngine) return actionEngine.dismiss(suggestionId);
});

ipcMain.handle('open-settings', () => createSettingsWindow());

ipcMain.handle('get-projects', () => store.get('trackedProjects', []));

app.whenReady().then(async () => {
  createPetWindow();
  tray = createTray(petWindow, () => createSettingsWindow(), app);
  await initServices();
});

app.on('window-all-closed', (e) => {
  // Don't quit — keep running in tray
  e.preventDefault();
});

app.on('before-quit', () => {
  if (scheduler) scheduler.stop();
  if (discordBot) discordBot.stop();
});
