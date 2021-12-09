const electron = require("electron");
const log = require("electron-log");
const { configureIot } = require("./iot");
const {
  getAppIcon,
  getWindow,
  createWindow,
  forceShowWindow,
} = require("./window");
const appUpdater = require("./appUpdater");

require("./storage");
const { default: rpcChannels } = require("./rpcChannels");

(() => {
  const { app } = electron;

  app.disableHardwareAcceleration();

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    // Someone tried to run a second instance, we should focus our window.
    forceShowWindow();
  });

  electron.ipcMain.handle(rpcChannels.GET_PATH, (e, name) => electron.app.getPath(name));

  electron.ipcMain.on(rpcChannels.LOG_INFO, (e, message) => log.info(message));

  electron.ipcMain.on(rpcChannels.LOG_ERROR, (e, message) => log.error(message));

  electron.ipcMain.on(rpcChannels.SHOW_WINDOW, () => {
    forceShowWindow();
  });

  // Quit when all windows are closed.
  app.on("window-all-closed", () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
      app.quit();
    }

    if (getAppIcon()) {
      getAppIcon().destroy();
    }
  });

  app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (getWindow() === null) {
      createWindow();
    } else {
      getWindow().show();
    }
  });

  app.on("ready", () => {
    const win = createWindow();

    appUpdater.checkForUpdates(win);

    configureIot(electron, win);
  });

  electron.ipcMain.on(rpcChannels.INIT_ROLLBAR, () => {
    const Rollbar = require("rollbar");

    new Rollbar({
      accessToken: "67488d20e1444df7ab91d279659d519a",
      captureUncaught: true,
      captureUnhandledRejections: true,
      payload: {
        environment: "prod",
      },
    });
  });
})();
