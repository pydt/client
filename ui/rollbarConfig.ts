// Shared by the renderer (window) and, via `npm run generate-shared`, the main
// process. That step compiles this file with plain `tsc` defaults (ES5 lib), so
// keep it to ES5-era APIs: no Set/Map, Array.includes or Object.entries.

// CivX-Client's post_client_item token (client tokens are meant to ship in apps;
// they can only report items). Rollbar's free tier can't rate-limit a token, so
// flood protection is the per-run caps below plus the API's remote switch. The
// old token (5555ee71...) stays disabled, which keeps clients older than this
// release silent.
const ROLLBAR_CLIENT_TOKEN =
  "726ff135dcc9437a896ed0a58d99a8cf2df9b8565128a27ef32f414852bb75a0903455f62367da66cd84d63fa3a4cf7c";

export const ROLLBAR_CONFIG = {
  accessToken: ROLLBAR_CLIENT_TOKEN,
  captureUncaught: true,
  captureUnhandledRejections: true,
  environment: "production",
  // Only errors, and only a handful per app run, however long it stays open.
  reportLevel: "error" as const,
  itemsPerMinute: 5,
  maxItems: 20,
  ignoredMessages: [
    "Http failure response for https://api.playyourdamnturn.com/",
    "net::ERR_",
    "GET url: https://objects.githubusercontent.com/",
    "GET url: https://github.com/pydt/client/releases",
    "ENOENT: no such file or directory, open",
  ],
};

// Remote switch, served by the API (api/controllers/clientController.ts). The
// main process fetches it at startup and every hour, and passes the result to
// the window. If it can't be fetched, the client doesn't report.
export const ROLLBAR_REMOTE_CONFIG_URL = "https://api.playyourdamnturn.com/client/rollbarConfig";
export const ROLLBAR_REMOTE_CONFIG_POLL_MS = 60 * 60 * 1000;

export interface RollbarRemoteConfig {
  enabled: boolean;
  minVersion?: string;
  ignoredMessages?: string[];
}

export interface RollbarSettings {
  enabled: boolean;
  ignoredMessages: string[];
}

export const ROLLBAR_DISABLED: RollbarSettings = { enabled: false, ignoredMessages: ROLLBAR_CONFIG.ignoredMessages };

const versionParts = (version: string): number[] =>
  String(version || "0")
    .split("-")[0]
    .split(".")
    .map(x => parseInt(x, 10) || 0);

// True when version >= minVersion (numeric major.minor.patch comparison).
export const isVersionAtLeast = (version: string, minVersion: string): boolean => {
  const a = versionParts(version);
  const b = versionParts(minVersion);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);

    if (diff !== 0) {
      return diff > 0;
    }
  }

  return true;
};

// Turns the remote config into the settings to apply for this client version.
// Anything missing or malformed means "don't report".
export const resolveRollbarSettings = (remote: unknown, version: string): RollbarSettings => {
  const config = remote as RollbarRemoteConfig;

  if (!config || config.enabled !== true) {
    return ROLLBAR_DISABLED;
  }

  if (config.minVersion && !isVersionAtLeast(version, config.minVersion)) {
    return ROLLBAR_DISABLED;
  }

  const extra = Array.isArray(config.ignoredMessages)
    ? config.ignoredMessages.filter(x => typeof x === "string" && x.length > 0)
    : [];

  return { enabled: true, ignoredMessages: ROLLBAR_CONFIG.ignoredMessages.concat(extra) };
};

// The parts of Rollbar's item payload the helpers below read or rewrite.
interface RollbarFrame {
  filename?: string;
  lineno?: number;
}

interface RollbarTrace {
  exception?: { class?: string; message?: string };
  frames?: RollbarFrame[];
}

interface RollbarPayload {
  body?: {
    trace?: RollbarTrace;
    // eslint-disable-next-line camelcase
    trace_chain?: RollbarTrace[];
    message?: { body?: string };
  };
}

// The same error firing in a loop (file watcher, retries, reconnects) is what
// floods. Report each distinct error once per app run. Use as Rollbar's
// checkIgnore (returning true drops the item).
export const createOncePerRunFilter = (): ((isUncaught: boolean, args: unknown[], payload: object) => boolean) => {
  const seen: Record<string, boolean> = {};
  let count = 0;

  return (_isUncaught: boolean, _args: unknown[], payload: object): boolean => {
    const body = (payload as RollbarPayload)?.body || {};
    const trace: RollbarTrace = body.trace || (body.trace_chain && body.trace_chain[0]) || {};
    const exception = trace.exception || {};
    const frames = trace.frames || [];
    const top: RollbarFrame = frames[frames.length - 1] || {};
    const message = exception.message || (body.message && body.message.body) || "";
    const key = `${exception.class || ""}|${message}|${top.filename || ""}:${top.lineno || ""}`;

    if (seen[key]) {
      return true;
    }

    // Bound the memory for a client left open for weeks.
    if (count < 500) {
      seen[key] = true;
      count++;
    }

    return false;
  };
};

// Stack frames carry each user's install path (file:///C:/Users/<name>/.../app.asar/ui_compiled/main.js),
// which can't be matched to uploaded source maps and leaks the user's name. Rewrite
// everything up to the app folder to a fixed host, matching the URLs CI uploads
// maps for (http://pydt-client/ui_compiled/main.js). Use as Rollbar's transform.
export const ROLLBAR_FRAME_HOST = "http://pydt-client/";

export const rewriteFramePaths = (payload: object): void => {
  const body = (payload as RollbarPayload)?.body || {};
  const traces: RollbarTrace[] = body.trace_chain || (body.trace ? [body.trace] : []);

  for (let i = 0; i < traces.length; i++) {
    const frames = (traces[i] && traces[i].frames) || [];

    for (let j = 0; j < frames.length; j++) {
      const filename = String(frames[j].filename || "").replace(/\\/g, "/");
      const match = /(?:^|\/)((?:ui_compiled|app_compiled)\/.*)$/.exec(filename);

      if (match) {
        frames[j].filename = ROLLBAR_FRAME_HOST + match[1];
      }
    }
  }
};
