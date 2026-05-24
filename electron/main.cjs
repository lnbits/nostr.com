const { app, BrowserWindow, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

let server;

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
  const baseUrl = await createStaticServer();
  const window = new BrowserWindow({
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
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  await window.loadURL(baseUrl);
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on('before-quit', () => {
  server?.close();
});
