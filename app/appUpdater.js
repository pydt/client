const electron = require('electron');
const log = require('electron-log');
const request = require('request');
const autoUpdater = electron.autoUpdater;

const UPDATE_SERVER_HOST = "updates.playyourdamnturn.com";

// Check for updates every 30 minutes
const UPDATE_INTERVAL = 30 * 60 * 1000;

module.exports.checkForUpdates = (window) => {
  const platform = process.platform;
  const version = electron.app.getVersion();

  log.info("version: " + version);

  if (/node_modules.electron/.test(electron.app.getPath("exe"))) {
    log.info('in dev, skipping updates...');
    return;
  }

  if (platform === "linux") {
    justCheckNoUpdate(window, version);
    return;
  }

  autoUpdater.addListener("update-available", event => {
    log.info("A new update is available")
  });

  autoUpdater.addListener("update-downloaded", (event, releaseNotes, releaseName, releaseDate, updateURL) => {
    window.send('show-update-modal', releaseName);
    return true;
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
    
    setInterval(function() {
      autoUpdater.checkForUpdates();
    }, UPDATE_INTERVAL);
  });
};

function justCheckNoUpdate(window, version) {
  // poll win32 feed to see if there's a new version...
  const url = `https://${UPDATE_SERVER_HOST}/update/win32/${version}`;

  setInterval(() => {
    request({
      url,
      json: true
    }, (err, resp, body) => {
      if (body && body.name) {
        window.send('manual-update-modal', body.name);
      }
    });
  }, UPDATE_INTERVAL);
};


module.exports.applyUpdate = () => {
  autoUpdater.quitAndInstall();
};