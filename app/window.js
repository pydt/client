const { app, BrowserWindow, ipcMain, Menu, Tray } = require("electron");
const path = require("path");
const storage = require("electron-json-storage");
const openPromise = import("open");
const windowStateKeeper = require("electron-window-state");
const { RPC_TO_MAIN, RPC_TO_RENDERER, RPC_INVOKE } = require("./rpcChannels");
const { getConfig } = require("./storage");

let win;
let forceQuit = false;
let appIcon;

ipcMain.handle(RPC_INVOKE.SET_FORCE_QUIT, (event, data) => (forceQuit = data));

ipcMain.on(RPC_TO_MAIN.UPDATE_TURNS_AVAILABLE, (event, available) => {
  win.setOverlayIcon(available ? path.join(__dirname, "star.png") : null, available ? "Turns Available" : "");

  if (appIcon) {
    appIcon.setImage(available ? path.join(__dirname, "icon_red.png") : path.join(__dirname, "icon.png"));
  }
});

const updateMenu = () => {
  const config = getConfig("configData");

  if (process.platform !== "darwin" && !appIcon) {
    const iconPath = path.join(__dirname, "icon.png");

    appIcon = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show Client",
        click: () => {
          win.show();
        },
      },
      {
        label: "Exit",
        click: () => {
          forceQuit = true;
          app.quit();
        },
      },
    ]);

    appIcon.setToolTip("Play Your Damn Turn Client");
    appIcon.setContextMenu(contextMenu);
    appIcon.on("double-click", () => {
      win.show();
    });
  }

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
          click: () => {
            storage.clear(() => {
              win.reload();
            });
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
        openPromise.then(open => open("https://patreon.com/pydt"));
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

module.exports = {
  getAppIcon: () => appIcon,
  getWindow: () => win,
  createWindow: () => {
    if (!win) {
      // Create the browser window.
      const mainWindowState = windowStateKeeper({
        defaultWidth: 500,
        defaultHeight: 350,
      });

      win = new BrowserWindow({
        width: mainWindowState.width,
        height: mainWindowState.height,
        webPreferences: {
          preload: path.join(__dirname, "preload.js"),
          sandbox: false,
        },
      });

      mainWindowState.manage(win);

      // and load the index.html of the app.
      win.loadURL(`file://${__dirname}/ui_compiled/index.html`);

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
  },
  forceShowWindow: () => {
    if (win) {
      win.setAlwaysOnTop(true);
      win.show();
      win.focus();
      win.setAlwaysOnTop(false);
    }
  },
};
