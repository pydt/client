import * as electron from "electron";
import * as path from "path";
import * as fs from "fs";
import * as zlib from "zlib";
import { mkdirpSync } from "mkdirp";
// chokidar pinned to v3 - v4/v5 dropped the bundled fsevents dependency, so macOS
// falls back to the generic fs.watch + directory-rescan path (throttled to 1s),
// adding a noticeable delay to save-file detection that wasn't there with fsevents.
import * as chokidar from "chokidar";
import * as AutoLaunch from "auto-launch";
import { RPC_INVOKE, RPC_TO_MAIN, RPC_TO_RENDERER } from "./rpcChannels.js";

let watcher;

electron.contextBridge.exposeInMainWorld("pydtApi", {
  startChokidar: arg =>
    new Promise(resolve => {
      if (watcher) {
        watcher.close();
      }

      watcher = chokidar.watch(arg.path, {
        depth: 0,
        ignoreInitial: true,
        awaitWriteFinish: arg.awaitWriteFinish,
        usePolling: arg.awaitWriteFinish,
      });

      const changeDetected = p => {
        electron.ipcRenderer.send(RPC_TO_MAIN.SHOW_WINDOW);
        watcher.close();
        watcher = null;
        resolve(p);
      };

      watcher.on("add", changeDetected);
      watcher.on("change", changeDetected);
    }),
  setAutostart: arg => {
    electron.ipcRenderer.send(RPC_TO_MAIN.LOG_INFO, "set-autostart");

    const name = "Play Your Damn Turn Client";
    const appImage = process.env.APPIMAGE;
    const launcher = new AutoLaunch({
      name,
      // A running AppImage lives in a temporary mount (/tmp/.mount_xxx) that changes every launch, so
      // auto-launch's default (process.execPath) would point at a folder that's gone after a reboot.
      // APPIMAGE is set by the AppImage runtime to the real .AppImage file.
      ...(appImage ? { path: appImage } : {}),
    });
    let cleanup = Promise.resolve();

    if (appImage) {
      // auto-launch names the entry after the path's file name, which for an AppImage includes the
      // version; keep one fixed name so a new version replaces the entry instead of adding another
      launcher.opts.appName = name;

      if (appImage.includes(" ")) {
        launcher.opts.appPath = `"${appImage}"`;
      }

      // Older clients wrote an entry named after the executable, pointing at the temporary mount.
      // It can't start anything, so remove it (a default AutoLaunch targets exactly that entry).
      cleanup = new AutoLaunch({ name }).disable().catch(() => null);
    }

    cleanup
      .then(() => launcher.isEnabled())
      .then(isEnabled => {
        if (isEnabled && !arg) {
          electron.ipcRenderer.send(RPC_TO_MAIN.LOG_INFO, "Disabling auto start...");
          return launcher.disable();
        }

        // On an AppImage, rewrite the entry even if one exists: older clients wrote the temporary mount
        // path, and each downloaded version has its own file name.
        if (!!arg && (!isEnabled || appImage)) {
          electron.ipcRenderer.send(RPC_TO_MAIN.LOG_INFO, "Enabling auto start...");
          return launcher.enable();
        }

        return null;
      })
      .catch(err => {
        electron.ipcRenderer.send(RPC_TO_MAIN.LOG_ERROR, `Error toggling auto-start: ${err.message}`);
      });
  },
  ipc: {
    send: (channel, data) => {
      // whitelist channels
      if (Object.values(RPC_TO_MAIN).includes(channel)) {
        electron.ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      if (Object.values(RPC_TO_RENDERER).includes(channel)) {
        // Deliberately strip event as it includes `sender`
        electron.ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    invoke: async (channel, ...args) => {
      if (Object.values(RPC_INVOKE).includes(channel)) {
        return await electron.ipcRenderer.invoke(channel, ...args);
      }

      return null;
    },
    removeAllListeners: channel => {
      if (Object.values(RPC_TO_RENDERER).includes(channel)) {
        electron.ipcRenderer.removeAllListeners(channel);
      }
    },
    removeListener: (channel, func) => {
      if (Object.values(RPC_TO_RENDERER).includes(channel)) {
        electron.ipcRenderer.removeListener(channel, func);
      }
    },
  },
  fs: {
    existsSync: p => fs.existsSync(p),
    mkdirp: p => mkdirpSync(p),
    readdirSync: p => fs.readdirSync(p),
    readFileSync: p => fs.readFileSync(p),
    renameSync: (oldPath, newPath) => fs.renameSync(oldPath, newPath),
    statSync: p => {
      const stat = fs.statSync(p);

      return {
        ctime: stat.ctime,
        isDirectory: stat.isDirectory(),
      };
    },
    unlinkSync: p => fs.unlinkSync(p),
    writeFileSync: (p, data) => fs.writeFileSync(p, Buffer.from(data)),
  },
  // Both run off the renderer's main thread (async fs + libuv threadpool for zlib), so a
  // large save file doesn't block the UI the way pako.gzip/ungzip on the renderer did.
  readFileGzipped: p =>
    new Promise((resolve, reject) => {
      fs.readFile(p, (readErr, data) => {
        if (readErr) {
          reject(readErr);
          return;
        }

        zlib.gzip(data, (gzipErr, compressed) => {
          if (gzipErr) {
            reject(gzipErr);
            return;
          }

          resolve(compressed);
        });
      });
    }),
  gunzip: data =>
    new Promise((resolve, reject) => {
      zlib.gunzip(Buffer.from(data), (err, decompressed) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(decompressed);
      });
    }),
  path: {
    basename: p => path.basename(p),
    join: (...paths) => path.join(...paths),
    normalize: p => path.normalize(p),
  },
  platform: process.platform,
});
