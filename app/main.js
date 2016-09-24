const electron = require('electron');
const path = require('path');

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
  win = new BrowserWindow({width: 500, height: 200});

  // and load the index.html of the app.
  win.loadURL(`file://${__dirname}/ui/index.html`);


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

  const iconPath = path.join(__dirname, 'dumpsterfire.png')
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
  }])
  appIcon.setToolTip('Giant Multiplayer Ripoff')
  appIcon.setContextMenu(contextMenu)

  // Comment this line out to get the default menu for debugging...
  win.setMenu(null);
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

  appIcon.destroy();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
