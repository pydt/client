const electron = require("electron");
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");
const chokidar = require("chokidar");
const open = require("open");
const Rollbar = require("rollbar");
const AutoLaunch = require("auto-launch");
const { default: rpcChannels } = require("./rpcChannels");

// Make right-clicks show context menu (copy/paste/etc) on input fields
const inputMenu = require("electron-input-menu");
const context = require("electron-contextmenu-middleware");

context.use(inputMenu);
context.activate();

let watcher;

electron.contextBridge.exposeInMainWorld("pydtApi", {
  applyUpdate: () => {
    electron.ipcRenderer.invoke(rpcChannels.SET_FORCE_QUIT, true);
    electron.ipcRenderer.send(rpcChannels.APPLY_UPDATE);
  },
  startChokidar: arg => new Promise(resolve => {
    if (watcher) {
      watcher.close();
    }

    watcher = chokidar.watch(arg.path, {
      depth: 0,
      ignoreInitial: true,
      awaitWriteFinish: arg.awaitWriteFinish,
    });

    const changeDetected = p => {
      electron.ipcRenderer.send(rpcChannels.SHOW_WINDOW);
      watcher.close();
      watcher = null;
      resolve(p);
    };

    watcher.on("add", changeDetected);
    watcher.on("change", changeDetected);
  }),
  showToast: arg => {
    electron.ipcRenderer.send(rpcChannels.SHOW_NOTIFICATION, arg);
  },
  initRollbar: () => {
    new Rollbar({
      accessToken: "67488d20e1444df7ab91d279659d519a",
      captureUncaught: true,
      captureUnhandledRejections: true,
      payload: {
        environment: "prod",
      },
    });
  },
  openUrl: arg => {
    open(arg).catch(err => {
      electron.ipcRenderer.send(rpcChannels.LOG_ERROR, `Could not open URL ${arg}: ${err.message}`);
    });
  },
  setAutostart: arg => {
    electron.ipcRenderer.send(rpcChannels.LOG_INFO, "set-autostart");

    const launcher = new AutoLaunch({
      name: "Play Your Damn Turn Client",
      isHidden: true,
    });

    launcher
      .isEnabled()
      .then(isEnabled => {
        if (isEnabled && !arg) {
          electron.ipcRenderer.send(rpcChannels.LOG_INFO, "Disabling auto start...");
          return launcher.disable();
        }

        if (!isEnabled && !!arg) {
          electron.ipcRenderer.send(rpcChannels.LOG_INFO, "Enabling auto start...");
          return launcher.enable();
        }

        return null;
      })
      .catch(err => {
        electron.ipcRenderer.send(rpcChannels.LOG_ERROR, `Error toggling auto-start: ${err.message}`);
      });
  },
  showOpenDialog: async () => {
    const result = await electron.dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (!result.canceled && result.filePaths.length) {
      return result.filePaths[0];
    }

    return null;
  },
  ipc: {
    send: (channel, data) => {
      // whitelist channels
      if (Object.values(rpcChannels).includes(channel)) {
        electron.ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      if (Object.values(rpcChannels).includes(channel)) {
        // Deliberately strip event as it includes `sender`
        electron.ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    invoke: async (channel, ...args) => {
      if (Object.values(rpcChannels).includes(channel)) {
        return await electron.ipcRenderer.invoke(channel, ...args);
      }

      return null;
    },
    removeAllListeners: channel => {
      if (Object.values(rpcChannels).includes(channel)) {
        electron.ipcRenderer.removeAllListeners(channel);
      }
    },
    removeListener: (channel, func) => {
      if (Object.values(rpcChannels).includes(channel)) {
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
    statSync: p => fs.statSync(p),
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
