const electron = require("electron");
const storage = require("electron-json-storage");
const { RPC_INVOKE } = require("./rpcChannels");

const configs = {};

electron.ipcMain.handle(
  RPC_INVOKE.STORAGE_GET,
  (e, key) =>
    new Promise((resolve, reject) =>
      storage.get(key, (err, data) => {
        if (err) {
          reject(err);
        }

        configs[key] = data;
        resolve(data);
      }),
    ),
);

electron.ipcMain.handle(
  RPC_INVOKE.STORAGE_SET,
  (e, key, data) =>
    new Promise((resolve, reject) => {
      configs[key] = data;
      storage.set(key, data, err => {
        if (err) {
          reject(err);
        }

        resolve();
      });
    }),
);

module.exports = {
  getConfig: key => ({ ...configs[key] }),
};
