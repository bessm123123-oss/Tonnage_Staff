const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP_ID = 'ru.tonnage.staff';
const APP_NAME = 'TONNAGE Staff';

app.setAppUserModelId(APP_ID);

const isDev = !app.isPackaged;
let mainWindow = null;
let pendingOpenPath = null;

function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function dataDirectory() {
  return app.getPath('userData');
}

function storePath(name) {
  return path.join(dataDirectory(), name);
}

function atomicWriteJson(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function readStore(name, fallback = null) {
  const file = storePath(name);
  if (!fs.existsSync(file)) return fallback;
  try {
    return safeJsonParse(fs.readFileSync(file, 'utf8'), fallback);
  } catch {
    return fallback;
  }
}

function writeStore(name, value) {
  atomicWriteJson(storePath(name), value);
  return true;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function sendOpenFile(filePath) {
  if (!filePath || !mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('external-open-file', filePath);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#0c111b',
    show: false,
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (pendingOpenPath) {
      const file = pendingOpenPath;
      pendingOpenPath = null;
      sendOpenFile(file);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12') mainWindow.webContents.toggleDevTools();
    });
  }
}

function normalizeOpenArg(argv) {
  const candidates = argv.filter((arg) => !arg.startsWith('-'));
  return candidates.find((arg) => /\.(tonnage|tonnage-db)$/i.test(arg)) || null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const openPath = normalizeOpenArg(argv);
    if (openPath) sendOpenFile(openPath);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    pendingOpenPath = normalizeOpenArg(process.argv);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) sendOpenFile(filePath);
  else pendingOpenPath = filePath;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:get-meta', () => ({
  name: APP_NAME,
  version: app.getVersion(),
  platform: process.platform,
  userData: dataDirectory(),
}));

ipcMain.handle('store:read', (_event, name) => readStore(name, null));
ipcMain.handle('store:write', (_event, name, value) => writeStore(name, value));

ipcMain.handle('dialog:open-data', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'Открыть файл TONNAGE',
    properties: ['openFile'],
    filters: [
      { name: 'TONNAGE', extensions: ['tonnage-db', 'tonnage'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'Все файлы', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return {
    path: filePath,
    name: path.basename(filePath),
    text: fs.readFileSync(filePath, 'utf8'),
    sha256: sha256File(filePath),
  };
});

ipcMain.handle('file:read-text', (_event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return {
    path: filePath,
    name: path.basename(filePath),
    text: fs.readFileSync(filePath, 'utf8'),
    sha256: sha256File(filePath),
  };
});

ipcMain.handle('dialog:save-text', async (_event, options = {}) => {
  const { defaultName = 'export.json', title = 'Сохранить файл', text = '', filters = [] } = options;
  const result = await dialog.showSaveDialog(mainWindow, {
    title,
    defaultPath: defaultName,
    filters: filters.length ? filters : [{ name: 'Все файлы', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, text, 'utf8');
  return { path: result.filePath, sha256: sha256File(result.filePath) };
});

ipcMain.handle('dialog:save-bytes', async (_event, options = {}) => {
  const { defaultName = 'export.bin', title = 'Сохранить файл', base64 = '', filters = [] } = options;
  const result = await dialog.showSaveDialog(mainWindow, {
    title,
    defaultPath: defaultName,
    filters: filters.length ? filters : [{ name: 'Все файлы', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
  return { path: result.filePath, sha256: sha256File(result.filePath) };
});

ipcMain.handle('shell:show-item', (_event, filePath) => {
  if (filePath && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('shell:open-path', (_event, filePath) => shell.openPath(filePath));
