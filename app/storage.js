const electron = require("electron");
const storage = require("electron-json-storage");
const { default: rpcChannels } = require("./rpcChannels");

electron.ipcMain.handle(rpcChannels.STORAGE_GET, (e, key) =>
  new Promise((resolve, reject) =>
    storage.get(key, (err, data) => {
      if (err) {
        reject(err);
      }

      resolve(data);
    })));

electron.ipcMain.handle(rpcChannels.STORAGE_SET, (e, key, data) =>
  new Promise((resolve, reject) =>
    storage.set(key, data, err => {
      if (err) {
        reject(err);
      }

      resolve();
    })));
