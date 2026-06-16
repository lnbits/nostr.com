const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nostrDesktopSecureStorage', {
  isAvailable: () => ipcRenderer.invoke('secure-session:available'),
  read: () => ipcRenderer.invoke('secure-session:read'),
  write: (value) => ipcRenderer.invoke('secure-session:write', value),
  clear: () => ipcRenderer.invoke('secure-session:clear')
});
