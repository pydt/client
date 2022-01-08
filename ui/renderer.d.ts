import { RPC_INVOKE, RPC_TO_MAIN, RPC_TO_RENDERER } from "./rpcChannels";

export interface PydtApi {
  openUrl: (url: string) => void;
  setAutostart: (enable: boolean) => void;
  startChokidar: (params: { path: string; awaitWriteFinish: boolean }) => Promise<string>;
  ipc: {
    send: (channel: RPC_TO_MAIN, data: unknown) => void;
    receive: <T>(channel: RPC_TO_RENDERER, func: (arg: T) => void) => void;
    invoke: <T>(channel: RPC_INVOKE, ...args: unknown[]) => Promise<T>;
    removeListener: (channel: RPC_TO_RENDERER, func: (...args: unknown[]) => void) => void;
    removeAllListeners: (channel: RPC_TO_RENDERER) => void;
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
  platform: string;
}

declare global {
  interface Window {
    pydtApi: PydtApi;
  }
}
