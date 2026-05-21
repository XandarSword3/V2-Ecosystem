// ============================================================
// V2 Ecosystem — Wizard 1 Preload Script
// Exposes safe IPC bridge to renderer process
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),

  // System
  getServerIP: () => ipcRenderer.invoke('system:getServerIP'),
  getLocalIP: () => ipcRenderer.invoke('system:getLocalIP'),
  generateSecrets: () => ipcRenderer.invoke('system:generateSecrets'),

  // Docker
  checkDocker: () => ipcRenderer.invoke('docker:check'),
  openDockerInstallPage: () => ipcRenderer.invoke('docker:openInstallPage'),
  startDockerDesktop: () => ipcRenderer.invoke('docker:startDesktop'),
  waitForDockerReady: () => ipcRenderer.invoke('docker:waitForReady'),

  // File writing
  writeEnvFiles: (args) => ipcRenderer.invoke('files:writeEnvFiles', args),

  // Deployment
  startDeploy: (args) => ipcRenderer.invoke('deploy:start', args),
  runMigrations: (args) => ipcRenderer.invoke('deploy:runMigrations', args),
  waitForHealth: (args) => ipcRenderer.invoke('deploy:waitForHealth', args),
  openBrowser: (args) => ipcRenderer.invoke('deploy:openBrowser', args),

  // Event listeners
  onDeployLog: (callback) => ipcRenderer.on('deploy:log', (_, msg) => callback(msg)),
  offDeployLog: () => ipcRenderer.removeAllListeners('deploy:log'),
});
