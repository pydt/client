const electron = require("electron");
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");
const chokidar = require("chokidar");
const AutoLaunch = require("auto-launch");
const { RPC_INVOKE, RPC_TO_MAIN, RPC_TO_RENDERER } = require("./rpcChannels");

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

    const launcher = new AutoLaunch({
      name: "Play Your Damn Turn Client",
    });

    launcher
      .isEnabled()
      .then(isEnabled => {
        if (isEnabled && !arg) {
          electron.ipcRenderer.send(RPC_TO_MAIN.LOG_INFO, "Disabling auto start...");
          return launcher.disable();
        }

        if (!isEnabled && !!arg) {
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
    mkdirp: p => mkdirp.sync(p),
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
  path: {
    basename: p => path.basename(p),
    join: (...paths) => path.join(...paths),
    normalize: p => path.normalize(p),
  },
  platform: process.platform,
});
