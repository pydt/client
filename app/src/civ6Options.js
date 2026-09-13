import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { default as log } from "electron-log";

// Helpers for finding and editing Civ 6's AppOptions.txt, and checking whether the game is running

const CIV6_DATA_DIR = "Sid Meier's Civilization VI";

// Proton data paths look like .../compatdata/289070/pfx/drive_c/users/steamuser/Documents/My Games/...
export const PROTON_RE = /^(.*[\\/]pfx[\\/]drive_c)[\\/]users[\\/]([^\\/]+)[\\/]/i;

const localAppData = () => process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");

const uniqueExisting = candidates => {
  const seen = new Set();
  const result = [];

  for (const c of candidates) {
    const n = path.normalize(c);

    if (!seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  }

  return result.find(p => fs.existsSync(p)) || null;
};

// Null if not found, which means the game has never been run
export const findAppOptionsPath = dataPath => {
  const dataDirName = path.basename(dataPath);
  const proton = PROTON_RE.exec(dataPath);

  if (proton) {
    const [, driveC, user] = proton;
    const firaxis = path.join(driveC, "users", user, "AppData", "Local", "Firaxis Games");

    return uniqueExisting([
      path.join(firaxis, dataDirName, "AppOptions.txt"),
      path.join(firaxis, CIV6_DATA_DIR, "AppOptions.txt"),
    ]);
  }

  switch (process.platform) {
    case "win32":
      return uniqueExisting([
        path.join(localAppData(), "Firaxis Games", dataDirName, "AppOptions.txt"),
        path.join(localAppData(), "Firaxis Games", CIV6_DATA_DIR, "AppOptions.txt"),
      ]);

    case "darwin":
      // Lives next to the Saves folder in ~/Library/Application Support/<game>/
      return uniqueExisting([
        path.join(path.dirname(dataPath), "AppOptions.txt"),
        path.join(dataPath, "AppOptions.txt"),
      ]);

    default:
      // Native Linux keeps everything under ~/.local/share/aspyr-media/<game>/
      return uniqueExisting([
        path.join(dataPath, "AppOptions.txt"),
        path.join(path.dirname(dataPath), "AppOptions.txt"),
      ]);
  }
};

const optionRe = key => new RegExp(`^${key}\\b[ \\t]*([^\\r\\n]*)`, "m");

// "" if the key is blank, null if it's absent
export const getAppOption = (text, key) => {
  const m = optionRe(key).exec(text);

  return m ? m[1].trim() : null;
};

export const setAppOption = (text, section, key, value) => {
  const line = `${key} ${value}`.trimEnd();
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const keyRe = optionRe(key);

  if (keyRe.test(text)) {
    // Function replacer so "$" in the value isn't treated as a replacement pattern
    return text.replace(keyRe, () => line);
  }

  const sectionRe = new RegExp(`^\\[${section}\\][^\\r\\n]*`, "m");
  const sectionMatch = sectionRe.exec(text);

  if (sectionMatch) {
    const insertAt = sectionMatch.index + sectionMatch[0].length;

    return `${text.slice(0, insertAt)}${eol}${line}${text.slice(insertAt)}`;
  }

  const sep = text.length && !text.endsWith("\n") ? eol : "";

  return `${text}${sep}${eol}[${section}]${eol}${line}${eol}`;
};

export const readOptions = appOptionsPath => fs.readFileSync(appOptionsPath, "utf8");

export const writeOptions = (appOptionsPath, text) => fs.writeFileSync(appOptionsPath, text, "utf8");

// Null if the process list can't be read
export const isCiv6Running = () => {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("tasklist", ["/FO", "CSV", "/NH"], { encoding: "utf8", windowsHide: true });

      return /^"CivilizationVI[^"]*\.exe"/im.test(out);
    }

    // macOS: "Civilization VI"; native Linux: "CivilizationVI"; Proton: "CivilizationVI*.exe"
    const out = execFileSync("ps", ["-axo", "comm="], { encoding: "utf8" });

    return /civilization ?vi\b|\bciv6\b/i.test(out);
  } catch (err) {
    log.warn(`Could not read process list: ${err.message}`);

    return null;
  }
};
