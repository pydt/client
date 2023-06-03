import * as electron from "electron";
import { default as log } from "electron-log";
import { autoUpdater } from "electron-updater";
import { RPC_TO_MAIN, RPC_TO_RENDERER } from "./rpcChannels.js";

// Check for updates every 30 minutes
const UPDATE_INTERVAL = 30 * 60 * 1000;

electron.ipcMain.on(RPC_TO_MAIN.APPLY_UPDATE, () => autoUpdater.quitAndInstall());

export const checkForUpdates = window => {
  const version = electron.app.getVersion();

  log.info(`version: ${version}`);

  if (/node_modules.electron/u.test(electron.app.getPath("exe"))) {
    log.info("in dev, skipping updates...");
    return;
  }

  autoUpdater.addListener("update-available", () => {
    log.info("A new update is available");
  });

  autoUpdater.addListener("update-downloaded", (event, releaseNotes, releaseName) => {
    window.send(RPC_TO_RENDERER.SHOW_UPDATE_MODAL, releaseName);
    return true;
  });

  autoUpdater.addListener("error", error => {
    log.error(error);
  });

  autoUpdater.addListener("checking-for-update", () => {
    log.info("checking-for-update");
  });

  autoUpdater.addListener("update-not-available", () => {
    log.info("update-not-available");
  });

  window.webContents.once("did-frame-finish-load", () => {
    autoUpdater.checkForUpdates();

    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, UPDATE_INTERVAL);
  });
};
