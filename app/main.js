const electron = require("electron");
const log = require("electron-log");
const fs = require("fs");
const path = require("path");
const open = require("open");
const del = require("del");
const { configureIot } = require("./iot");
const {
  getAppIcon,
  getWindow,
  createWindow,
  forceShowWindow,
} = require("./window");
const appUpdater = require("./appUpdater");
const { RPC_INVOKE, RPC_TO_MAIN } = require("./rpcChannels");
const contextMenu = require("electron-context-menu");

require("./storage");
require("./notifications");

contextMenu({
  showLookUpSelection: false,
  showSearchWithGoogle: false,
});

(() => {
  const { app } = electron;

  if (process.platform === "win32") {
    // Check for and remove old squirrel installation, maybe we can remove this code someday
    // https://github.com/electron-userland/electron-builder/issues/837
    if (fs.existsSync(path.join(app.getPath("appData"), "../Local/playyourdamnturn/.shouldUninstall"))) {
      // eslint-disable-next-line no-console
      console.log("Removing old squirrel installation...");

      open.openApp(path.join(app.getPath("appData"), "../Local/playyourdamnturn/Update.exe"), { arguments: ["--uninstall", "-s"] }).then(process => {
        process.on("close", () => {
          // eslint-disable-next-line no-console
          console.log("Uninstall complete...");

          setTimeout(() => {
            del(path.join(app.getPath("appData"), "../Local/playyourdamnturn"), { force: true }).then(() => {
              // eslint-disable-next-line no-console
              console.log("Old folder deleted!");
            });
          }, 2500);
        });
      });
    }
  }

  // This was probably a bad choice for the ID but I think I'm stuck with it now,
  // needed for notifications to work right on Windows.
  app.setAppUserModelId("play.your.damn.turn.client");

  app.disableHardwareAcceleration();

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    // Someone tried to run a second instance, we should focus our window.
    forceShowWindow();
  });

  electron.ipcMain.handle(RPC_INVOKE.GET_PATH, (e, name) => electron.app.getPath(name));

  electron.ipcMain.on(RPC_TO_MAIN.LOG_INFO, (e, message) => log.info(message));

  electron.ipcMain.on(RPC_TO_MAIN.LOG_ERROR, (e, message) => log.error(message));

  electron.ipcMain.on(RPC_TO_MAIN.SHOW_WINDOW, () => {
    forceShowWindow();
  });

  electron.ipcMain.handle(RPC_INVOKE.SHOW_OPEN_DIALOG, () => {
    const result = electron.dialog.showOpenDialogSync({
      properties: ["openDirectory"],
    });

    return result ? result[0] : null;
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

  electron.ipcMain.on(RPC_TO_MAIN.INIT_ROLLBAR, () => {
    const Rollbar = require("rollbar");

    new Rollbar({
      accessToken: "e381e1de46414e03a95005afd73d0c48",
      environment: "production",
      captureUncaught: true,
      captureUnhandledRejections: true,
      payload: {
        platform: "client",
      },
      ignoredMessages: [
        "net::ERR_NETWORK",
      ],
    });
  });
})();
