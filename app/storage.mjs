import electron from "electron";
import storage from "electron-json-storage";
import { RPC_INVOKE } from "./rpcChannels.js";

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

export const getConfig = key => ({ ...configs[key] });

export const clearConfig = () => new Promise((resolve) => storage.clear(resolve));
