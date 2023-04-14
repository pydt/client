import open from "open";
import { deleteSync } from "del";
import * as electron from "electron";
import { default as log } from "electron-log";
import * as fs from "fs";
import * as path from "path";
import { configureIot } from "./iot.mjs";
import { getAppIcon, getWindow, createWindow, forceShowWindow } from "./window.mjs";
import { checkForUpdates } from "./appUpdater.mjs";
import { RPC_INVOKE, RPC_TO_MAIN } from "./rpcChannels.js";
import { default as contextMenu } from "electron-context-menu";
import { ROLLBAR_CONFIG } from "./rollbarConfig.js";

import "./storage.mjs";
import "./notifications.mjs";

contextMenu({
  showLookUpSelection: false,
  showSearchWithGoogle: false,
});

(() => {
  const { app, dialog, ipcMain } = electron;

  if (process.platform === "win32") {
    // Check for and remove old squirrel installation, maybe we can remove this code someday
    // https://github.com/electron-userland/electron-builder/issues/837
    if (fs.existsSync(path.join(app.getPath("appData"), "../Local/playyourdamnturn/.shouldUninstall"))) {
      // eslint-disable-next-line no-console
      console.log("Removing old squirrel installation...");

      open
        .openApp(path.join(app.getPath("appData"), "../Local/playyourdamnturn/Update.exe"), {
          arguments: ["--uninstall", "-s"],
        })
        .then(process => {
          process.on("close", () => {
            // eslint-disable-next-line no-console
            console.log("Uninstall complete...");

            setTimeout(() => {
              deleteSync(path.join(app.getPath("appData"), "../Local/playyourdamnturn"), { force: true }).then(() => {
                // eslint-disable-next-line no-console
                console.log("Old folder deleted!");
              });
            }, 2500);
          });
        });
    }
  }

  app.on("second-instance", () => {
    // Someone tried to run a second instance, we should focus our window.
    forceShowWindow();
  });

  ipcMain.handle(RPC_INVOKE.GET_PATH, (e, name) => app.getPath(name));

  ipcMain.on(RPC_TO_MAIN.LOG_INFO, (e, message) => log.info(message));

  ipcMain.on(RPC_TO_MAIN.LOG_ERROR, (e, message) => log.error(message));

  ipcMain.on(RPC_TO_MAIN.OPEN_URL, (e, url) => open => open(url));

  ipcMain.on(RPC_TO_MAIN.SHOW_WINDOW, () => {
    forceShowWindow();
  });

  ipcMain.handle(RPC_INVOKE.SHOW_OPEN_DIALOG, () => {
    const result = dialog.showOpenDialogSync({
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

  ipcMain.on(RPC_TO_MAIN.INIT_ROLLBAR, () => {
    const Rollbar = require("rollbar");

    new Rollbar({
      ...ROLLBAR_CONFIG,
      payload: {
        platform: "client",
      },
    });
  });

  const win = createWindow();

  checkForUpdates(win);

  configureIot(electron, win);
})();
