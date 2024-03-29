import "source-map-support/register";
import * as electron from "electron";
import open from "open";
import { default as log } from "electron-log";
import { configureIot } from "./iot.js";
import { getAppIcon, getWindow, createWindow, forceShowWindow } from "./window.js";
import { checkForUpdates } from "./appUpdater.js";
import { RPC_INVOKE, RPC_TO_MAIN } from "./rpcChannels.js";
import { default as contextMenu } from "electron-context-menu";
import { ROLLBAR_CONFIG } from "./rollbarConfig.js";

import "./storage.js";
import "./notifications.js";

contextMenu({
  showLookUpSelection: false,
  showSearchWithGoogle: false,
});

(async () => {
  const { app, dialog, ipcMain } = electron;

  app.disableHardwareAcceleration();

  // This was probably a bad choice for the ID but I think I'm stuck with it now,
  // needed for notifications to work right on Windows.
  app.setAppUserModelId("play.your.damn.turn.client");

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    // Someone tried to run a second instance, we should focus our window.
    forceShowWindow();
  });

  app.on("ready", async () => {
    ipcMain.handle(RPC_INVOKE.GET_PATH, (e, name) => app.getPath(name));

    ipcMain.on(RPC_TO_MAIN.LOG_INFO, (e, message) => log.info(message));

    ipcMain.on(RPC_TO_MAIN.LOG_ERROR, (e, message) => log.error(message));

    ipcMain.on(RPC_TO_MAIN.OPEN_URL, (e, url) => open(url));

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

    const win = await createWindow();

    checkForUpdates(win);

    configureIot(electron, win);
  });
})();
