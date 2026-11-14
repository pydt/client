import electron from "electron";
import * as fs from "fs";
import * as path from "path";
import { default as log } from "electron-log";
import { RPC_INVOKE } from "./rpcChannels.js";
import { findCiv6InstallDir } from "./civ6Installation.js";
import { getConfig, setConfig } from "./storage.js";
import { STORAGE_CONFIG } from "./storageConfig.js";
import {
  findAppOptionsPath,
  getAppOption,
  setAppOption,
  readOptions,
  writeOptions,
  isCiv6Running,
} from "./civ6Options.js";

// Skip Civ 6's startup movies before launching a turn: set PlayIntroVideo 0 in AppOptions.txt
// (same as the in-game option; set back to 1 when the setting is turned off).
// For Windows we can go a step farther and prevent the game from opening the two logo
// videos as well by holding open handles against them with exclusive read.

const LOGO_MOVIES = ["logos.bk2", "LOGO_2KFiraxis.bk2"];

const UV_FS_O_EXLOCK = 0x10000000; // Maps to FILE_SHARE_NONE on Windows
const LOGO_LOCK_POLL_MS = 5 * 1000;
const LOGO_LOCK_START_TIMEOUT_MS = 5 * 60 * 1000;
const LOGO_LOCK_MAX_MS = 6 * 60 * 60 * 1000;
const REVERT_POLL_MS = 10 * 1000;
const REVERT_MAX_MS = 6 * 60 * 60 * 1000;

export const logoMoviePaths = dataPath => {
  const install = findCiv6InstallDir(dataPath);

  if (!install) {
    return [];
  }

  return LOGO_MOVIES.map(m => path.join(install, "Base", "Platforms", "Windows", "Movies", m)).filter(p =>
    fs.existsSync(p),
  );
};

let logoLock = null; // { fds, timer }

export const releaseLogoMovies = () => {
  if (!logoLock) {
    return false;
  }

  clearInterval(logoLock.timer);

  for (const fd of logoLock.fds) {
    try {
      fs.closeSync(fd);
    } catch {
      // Already closed
    }
  }

  const count = logoLock.fds.length;
  logoLock = null;
  log.info(`Civ 6 intro skip: released ${count} logo movie lock(s)`);

  return true;
};

// Released once the game has run and exited, if it never starts, or after a long timeout
export const lockLogoMovies = dataPath => {
  releaseLogoMovies();

  const files = logoMoviePaths(dataPath);
  const fds = [];

  for (const file of files) {
    try {
      fds.push(fs.openSync(file, fs.constants.O_RDONLY | UV_FS_O_EXLOCK));
    } catch (err) {
      log.warn(`Civ 6 intro skip: could not lock ${file}: ${err.message}`);
    }
  }

  if (!fds.length) {
    return 0;
  }

  const startedAt = Date.now();
  let seenRunning = false;

  logoLock = {
    fds,
    timer: setInterval(() => {
      const running = isCiv6Running();
      const elapsed = Date.now() - startedAt;

      if (running === true) {
        seenRunning = true;
      } else if (seenRunning || elapsed > LOGO_LOCK_START_TIMEOUT_MS) {
        releaseLogoMovies();
      }

      if (logoLock && elapsed > LOGO_LOCK_MAX_MS) {
        releaseLogoMovies();
      }
    }, LOGO_LOCK_POLL_MS),
  };

  log.info(`Civ 6 intro skip: locked ${fds.length} logo movie(s) in ${path.dirname(files[0])}`);

  return fds.length;
};

// AppOptions.txt files where PYDT (not the player) turned PlayIntroVideo off. We only turn it back on
// for these, so a player who disabled the intro themselves in game keeps their choice.
const loadChangedPaths = async () => {
  try {
    const data = await getConfig(STORAGE_CONFIG.CIV6_INTRO_SKIP);

    return new Set(Array.isArray(data?.changedAppOptionsPaths) ? data.changedAppOptionsPaths : []);
  } catch (err) {
    log.warn(`Civ 6 intro skip: could not read state: ${err.message}`);

    return new Set();
  }
};

