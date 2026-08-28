'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_NAME = 'TONNAGE Staff';
let mainWindow = null;
let pendingFile = null;

function workspacePath() {
  return path.join(app.getPath('userData'), 'workspace.json');
}

function analyticsPath() {
  return path.join(app.getPath('userData'), 'analytics.json');
}

function readWorkspace() {
  try {
    return JSON.parse(fs.readFileSync(workspacePath(), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Workspace read:', error);
    return null;
  }
}

function readAnalytics() {
  try {
    return JSON.parse(fs.readFileSync(analyticsPath(), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Analytics read:', error);
    return null;
  }
}

function atomicWrite(target, text) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  const backup = `${target}.bak`;
  fs.writeFileSync(temporary, text, 'utf8');
  if (fs.existsSync(target)) {
    try { fs.copyFileSync(target, backup); } catch (error) { console.error('Workspace backup:', error); }
  }
  fs.renameSync(temporary, target);
}

function normalizeCandidate(candidate) {
  if (!candidate) return null;
  const resolved = path.resolve(candidate);
  const extension = path.extname(resolved).toLowerCase();
  return ['.tonnage', '.tonnage-db', '.json'].includes(extension) && fs.existsSync(resolved) ? resolved : null;
}

function firstFileArgument(argv) {
  for (const argument of argv) {
    const candidate = normalizeCandidate(argument);
    if (candidate) return candidate;
  }
  return null;
}

function readDataFile(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.size > 128 * 1024 * 1024) throw new Error('Файл больше 128 МБ и не может быть открыт безопасно.');
  return { name: path.basename(filePath), path: filePath, text: fs.readFileSync(filePath, 'utf8') };
}

function deliverFile(filePath) {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      pendingFile = filePath;
      return;
    }
    mainWindow.webContents.send('file:opened', readDataFile(filePath));
    mainWindow.show();
    mainWindow.focus();
  } catch (error) {
    dialog.showErrorBox('Не удалось открыть файл', error.message);
  }
}

function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        { label: 'Открыть…', accelerator: 'Ctrl+O', click: () => mainWindow?.webContents.send('app:command', 'open') },
        { label: 'Сохранить программу…', accelerator: 'Ctrl+S', click: () => mainWindow?.webContents.send('app:command', 'save-planning') },
        { type: 'separator' },
        { label: 'Экспорт подходов в CSV…', accelerator: 'Ctrl+Shift+E', click: () => mainWindow?.webContents.send('app:command', 'export-csv') },
        { label: 'Отчёт в PDF…', accelerator: 'Ctrl+P', click: () => mainWindow?.webContents.send('app:command', 'print-pdf') },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'resetZoom', label: 'Масштаб 100%' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { role: 'togglefullscreen', label: 'Полный экран' }
      ]
    },
    {
      label: 'Справка',
      submenu: [
        { label: `О ${APP_NAME}`, click: () => dialog.showMessageBox(mainWindow, { type: 'info', title: APP_NAME, message: `${APP_NAME} v${app.getVersion()}`, detail: 'Локальный редактор программ и аналитика тренировок. Данные не отправляются в интернет.' }) }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    title: APP_NAME,
    backgroundColor: '#090b0e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingFile) {
      const filePath = pendingFile;
      pendingFile = null;
      deliverFile(filePath);
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const candidate = firstFileArgument(argv);
    if (candidate) deliverFile(candidate);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    pendingFile = firstFileArgument(process.argv.slice(1));
    createMenu();
    createWindow();
  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  const candidate = normalizeCandidate(filePath);
  if (candidate) deliverFile(candidate);
});
app.on('window-all-closed', () => app.quit());

ipcMain.on('workspace:load-sync', event => { event.returnValue = readWorkspace(); });
ipcMain.on('analytics:load-sync', event => { event.returnValue = readAnalytics(); });
ipcMain.handle('workspace:save', async (_event, snapshot) => {
  if (!snapshot || snapshot.format !== 'tonnage-staff-workspace') throw new Error('Неверный формат рабочего пространства.');
  atomicWrite(workspacePath(), JSON.stringify(snapshot, null, 2));
  return { ok: true, path: workspacePath() };
});
ipcMain.handle('workspace:clear', async () => {
  for (const suffix of ['', '.bak', '.tmp']) {
    try { fs.unlinkSync(`${workspacePath()}${suffix}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { ok: true };
});
ipcMain.handle('analytics:save', async (_event, snapshot) => {
  if (!snapshot || !Array.isArray(snapshot.workouts) || !Array.isArray(snapshot.sets)) throw new Error('Неверный формат аналитики.');
  atomicWrite(analyticsPath(), JSON.stringify(snapshot));
  return { ok: true };
});
ipcMain.handle('analytics:clear', async () => {
  for (const suffix of ['', '.bak', '.tmp']) {
    try { fs.unlinkSync(`${analyticsPath()}${suffix}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { ok: true };
});
ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Открыть файл TONNAGE',
    properties: ['openFile'],
    filters: [
      { name: 'TONNAGE', extensions: ['tonnage', 'tonnage-db'] },
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return readDataFile(result.filePaths[0]);
});
ipcMain.handle('file:save-planning', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить программу для телефона',
    defaultPath: payload.suggestedName || 'tonnage-program.tonnage',
    filters: [{ name: 'TONNAGE planning', extensions: ['tonnage'] }]
  });
  if (result.canceled || !result.filePath) return null;
  atomicWrite(result.filePath, String(payload.text || ''));
  return { path: result.filePath, name: path.basename(result.filePath) };
});
ipcMain.handle('file:save-csv', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Экспортировать подходы',
    defaultPath: payload.suggestedName || 'tonnage-sets.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePath) return null;
  atomicWrite(result.filePath, `\ufeff${String(payload.text || '')}`);
  return { path: result.filePath, name: path.basename(result.filePath) };
});
ipcMain.handle('file:print-pdf', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить отчёт в PDF',
    defaultPath: payload.suggestedName || 'tonnage-report.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return null;
  const data = await mainWindow.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    landscape: true,
    margins: { marginType: 'default' }
  });
  fs.writeFileSync(result.filePath, data);
  return { path: result.filePath, name: path.basename(result.filePath) };
});
