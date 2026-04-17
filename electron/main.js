import { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get user data path for JSON storage (%APPDATA%/todo-app/data.json)
const getDataPath = () => {
  const userDataPath = app.getPath('userData');
  // Store in userData path which is typically %APPDATA%/Hermes Todo
  const dataDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'data.json');
};

const DATA_PATH = getDataPath();

// Determine if we're in development or production
const isDev = !app.isPackaged;

// Get the correct path to dist folder
function getDistPath() {
  if (isDev) {
    // In development, dist is at project root
    return path.join(__dirname, '..', 'dist');
  }
  // In production, inside asar archive
  return path.join(__dirname, '..', 'dist');
}

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

// System tray
let tray = null;
let mainWindow = null;

function createTray() {
  // Create a simple icon (16x16 white square for tray)
  const iconSize = 16;
  const icon = nativeImage.createEmpty();
  
  // Use a simple icon path - in production you'd have a proper icon file
  const iconPath = path.join(__dirname, 'icon.png');
  
  // Create tray with default icon if custom icon doesn't exist
  try {
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath);
    } else {
      // Create a simple 16x16 icon programmatically
      const canvas = Buffer.alloc(iconSize * iconSize * 4);
      for (let i = 0; i < iconSize * iconSize; i++) {
        canvas[i * 4] = 0;     // R
        canvas[i * 4 + 1] = 0; // G
        canvas[i * 4 + 2] = 0; // B
        canvas[i * 4 + 3] = 255; // A
      }
      const simpleIcon = nativeImage.createFromBuffer(canvas, { width: iconSize, height: iconSize });
      tray = new Tray(simpleIcon);
    }
  } catch (e) {
    console.error('Failed to create tray:', e);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Todo App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Hermes Todo App');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // Don't show until ready
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(getDistPath(), 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });

  mainWindow.on('minimize', () => {
    // Optional: minimize to tray on minimize event
    // mainWindow.hide();
  });
}

// JSON file operations
function loadData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const data = fs.readFileSync(DATA_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  return { tasks: [] };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save data:', e);
    return false;
  }
}

// IPC Handlers
ipcMain.handle('load-tasks', () => {
  return loadData();
});

ipcMain.handle('save-tasks', (event, data) => {
  return saveData(data);
});

ipcMain.handle('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title || 'Todo App',
      body: body || '',
      icon: path.join(__dirname, 'icon.png')
    });
    notification.show();
    return true;
  }
  return false;
});

ipcMain.handle('get-data-path', () => {
  return DATA_PATH;
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // On Windows, keep app running in tray
    // Don't quit unless explicitly quitting
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Error', `An unexpected error occurred: ${error.message}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