const saveChangedPaths = paths => setConfig(STORAGE_CONFIG.CIV6_INTRO_SKIP, { changedAppOptionsPaths: [...paths] });

// dataPath is the Civ 6 user data folder (parent of Saves/).
export const prepareIntroSkip = async ({ dataPath }) => {
  try {
    cancelPendingRevert();

    const appOptionsPath = findAppOptionsPath(dataPath);
    const notes = [];

    if (appOptionsPath) {
      const text = readOptions(appOptionsPath);

      if (getAppOption(text, "PlayIntroVideo") !== "0") {
        writeOptions(appOptionsPath, setAppOption(text, "Video", "PlayIntroVideo", "0"));

        const changed = await loadChangedPaths();
        changed.add(appOptionsPath);
        await saveChangedPaths(changed);

        notes.push(`PlayIntroVideo=0 in ${appOptionsPath}`);
      }
    } else {
      notes.push(`AppOptions.txt not found for ${dataPath} (has the game been run once?)`);
    }

    const locked = lockLogoMovies(dataPath);

    if (locked) {
      notes.push(`${locked} logo movie(s) locked`);
    }

    const message = `Civ 6 intro skip: ${notes.length ? notes.join("; ") : "nothing to do"}`;
    log.info(message);

    return { ok: true, message };
  } catch (err) {
    const message = `Civ 6 intro skip failed: ${err.message}`;
    log.error(message);

    return { ok: false, message };
  }
};

// Turn the intro video back on once the setting is off, but only if PYDT was the one that turned it off.
export const revertIntroSkip = async ({ dataPath }) => {
  try {
    const notes = [];

    if (releaseLogoMovies()) {
      notes.push("logo movies released");
    }

    const appOptionsPath = findAppOptionsPath(dataPath);
    const changed = await loadChangedPaths();

    if (appOptionsPath && changed.has(appOptionsPath)) {
      if (getAppOption(readOptions(appOptionsPath), "PlayIntroVideo") !== "0") {
        // Already back on, nothing left for us to undo
        changed.delete(appOptionsPath);
        await saveChangedPaths(changed);
        cancelPendingRevert();
      } else if (isCiv6Running()) {
        schedulePendingRevert(dataPath);
        notes.push("Civ 6 is running; PlayIntroVideo will be restored when it exits");
      } else {
        writeOptions(appOptionsPath, setAppOption(readOptions(appOptionsPath), "Video", "PlayIntroVideo", "1"));
        changed.delete(appOptionsPath);
        await saveChangedPaths(changed);
        cancelPendingRevert();
        notes.push(`PlayIntroVideo=1 in ${appOptionsPath}`);
      }
    }

    const message = `Civ 6 intro skip revert: ${notes.length ? notes.join("; ") : "nothing to do"}`;
    log.info(message);

    return { ok: true, message };
  } catch (err) {
    const message = `Civ 6 intro skip revert failed: ${err.message}`;
    log.error(message);

    return { ok: false, message };
  }
};

let pendingRevert = null;

const cancelPendingRevert = () => {
  if (pendingRevert) {
    clearInterval(pendingRevert.timer);
    pendingRevert = null;
  }
};

const schedulePendingRevert = dataPath => {
  if (pendingRevert) {
    return;
  }

  const startedAt = Date.now();

  pendingRevert = {
    timer: setInterval(() => {
      if (Date.now() - startedAt > REVERT_MAX_MS) {
        log.warn("Civ 6 intro skip: gave up waiting for the game to exit");
        cancelPendingRevert();
        return;
      }

      if (isCiv6Running() !== true) {
        revertIntroSkip({ dataPath });
      }
    }, REVERT_POLL_MS),
  };
};

electron.ipcMain.handle(RPC_INVOKE.CIV6_INTRO_SKIP_PREPARE, (e, arg) => prepareIntroSkip(arg));
electron.ipcMain.handle(RPC_INVOKE.CIV6_INTRO_SKIP_REVERT, (e, arg) => revertIntroSkip(arg));
