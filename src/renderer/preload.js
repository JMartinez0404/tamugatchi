const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tamugatchi', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
  getPetState: () => ipcRenderer.invoke('get-pet-state'),
  approveSuggestion: (id) => ipcRenderer.invoke('approve-suggestion', id),
  dismissSuggestion: (id) => ipcRenderer.invoke('dismiss-suggestion', id),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  removeProject: (path) => ipcRenderer.invoke('remove-project', path),
  onConfigChange: (callback) => {
    ipcRenderer.on('config-changed', (_, key, value) => callback(key, value));
  },

  onPetStateChange: (callback) => {
    ipcRenderer.on('pet-state-change', (_, state) => callback(state));
  },
  onNewSuggestion: (callback) => {
    ipcRenderer.on('new-suggestion', (_, suggestion) => callback(suggestion));
  },
  onSuggestionExecuted: (callback) => {
    ipcRenderer.on('suggestion-executed', (_, data) => callback(data));
  },
  onSuggestionDismissed: (callback) => {
    ipcRenderer.on('suggestion-dismissed', (_, data) => callback(data));
  }
});
