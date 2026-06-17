const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const path = require('path');

let server;
let mainWindow;
let appBaseUrl;
let pendingNostrUrl = '';
const secureSessionFile = 'secure-private-key-session.dat';

function createStaticServer() {
  const root = path.join(__dirname, '..', 'build');
  server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const cleanPath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
    const filePath = path.join(root, cleanPath || 'index.html');
    const safePath = filePath.startsWith(root) ? filePath : path.join(root, 'index.html');
    fs.readFile(safePath, (error, content) => {
      if (error) {
        fs.readFile(path.join(root, 'index.html'), (fallbackError, fallback) => {
          if (fallbackError) {
            response.writeHead(404);
            response.end('Not found');
            return;
          }
          response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          response.end(fallback);
        });
        return;
      }
      response.writeHead(200, { 'content-type': contentType(safePath) });
      response.end(content);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function createWindow() {
  appBaseUrl = appBaseUrl || (await createStaticServer());
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 840,
    minWidth: 420,
    minHeight: 680,
    title: 'Nostr Social',
    icon: path.join(__dirname, '..', 'build', 'icon-512.png'),
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
  await mainWindow.loadURL(appBaseUrl);
  if (pendingNostrUrl) {
    const url = pendingNostrUrl;
    pendingNostrUrl = '';
    openNostrUrl(url);
  }
}

function registerNostrProtocol() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) app.setAsDefaultProtocolClient('nostr', process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient('nostr');
  }
}

function findNostrUrl(argv = process.argv) {
  return argv.find((argument) => /^nostr:/i.test(argument)) || '';
}

function nostrIdentifierFromUrl(url = '') {
  const clean = String(url).trim();
  if (!/^nostr:/i.test(clean)) return '';
  try {
    return decodeURIComponent(clean.replace(/^nostr:(?:\/\/)?/i, '').replace(/^\/+/, '').split(/[?#]/, 1)[0] || '').trim();
  } catch {
    return clean.replace(/^nostr:(?:\/\/)?/i, '').replace(/^\/+/, '').split(/[?#]/, 1)[0] || '';
  }
}

function openNostrUrl(url) {
  const identifier = nostrIdentifierFromUrl(url);
  if (!identifier) return;
  pendingNostrUrl = url;
  if (!mainWindow || !appBaseUrl) return;
  pendingNostrUrl = '';
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  void mainWindow.loadURL(`${appBaseUrl}/${encodeURIComponent(identifier)}`);
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.json' || extension === '.webmanifest') return 'application/json; charset=utf-8';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function secureSessionPath() {
  return path.join(app.getPath('userData'), secureSessionFile);
}

function canUseSecureSessionStorage() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  if (process.platform !== 'linux') return true;
  const backend = safeStorage.getSelectedStorageBackend();
  return backend !== 'basic_text' && backend !== 'unknown';
}

async function readSecureSession() {
  if (!canUseSecureSessionStorage()) return null;
  try {
    const encoded = await fsp.readFile(secureSessionPath(), 'utf8');
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  } catch {
    return null;
  }
}

async function writeSecureSession(value) {
  if (!canUseSecureSessionStorage()) return false;
  const encrypted = safeStorage.encryptString(value);
  await fsp.mkdir(app.getPath('userData'), { recursive: true });
  await fsp.writeFile(secureSessionPath(), encrypted.toString('base64'), { mode: 0o600 });
  return true;
}

async function clearSecureSession() {
  try {
    await fsp.rm(secureSessionPath(), { force: true });
  } catch {
    // Logout should still succeed if the secure session file is already gone.
  }
}

function registerSecureSessionHandlers() {
  ipcMain.handle('secure-session:available', () => canUseSecureSessionStorage());
  ipcMain.handle('secure-session:read', () => readSecureSession());
  ipcMain.handle('secure-session:write', (_event, value) => (typeof value === 'string' ? writeSecureSession(value) : false));
  ipcMain.handle('secure-session:clear', () => clearSecureSession());
}

registerNostrProtocol();
openNostrUrl(findNostrUrl());

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    openNostrUrl(findNostrUrl(argv));
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    openNostrUrl(url);
  });

  app.whenReady().then(() => {
    registerSecureSessionHandlers();
    return createWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on('before-quit', () => {
  server?.close();
});
