export interface PydtApi {
  applyUpdate: () => void;
  openUrl: (url: string) => void;
  setAutostart: (enable: boolean) => void;
  showOpenDialog: () => Promise<string>;
  showToast: (params: { title: string; message: string }) => void;
  startChokidar: (params: { path: string; awaitWriteFinish: boolean }) => Promise<string>;
  ipc: {
    send: (channel: string, data: unknown) => void;
    receive: <T>(channel: string, func: (arg: T) => void) => void;
    invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>;
    removeListener: (channel: string, func: (...args: unknown[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  }
  fs: {
    existsSync: (path: string) => boolean;
    mkdirp: (path: string) => void;
    readFileSync: (path: string) => Uint8Array;
    readdirSync: (path: string) => string[];
    renameSync: (oldPath: string, newPath: string) => void;
    statSync: (path: string) => { ctime: { getTime(): number} };
    unlinkSync: (path: string) => void;
    writeFileSync: (path: string, data: Uint8Array) => void;
  }
  path: {
    basename: (path: string) => string;
    join: (...paths: string[]) => string;
    normalize: (path: string) => string;
  }
  storage: {
    get: <T>(key: string, callback: (err: Error, data: T) => void) => void;
    set: (key: string, data: unknown, callback: (err: Error) => void) => void;
  }
  platform: string;
}

declare global {
  interface Window {
    pydtApi: PydtApi;
  }
}
