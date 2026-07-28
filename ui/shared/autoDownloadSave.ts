export interface AutoDownloadFileSystem {
  existsSync(path: string): boolean;
  mkdirp(path: string): void;
  writeFileSync(path: string, data: Uint8Array): void;
}

export interface AutoDownloadPath {
  join(...paths: string[]): string;
}

export interface AutoDownloadSaveOptions {
  saveDir: string;
  saveExtension: string;
  data: Uint8Array;
  fs: AutoDownloadFileSystem;
  path: AutoDownloadPath;
}

export const autoDownloadFileName = (saveExtension: string): string => `(PYDT) Play This One!.${saveExtension}`;

export const saveDownloadedTurn = (options: AutoDownloadSaveOptions): string => {
  if (!options.fs.existsSync(options.saveDir)) {
    options.fs.mkdirp(options.saveDir);
  }

  const saveFile = options.path.join(options.saveDir, autoDownloadFileName(options.saveExtension));

  options.fs.writeFileSync(saveFile, options.data);

  return saveFile;
};
