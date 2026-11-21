import { default as log } from "electron-log";
import {
  ROLLBAR_CONFIG,
  ROLLBAR_DISABLED,
  ROLLBAR_REMOTE_CONFIG_POLL_MS,
  ROLLBAR_REMOTE_CONFIG_URL,
  createOncePerRunFilter,
  resolveRollbarSettings,
  rewriteFramePaths,
} from "./rollbarConfig.js";
import { RPC_INVOKE, RPC_TO_RENDERER } from "./rpcChannels.js";

// The main process owns the remote switch: it fetches the API's settings at
// startup and every hour, applies them to its own Rollbar, and sends them to the
// window (which asks for the current value when it starts). Clients are often
// left running for days, so the polling is what makes the switch effective.

let current = ROLLBAR_DISABLED;

const fetchRemoteConfig = async () => {
  try {
    const response = await fetch(ROLLBAR_REMOTE_CONFIG_URL, { signal: AbortSignal.timeout(15000) });

    return response.ok ? await response.json() : null;
  } catch (e) {
    log.info(`Couldn't fetch Rollbar settings: ${e.message}`);
    return null;
  }
};

export const initRollbar = (app, ipcMain, getWindow) => {
  ipcMain.handle(RPC_INVOKE.GET_ROLLBAR_SETTINGS, () => current);

  // Development runs (npm run electron) don't report.
  if (!app.isPackaged) {
    return;
  }

  // Rollbar 2.x swallowed uncaught errors even while disabled (the remote switch is
  // off by default); since 4.1 they reach Electron, which shows a "JavaScript error
  // in the main process" dialog. Keep the old quiet behavior, but log them. When
  // reporting is on, Rollbar's own handlers still send them.
  process.on("uncaughtException", err => log.error("Uncaught exception in main process:", err));
  process.on("unhandledRejection", reason => log.error("Unhandled rejection in main process:", reason));

  const Rollbar = require("rollbar");
  const version = app.getVersion();

  // Starts disabled; the first fetch decides. Errors in the first few seconds
  // are lost, which is the price of never reporting when the switch is off.
  const rollbar = new Rollbar({
    ...ROLLBAR_CONFIG,
    enabled: false,
    // Same "<version>-<platform>" as the window (see createEnv.js).
    codeVersion: `${version}-${process.platform}`,
    checkIgnore: createOncePerRunFilter(),
    transform: rewriteFramePaths,
  });

  const refresh = async () => {
    const settings = resolveRollbarSettings(await fetchRemoteConfig(), version);

    if (settings.enabled !== current.enabled) {
      log.info(`Rollbar reporting ${settings.enabled ? "enabled" : "disabled"} by remote settings`);
    }

    current = settings;
    rollbar.configure({ enabled: settings.enabled, ignoredMessages: settings.ignoredMessages });

    const win = getWindow();

    if (win && !win.isDestroyed()) {
      win.webContents.send(RPC_TO_RENDERER.ROLLBAR_SETTINGS, settings);
    }
  };

  refresh();
  setInterval(refresh, ROLLBAR_REMOTE_CONFIG_POLL_MS);
};
