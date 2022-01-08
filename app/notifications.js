const electron = require("electron");
const path = require("path");
const fs = require("fs");
const { RPC_TO_MAIN } = require("./rpcChannels");
const { forceShowWindow } = require("./window");

// Needs to be out here to prevent GC
// https://stackoverflow.com/questions/38449262/in-node-js-does-listening-to-an-eventemitter-create-a-reference-to-it
let lastNotification;

electron.ipcMain.on(RPC_TO_MAIN.SHOW_NOTIFICATION, (e, arg) => {
  if (__dirname.indexOf("app.asar") > 0) {
    const splitDirname = __dirname.split(path.sep);
    const rootPath = path.join(
      ...splitDirname.slice(0, splitDirname.length - 2),
    );

    arg.icon = path.join(rootPath, "Contents/app/icon.png");

    if (!fs.existsSync(arg.icon)) {
      arg.icon = path.join(rootPath, "app/icon.png");
    }
  } else {
    arg.icon = path.join(__dirname, "icon.png");
  }

  lastNotification = new electron.Notification(arg);

  lastNotification.on("click", () => {
    forceShowWindow();
  });

  lastNotification.show();
});
