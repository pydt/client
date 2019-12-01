const electron = require('electron');
const log = require('electron-log');
const { autoUpdater } = require("electron-updater");

// Check for updates every 30 minutes
const UPDATE_INTERVAL = 30 * 60 * 1000;

module.exports.checkForUpdates = (window) => {
  const version = electron.app.getVersion();

  log.info("version: " + version);

  if (/node_modules.electron/.test(electron.app.getPath("exe"))) {
    log.info('in dev, skipping updates...');
    return;
  }

  autoUpdater.on("update-available", () => {
    log.info("A new update is available")
  });

  autoUpdater.on("update-downloaded", info => {
    window.send('show-update-modal', info.version);
    return true;
  });

  autoUpdater.on("error", error => {
    log.error(error);
  });

  autoUpdater.on("checking-for-update", () => {
    log.info("checking-for-update");
  });

  autoUpdater.on("update-not-available", () => {
    log.info("update-not-available");
  });

  window.webContents.once("did-frame-finish-load", () => {
    autoUpdater.checkForUpdates();
    
    setInterval(function() {
      autoUpdater.checkForUpdates();
    }, UPDATE_INTERVAL);
  });
};

module.exports.applyUpdate = () => {
  autoUpdater.quitAndInstall();
};