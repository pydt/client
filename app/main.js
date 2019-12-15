if (require('electron-squirrel-startup')) return;

const electron = require('electron');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const storage = require('electron-json-storage');
const chokidar = require('chokidar');
const notifier = require('node-notifier');
const open = require('open');
const windowStateKeeper = require('electron-window-state');

// Module to control application life.
const { app } = electron;
app.disableHardwareAcceleration();

// Module to create native browser window.
const { BrowserWindow } = electron;

const Menu = electron.Menu;
const Tray = electron.Tray;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;
let appIcon;


if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

app.on('second-instance', function (argv, cwd) {
  // Someone tried to run a second instance, we should focus our window.
  forceShowWindow();
})

function forceShowWindow() {
  if (win) {
    win.setAlwaysOnTop(true);
    win.show();
    win.focus();
    win.setAlwaysOnTop(false);
  }
}


function createWindow() {
  // Create the browser window.
  const mainWindowState = windowStateKeeper({
    defaultWidth: 500,
    defaultHeight: 350
  });

  win = new BrowserWindow({
    width: mainWindowState.width,
    height: mainWindowState.height,
    webPreferences: {
      nodeIntegration: true
    }
  });

  mainWindowState.manage(win);

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

  const settingsClick = (item, focusedWindow) => {
    win.show();
    win.send('show-settings-modal');
  };

  const menuTemplate = [{
    label: 'Options',
    submenu: [{
      label: 'About',
      click: aboutClick
    }, {
      label: 'Settings',
      click: settingsClick
    }]
  }, {
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
  }, {
    label: 'Donate!',
    click: () => {
      open('https://patreon.com/pydt');
    }
  }];

  if (process.platform === 'darwin') {
    menuTemplate.unshift({
      label: app.getName(),
      submenu: [
        { label: 'About', click: aboutClick },
        { label: 'Settings', click: settingsClick },
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

  const appUpdater = require('./appUpdater');

  appUpdater.checkForUpdates(win);

  electron.ipcMain.on('apply-update', () => {
    forceQuit = true;
    appUpdater.applyUpdate();
  });

  electron.ipcMain.on('turns-available', (event, arg) => {
    win.setOverlayIcon(arg ? path.join(__dirname, 'star.png') : null, arg ? 'Turns Available' : '');

    if (appIcon) {
      appIcon.setImage(arg ? path.join(__dirname, 'icon_red.png') : path.join(__dirname, 'icon.png'));
    }
  });

  electron.ipcMain.on('start-chokidar', (event, arg) => {
    const watcher = chokidar.watch(arg.path, {
      depth: 0,
      ignoreInitial: true,
      awaitWriteFinish: arg.awaitWriteFinish
    });

    const changeDetected = (path) => {
      forceShowWindow();
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

    arg.appID = 'play.your.damn.turn.client';

    arg.wait = true;
    notifier.notify(arg);
  });

  notifier.on('click', () => {
    win.show();
  });

  electron.ipcMain.on('init-rollbar', (event, arg) => {
    const Rollbar = require('rollbar');

    new Rollbar({
      accessToken: "67488d20e1444df7ab91d279659d519a",
      captureUncaught: true,
      captureUnhandledRejections: true,
      payload: {
        environment: "prod"
      }
    });
  });

  electron.ipcMain.on('open-url', (event, arg) => {
    open(arg).catch(err => {
      log.error(`Could not open URL ${arg}: ${err.message}`);
    });
  });

  electron.ipcMain.on('set-autostart', (event, arg) => {
    log.info('set-autostart');

    const AutoLaunch = require('auto-launch');

    const launcher = new AutoLaunch({
      name: 'Play Your Damn Turn Client',
      isHidden: true
    });

    launcher.isEnabled().then(isEnabled => {
      if (isEnabled && !arg) {
        log.warn('Disabling auto start...');
        return launcher.disable();
      }

      if (!isEnabled && !!arg) {
        log.warn('Enabling auto start...');
        return launcher.enable();
      }
    }).catch(err => {
      log.error('Error toggling auto-start: ', err.message);
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
