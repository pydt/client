import electron from "electron";
import storage from "electron-json-storage";
import { RPC_INVOKE } from "./rpcChannels.js";

const loadConfig = key =>
  new Promise((resolve, reject) =>
    storage.get(key, (err, data) => {
      if (err) {
        reject(err);
      }

      resolve(data);
    }),
  );

electron.ipcMain.handle(RPC_INVOKE.STORAGE_GET, (e, key) => loadConfig(key));

electron.ipcMain.handle(
  RPC_INVOKE.STORAGE_SET,
  (e, key, data) =>
    new Promise((resolve, reject) => {
      storage.set(key, data, err => {
        if (err) {
          reject(err);
        }

        resolve();
      });
    }),
);

export const getConfig = key => loadConfig(key);

export const clearConfig = () => new Promise(resolve => storage.clear(resolve));
