const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tonnageDesktop', {
  getMeta: () => ipcRenderer.invoke('app:get-meta'),
  readStore: (name) => ipcRenderer.invoke('store:read', name),
  writeStore: (name, value) => ipcRenderer.invoke('store:write', name, value),
  openData: (options) => ipcRenderer.invoke('dialog:open-data', options),
  readTextFile: (filePath) => ipcRenderer.invoke('file:read-text', filePath),
  saveText: (options) => ipcRenderer.invoke('dialog:save-text', options),
  saveBytes: (options) => ipcRenderer.invoke('dialog:save-bytes', options),
  showItem: (filePath) => ipcRenderer.invoke('shell:show-item', filePath),
  openPath: (filePath) => ipcRenderer.invoke('shell:open-path', filePath),
  onExternalOpenFile: (handler) => {
    const listener = (_event, filePath) => handler(filePath);
    ipcRenderer.on('external-open-file', listener);
    return () => ipcRenderer.removeListener('external-open-file', listener);
  },
});
