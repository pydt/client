if (require('electron-squirrel-startup')) return;

const electron = require('electron');
const path = require('path');
const fs = require('fs');
const storage = require('electron-json-storage');
const chokidar = require('chokidar');
const notifier = require('node-notifier');

// Module to control application life.
const {app} = electron;
// Module to create native browser window.
const {BrowserWindow} = electron;

const Menu = electron.Menu;
const Tray = electron.Tray;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;
let appIcon;

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({width: 500, height: 300});

  // and load the index.html of the app.
  win.loadURL(`file://${__dirname}/index.html`);

  let forceQuit = false;

  app.on('before-quit', () => { forceQuit = true; });

  win.on('close', e => {
    if (!forceQuit && process.platform === 'darwin') {
      e.preventDefault();
      win.hide();
    }
  });

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  win.on('minimize', () => {
    win.hide();
  });

  if (process.platform !== 'darwin') {
    const iconPath = path.join(__dirname, 'icon.png')
    appIcon = new Tray(iconPath)
    const contextMenu = Menu.buildFromTemplate([{
      label: 'Show Client',
      click: function () {
        win.show();
      }
    }, {
      label: 'Exit',
      click: function () {
        app.quit();
      }
    }]);

    appIcon.setToolTip('Play Your Damn Turn Client')
    appIcon.setContextMenu(contextMenu)
  }

  const aboutClick = (item, focusedWindow) => {
    win.show();
    win.send('show-about-modal', app.getVersion());
  };

  const menuTemplate = [{
      label: 'About',
      click: aboutClick
    },{
      label: 'Debug',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools();
          }
        }, {
          label: 'Clear Storage',
          click: () => {
            storage.clear(() => {
              win.reload();
            });
          }
        }
      ]
  }];

  if (process.platform === 'darwin') {
    menuTemplate.unshift({
      label: app.getName(),
      submenu: [
        { label: 'About', click: aboutClick },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }, {
      label: 'Edit',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  require('./appUpdater').checkForUpdates(win);

  electron.ipcMain.on('start-chokidar', (event, arg) => {
    const watcher = chokidar.watch(arg, { depth: 0, ignoreInitial: true });

    const changeDetected = (path) => {
      win.setAlwaysOnTop(true);
      win.show();
      win.focus();
      win.setAlwaysOnTop(false);
      
      event.sender.send('new-save-detected', path);
      watcher.close();
    };

    watcher.on('add', changeDetected);
    watcher.on('change', changeDetected);
  });

  electron.ipcMain.on('show-toast', (event, arg) => {
    if (__dirname.indexOf('app.asar') > 0) {
      const splitDirname = __dirname.split(path.sep);
      const rootPath = path.join.apply(this, splitDirname.slice(0, splitDirname.length - 2));
      
      arg.icon = path.join(rootPath, 'Contents/app/icon.png');
      if (!fs.existsSync(arg.icon)) arg.icon = path.join(rootPath, 'app/icon.png');
    } else {
      arg.icon = path.join(__dirname, 'icon.png');
    }

    arg.wait = true;
    notifier.notify(arg);
  });

  notifier.on('click', () => {
    win.show();
  });

  electron.ipcMain.on('init-rollbar', (event, arg) => {
    const rollbar = require('rollbar');

    rollbar.handleUncaughtExceptionsAndRejections("67488d20e1444df7ab91d279659d519a", {
      environment: "prod"
    });
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }

  if (appIcon) {
    appIcon.destroy();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  } else {
    win.show();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
