'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  platform: process.platform,
  loadWorkspaceSync: () => ipcRenderer.sendSync('workspace:load-sync'),
  loadAnalyticsSync: () => ipcRenderer.sendSync('analytics:load-sync'),
  saveWorkspace: snapshot => ipcRenderer.invoke('workspace:save', snapshot),
  saveAnalytics: snapshot => ipcRenderer.invoke('analytics:save', snapshot),
  clearWorkspace: () => ipcRenderer.invoke('workspace:clear'),
  clearAnalytics: () => ipcRenderer.invoke('analytics:clear'),
  openDataFile: () => ipcRenderer.invoke('file:open'),
  savePlanningFile: (text, suggestedName) => ipcRenderer.invoke('file:save-planning', { text, suggestedName }),
  saveCsvFile: (text, suggestedName) => ipcRenderer.invoke('file:save-csv', { text, suggestedName }),
  printPdf: suggestedName => ipcRenderer.invoke('file:print-pdf', { suggestedName }),
  onOpenedFile: callback => ipcRenderer.on('file:opened', (_event, payload) => callback(payload)),
  onCommand: callback => ipcRenderer.on('app:command', (_event, command) => callback(command))
});
