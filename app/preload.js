const electron = require("electron");
const log = require("electron-log");
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");
const chokidar = require("chokidar");
const notifier = require("node-notifier");
const open = require("open");
const appUpdater = require("./appUpdater");
const Rollbar = require("rollbar");
const AutoLaunch = require("auto-launch");
const { default: rpcChannels } = require("./rpcChannels");

// Make right-clicks show context menu (copy/paste/etc) on input fields
const inputMenu = require('electron-input-menu');
const context = require('electron-contextmenu-middleware');

context.use(inputMenu);
context.activate();

let watcher;

notifier.on("click", () => {
  // TODO: windows click was broken in v6, upgrade after this fix is merged in
  // https://github.com/mikaelbr/node-notifier/issues/291
  electron.ipcRenderer.send(rpcChannels.SHOW_WINDOW);
});

electron.contextBridge.exposeInMainWorld("pydtApi", {
  applyUpdate: () => {
    electron.ipcRenderer.invoke(rpcChannels.SET_FORCE_QUIT, true);
    appUpdater.applyUpdate();
  },
  startChokidar: (arg) => {
    return new Promise((resolve) => {
      if (watcher) {
        watcher.close();
      }

      watcher = chokidar.watch(arg.path, {
        depth: 0,
        ignoreInitial: true,
        awaitWriteFinish: arg.awaitWriteFinish,
      });

      const changeDetected = (path) => {
        electron.ipcRenderer.send(rpcChannels.SHOW_WINDOW);
        watcher.close();
        watcher = null;
        resolve(path);
      };

      watcher.on("add", changeDetected);
      watcher.on("change", changeDetected);
    });
  },
  showToast: (arg) => {
    if (__dirname.indexOf("app.asar") > 0) {
      const splitDirname = __dirname.split(path.sep);
      const rootPath = path.join.apply(
        this,
        splitDirname.slice(0, splitDirname.length - 2)
      );

      arg.icon = path.join(rootPath, "Contents/app/icon.png");

      if (!fs.existsSync(arg.icon))
        arg.icon = path.join(rootPath, "app/icon.png");
    } else {
      arg.icon = path.join(__dirname, "icon.png");
    }

    arg.appID = "com.squirrel.playyourdamnturn.PlayYourDamnTurnClient";

    arg.wait = true;
    notifier.notify(arg);
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
  openUrl: (arg) => {
    open(arg).catch((err) => {
      log.error(`Could not open URL ${arg}: ${err.message}`);
    });
  },
  setAutostart: (arg) => {
    log.info("set-autostart");

    const launcher = new AutoLaunch({
      name: "Play Your Damn Turn Client",
      isHidden: true,
    });

    launcher
      .isEnabled()
      .then((isEnabled) => {
        if (isEnabled && !arg) {
          log.warn("Disabling auto start...");
          return launcher.disable();
        }

        if (!isEnabled && !!arg) {
          log.warn("Enabling auto start...");
          return launcher.enable();
        }
      })
      .catch((err) => {
        log.error("Error toggling auto-start: ", err.message);
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
    },
    removeAllListeners: (channel) => {
      if (Object.values(rpcChannels).includes(channel)) {
        electron.ipcRenderer.removeAllListeners(channel);
      }
    },
    removeListener: (channel, func) => {
      if (Object.values(rpcChannels).includes(channel)) {
        electron.ipcRenderer.removeListener(channel, func);
      }
    }
  },
  fs: {
    existsSync: (path) => fs.existsSync(path),
    mkdirp: (path) => mkdirp.sync(path),
    readdirSync: (path) => fs.readdirSync(path),
    readFileSync: (path) => fs.readFileSync(path),
    renameSync: (oldPath, newPath) => fs.renameSync(oldPath, newPath),
    statSync: (path) => fs.statSync(path),
    unlinkSync: (path) => fs.unlinkSync(path),
    writeFileSync: (path, data) => fs.writeFileSync(path, Buffer.from(data)),
  },
  path: {
    basename: (p) => path.basename(p),
    join: (...paths) => path.join(...paths),
    normalize: (p) => path.normalize(p),
  },
  platform: process.platform,
});
