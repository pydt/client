const electron = require('electron');
const autoUpdater = electron.autoUpdater;

const UPDATE_SERVER_HOST = "updates.playyourdamnturn.com";

module.exports.checkForUpdates = (window) => {
  const platform = process.platform;
  const version = electron.app.getVersion();

  if (electron.app.getPath("exe").search(/node_modules.electron/)) {
    console.log('in dev, skipping updates...');
    return;
  }

  if (platform === "linux") {
    return;
  }

  autoUpdater.addListener("update-available", event => {
    console.log("A new update is available")
  });

  autoUpdater.addListener("update-downloaded", (event, releaseNotes, releaseName, releaseDate, updateURL) => {
    notify("A new update is ready to install", `Version ${releaseName} is downloaded and will be automatically installed on Quit`);
    console.log("quitAndInstall");
    autoUpdater.quitAndInstall();
    return true;
  });

  autoUpdater.addListener("error", error => {
    console.log(error);
  });

  autoUpdater.addListener("checking-for-update", event => {
    console.log("checking-for-update");
  });

  autoUpdater.addListener("update-not-available", () => {
    console.log("update-not-available");
  });

  const updatePlatform = platform === 'darwin' ? 'osx' : 'win32';
  const feedUrl = `https://${UPDATE_SERVER_HOST}/update/${updatePlatform}/${version}`;
  console.log(feedUrl);
  
  autoUpdater.setFeedURL(feedUrl);

  window.webContents.once("did-frame-finish-load", event => {
    autoUpdater.checkForUpdates();
  });
};

function notify(title, message) {
  let windows = electron.BrowserWindowElectron.getAllWindows();
  if (windows.length == 0) {
    return;
  }

  windows[0].webContents.send("notify", title, message);
}