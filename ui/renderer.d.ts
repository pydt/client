export interface PydtApi {
  applyUpdate: () => void;
  openUrl: (url: string) => void;
  setAutostart: (enable: boolean) => void;
  showOpenDialog: () => Promise<string>;
  showToast: (params: { title: string; message: string }) => void;
  startChokidar: (params: { path: string; awaitWriteFinish: boolean }) => Promise<string>;
  ipc: {
    send: (channel: string, data: any) => void;
    receive: (channel: string, func: (...args: any[]) => void) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    removeListener: (channel: string, func: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  }
  fs: {
    existsSync: (path: string) => boolean;
    mkdirp: (path: string) => void;
    readFileSync: (path: string) => Uint8Array;
    readdirSync: (path: string) => string[];
    renameSync: (oldPath: string, newPath: string) => void;
    statSync: (path: string) => any;
    unlinkSync: (path: string) => void;
    writeFileSync: (path: string, data: Uint8Array) => void;
  }
  path: {
    basename: (path: string) => string;
    join: (...paths: string[]) => string;
    normalize: (path: string) => string;
  }
  storage: {
    get: (key: string, callback: (err: any, data: any) => void) => void;
    set: (key: string, data: any, callback: (err: any) => void) => void;
  }
  platform: string;
}

declare global {
  interface Window {
    pydtApi: PydtApi;
  }
}
