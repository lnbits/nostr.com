const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nostrDesktopSecureStorage', {
  isAvailable: () => ipcRenderer.invoke('secure-session:available'),
  read: () => ipcRenderer.invoke('secure-session:read'),
  write: (value) => ipcRenderer.invoke('secure-session:write', value),
  clear: () => ipcRenderer.invoke('secure-session:clear')
});

contextBridge.exposeInMainWorld('nostrDesktopUpload', {
  uploadToNostrBuild: (payload) => ipcRenderer.invoke('upload:nostr-build', payload)
});

contextBridge.exposeInMainWorld('nostrDesktopNotifications', {
  isAvailable: () => ipcRenderer.invoke('notification:available'),
  show: (payload) => ipcRenderer.invoke('notification:show', payload)
});
