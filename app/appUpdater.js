const electron = require('electron');
const log = require('electron-log');
const autoUpdater = electron.autoUpdater;

const UPDATE_SERVER_HOST = "updates.playyourdamnturn.com";

module.exports.checkForUpdates = (window) => {
  const platform = process.platform;
  const version = electron.app.getVersion();

  log.info("version: " + version);

  if (/node_modules.electron/.test(electron.app.getPath("exe"))) {
    log.info('in dev, skipping updates...');
    return;
  }

  if (platform === "linux") {
    return;
  }

  autoUpdater.addListener("update-available", event => {
    log.info("A new update is available")
  });

  autoUpdater.addListener("update-downloaded", (event, releaseNotes, releaseName, releaseDate, updateURL) => {
    window.send('show-update-modal', releaseName);
    return true;
  });

  electron.ipcMain.on('apply-update', () => {
    autoUpdater.quitAndInstall();
  });

  autoUpdater.addListener("error", error => {
    log.error(error);
  });

  autoUpdater.addListener("checking-for-update", event => {
    log.info("checking-for-update");
  });

  autoUpdater.addListener("update-not-available", () => {
    log.info("update-not-available");
  });

  const updatePlatform = platform === 'darwin' ? 'osx' : 'win32';
  const feedUrl = `https://${UPDATE_SERVER_HOST}/update/${updatePlatform}/${version}`;
  log.info(feedUrl);
  
  autoUpdater.setFeedURL(feedUrl);

  window.webContents.once("did-frame-finish-load", event => {
    autoUpdater.checkForUpdates();

    // Check for updates every 30 minutes
    setInterval(function() {
      autoUpdater.checkForUpdates();
    }, 30 * 60 * 1000);
  });
};