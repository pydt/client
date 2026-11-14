import electron from "electron";
import * as fs from "fs";
import * as path from "path";
import { default as log } from "electron-log";
import { RPC_INVOKE } from "./rpcChannels.js";
import {
  PROTON_RE,
  findAppOptionsPath,
  getAppOption,
  setAppOption,
  readOptions,
  writeOptions,
  isCiv6Running,
} from "./civ6Options.js";

// This file handles setting up the AutoHotseat mod, as well as setting the key PlayNowSave in AppOptions.txt.
// Normally PlayNowSave loads the save file in single player mode, but to coerce the game into loading
// the file as Hotseat we use the AutoHotseat mod that instead clicks through the main menu on the user's behalf.
//
// Both are scoped to a turn: prepareAutostart before launch, revertAutostart afterwards. The mod is only
// removed once the game has exited, so revert polls for that when asked to.

const MOD_NAME = "Civ6Autohotseat";
const EXIT_POLL_MS = 10 * 1000;

// How long after we think the game is over that we keep polling to try to uninstall the mod
const EXIT_POLL_MAX_MS = 60 * 60 * 1000;

const modSourceDir = () =>
  electron.app.isPackaged
    ? path.join(process.resourcesPath, "mods", MOD_NAME)
    : path.join(electron.app.getAppPath(), "mods", MOD_NAME);

const modTarget = dataPath => path.join(dataPath, "Mods", MOD_NAME);

const isModInstalled = dataPath => fs.existsSync(path.join(modTarget(dataPath), `${MOD_NAME}.modinfo`));

// Convert a host path into the form the game itself will understand.
export const toGamePath = (hostPath, dataPath) => {
  const proton = PROTON_RE.exec(dataPath);

  if (proton) {
    const driveC = proton[1];
    const normalized = path.normalize(hostPath);

    if (normalized.toLowerCase().startsWith(path.normalize(driveC).toLowerCase())) {
      return `C:${normalized.slice(driveC.length).replace(/\//g, "\\")}`;
    }
  }

  return path.normalize(hostPath);
};

// Copies the bundled mod into the game data path
export const installMod = dataPath => {
  const source = modSourceDir();

  if (!fs.existsSync(path.join(source, `${MOD_NAME}.modinfo`))) {
    throw new Error(`Bundled ${MOD_NAME} mod not found at ${source}`);
  }

  const target = modTarget(dataPath);
  fs.cpSync(source, target, { recursive: true, force: true });

  return target;
};

// Removes the mod once we are done
const removeMod = dataPath => {
  try {
    fs.rmSync(modTarget(dataPath), { recursive: true, force: true });
  } catch (err) {
    log.warn(`Civ 6 autostart: could not fully remove ${modTarget(dataPath)}: ${err.message}`);
  }

  return !isModInstalled(dataPath);
};

// Sets the key PlayNowSave in AppOptions.txt
const setPlayNowSave = (appOptionsPath, value) => {
  const text = readOptions(appOptionsPath);

  if (getAppOption(text, "PlayNowSave") !== value) {
    writeOptions(appOptionsPath, setAppOption(text, "Debug", "PlayNowSave", value));
  }
};

export const prepareAutostart = ({ dataPath, savePath }) => {
  try {
    const appOptionsPath = findAppOptionsPath(dataPath);

    if (!appOptionsPath) {
      return { ok: false, message: `AppOptions.txt not found for ${dataPath} (has the game been run once?)` };
    }

    cancelPendingRevert();

    const target = installMod(dataPath);
    const gameSavePath = toGamePath(savePath, dataPath);
    setPlayNowSave(appOptionsPath, gameSavePath);

    const message = `Civ 6 autostart armed: mod at ${target}, PlayNowSave=${gameSavePath} in ${appOptionsPath}`;
    log.info(message);

    return { ok: true, message };
  } catch (err) {
    const message = `Civ 6 autostart setup failed: ${err.message}`;
    log.error(message);

    return { ok: false, message };
  }
};

// Clears PlayNowSave in AppOptions.txt and delete the mod
export const revertAutostart = ({ dataPath, waitForExit = false }) => {
  try {
    const appOptionsPath = findAppOptionsPath(dataPath);

    const result = (complete, note) => {
      const message = `Civ 6 autostart revert: ${note}`;
      log.info(message);

      return { ok: true, complete, message };
    };

    if (appOptionsPath) {
      setPlayNowSave(appOptionsPath, "");
    }

    if (!isModInstalled(dataPath)) {
      cancelPendingRevert();

      return result(true, "nothing to revert");
    }

    if (isCiv6Running()) {
      if (waitForExit) {
        schedulePendingRevert(dataPath);
      }

      return result(false, "Civ 6 is running! Mod removal deferred");
    }

    const modGone = removeMod(dataPath);

    if (modGone) {
      cancelPendingRevert();
    } else if (waitForExit) {
      schedulePendingRevert(dataPath);
    }

    return result(modGone, modGone ? "mod removed" : "mod removal failed; will retry");
  } catch (err) {
    const message = `Civ 6 autostart revert failed: ${err.message}`;
    log.error(message);

    return { ok: false, complete: false, message };
  }
};

let pendingRevert = null;

const cancelPendingRevert = () => {
  clearInterval(pendingRevert);
  pendingRevert = null;
};

// If we can't revert the mod installation right away, we can schedule another attempt
// in a couple seconds.
const schedulePendingRevert = dataPath => {
  if (pendingRevert) {
    return;
  }

  const startedAt = Date.now();

  pendingRevert = setInterval(() => {
    if (Date.now() - startedAt > EXIT_POLL_MAX_MS) {
      log.warn("Civ 6 autostart: gave up waiting for the game to exit.");
      cancelPendingRevert();
    } else if (isCiv6Running() !== true) {
      revertAutostart({ dataPath });
    }
  }, EXIT_POLL_MS);
};

electron.ipcMain.handle(RPC_INVOKE.CIV6_AUTOSTART_PREPARE, (e, arg) => prepareAutostart(arg));
electron.ipcMain.handle(RPC_INVOKE.CIV6_AUTOSTART_REVERT, (e, arg) => revertAutostart(arg));
