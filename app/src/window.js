import open from "open";
import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from "electron";
import * as path from "path";
import { default as windowStateKeeper } from "electron-window-state";
import { RPC_TO_MAIN, RPC_TO_RENDERER, RPC_INVOKE } from "./rpcChannels.js";
import { clearConfig, getConfig } from "./storage.js";
import { STORAGE_CONFIG } from "./storageConfig.js";

let win;
let forceQuit = false;
let appIcon;

let appIconGreen;
let appIconRed;
let darwinIconSize = 20;

ipcMain.handle(RPC_INVOKE.SET_FORCE_QUIT, (event, data) => (forceQuit = data));

ipcMain.on(RPC_TO_MAIN.UPDATE_TURNS_AVAILABLE, (event, available) => {
  win.setOverlayIcon(available ? path.join(__dirname, "../star.png") : null, available ? "Turns Available" : "");

  if (appIcon) {
    appIcon.setImage(available ? appIconRed : appIconGreen);
  }
});

const updateMenu = async () => {
  const config = await getConfig("configData");

  // Initialize icon images with electron's nativeImage
  if (!appIconGreen || !appIconRed) {
    appIconGreen = nativeImage.createFromPath(path.join(__dirname, "../icon.png"));
    appIconRed = nativeImage.createFromPath(path.join(__dirname, "../icon_red.png"));

    // Resize icons on macOS
    if (process.platform == "darwin") {
      appIconGreen = appIconGreen.resize({ height: darwinIconSize });
      appIconRed = appIconRed.resize({ height: darwinIconSize });
    }
  }

  // Hide dock icon on macOS
  if (process.platform == "darwin") {
    app.dock.hide();
  }

  if (!appIcon) {
    appIcon = new Tray(appIconGreen);
    appIcon.setToolTip("Play Your Damn Turn Client");
    appIcon.on("double-click", () => {
      win.show();
    });
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: win.isVisible() ? "Hide Client" : "Show Client",
      click: () => (win.isVisible() ? win.hide() : win.show()),
    },
    {
      label: "Exit",
      click: () => {
        forceQuit = true;
        app.quit();
      },
    },
  ]);

  appIcon.setContextMenu(contextMenu);

  const aboutClick = () => {
    win.show();
    win.send(RPC_TO_RENDERER.SHOW_ABOUT_MODAL, app.getVersion());
  };

  const settingsClick = () => {
    win.show();
    win.send(RPC_TO_RENDERER.SHOW_SETTINGS_MODAL);
  };

  const menuTemplate = [
    {
      label: "Options",
      submenu: [
        {
          label: "About",
          click: aboutClick,
        },
        {
          label: "Settings",
          click: settingsClick,
        },
        {
          label: "Quit",
          click: () => {
            forceQuit = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: "Debug",
      submenu: [
        {
          label: "Toggle Developer Tools",
          accelerator: process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          },
        },
        {
          label: "Clear Storage",
          click: async () => {
            await clearConfig();
            win.reload();
          },
        },
      ],
    },
    ...(config?.allTokens?.length
      ? [
          {
            label: "User",
            submenu: [
              ...config.allTokens.map(x => ({
                label: x.name,
                type: "radio",
                checked: x.token === config.token,
                click: () => win.send(RPC_TO_RENDERER.SET_USER, x.token),
              })),
              {
                label: "Add New User",
                click: () => win.send(RPC_TO_RENDERER.NEW_USER),
              },
            ],
          },
        ]
      : []),
    {
      label: "Donate!",
      click: () => {
        open("https://patreon.com/pydt");
      },
    },
  ];

  if (process.platform === "darwin") {
    menuTemplate.unshift(
      {
        label: app.getName(),
        submenu: [
          { label: "About", click: aboutClick },
          { label: "Settings", click: settingsClick },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "Edit",
        submenu: [{ role: "cut" }, { role: "copy" }, { role: "paste" }],
      },
    );
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
};

ipcMain.on(RPC_TO_MAIN.UPDATE_USERS, () => {
  updateMenu();
});

export const getAppIcon = () => appIcon;

export const getWindow = () => win;

export const createWindow = async () => {
  if (!win) {
    // Create the browser window.
    const mainWindowState = windowStateKeeper({
      defaultWidth: 500,
      defaultHeight: 350,
    });

    const settings = await getConfig(STORAGE_CONFIG.SETTINGS);

    win = new BrowserWindow({
      show: !settings?.startHidden,
      width: mainWindowState.width,
      height: mainWindowState.height,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        sandbox: false,
      },
    });

    mainWindowState.manage(win);

    // and load the index.html of the app.
    win.loadURL(`file://${__dirname}/../ui_compiled/index.html`);

    app.on("before-quit", () => {
      forceQuit = true;
    });

    win.on("close", e => {
      if (!forceQuit) {
        e.preventDefault();
        win.hide();
        e.returnValue = false;
      }
    });

    win.on("show", updateMenu);
    win.on("hide", updateMenu);
    win.on("minimize", updateMenu);
    win.on("maximize", updateMenu);
    win.on("unmaximize", updateMenu);
    win.on("restore", updateMenu);

    // Emitted when the window is closed.
    win.on("closed", () => {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      win = null;
    });

    updateMenu();
  }

  return win;
};

export const forceShowWindow = () => {
  if (win) {
    win.setAlwaysOnTop(true);
    win.show();
    win.focus();
    win.setAlwaysOnTop(false);
  }
};
