import { Injectable, inject } from "@angular/core";
import { BusyService, Game, GameService, GameTurnResponse } from "pydt-shared";
import { BehaviorSubject, firstValueFrom, merge, of, Subject } from "rxjs";
import { catchError, filter, map, timeout } from "rxjs/operators";
import { PydtSettingsData, PydtSettingsFactory } from "./pydtSettings";
import { SafeMetadataLoader } from "./safeMetadataLoader";
import { saveDownloadedTurn } from "./autoDownloadSave";
import { RPC_TO_MAIN } from "../rpcChannels";

const BASE_RETRY_BACKOFF_MS = 5000;
const MAX_RETRY_BACKOFF_MS = 5 * 60 * 1000;

export class TurnDownloader {
  private xhr: XMLHttpRequest;
  private downloading = false;
  private failureCount = 0;
  private nextAttemptAt = 0;
  public readonly data$ = new BehaviorSubject<{ data: Uint8Array; version?: string }>(null);
  public readonly error$ = new BehaviorSubject<string>(null);
  public readonly curBytes$ = new BehaviorSubject<number>(0);
  public readonly maxBytes$ = new BehaviorSubject<number>(0);

  constructor(
    public readonly game: Game,
    private readonly gameService: GameService,
    private readonly busyService: BusyService,
  ) {}

  abort(): void {
    this.downloading = false;

    if (this.xhr) {
      this.error$.next("ABORTED");
      this.xhr.abort();
      this.xhr = null;
    }

    this.data$.next(null);
    this.error$.next(null);
  }

  waitForCompletion(): Promise<void> {
    this.startDownload();

    return firstValueFrom(
      merge(this.data$.pipe(filter(v => v !== null)), this.error$.pipe(filter(v => v !== null))).pipe(
        map(() => undefined),
      ),
    );
  }

  private registerFailure(): void {
    this.failureCount++;
    this.nextAttemptAt = Date.now() + Math.min(BASE_RETRY_BACKOFF_MS * 2 ** this.failureCount, MAX_RETRY_BACKOFF_MS);
  }

  startDownload(): void {
    if (this.xhr || this.data$.value || this.downloading) {
      return;
    }

    if (Date.now() < this.nextAttemptAt) {
      // Still backing off after a recent failure - don't hammer the API, leave the
      // existing error$ in place so anyone awaiting waitForCompletion() resolves.
      return;
    }

    this.downloading = true;
    this.error$.next(null);
    this.curBytes$.next(0);
    this.maxBytes$.next(0);

    // Don't want this to trigger busy notifications...
    this.busyService.incrementBusy(false);

    this.gameService
      .getTurn(this.game.gameId, "yup")
      .pipe(catchError(() => of(null as GameTurnResponse)))
      .subscribe(
        resp => {
          if (!resp) {
            this.error$.next("Failed to load turn information, is your computer offline?");
            this.downloading = false;
            this.registerFailure();
            return;
          }

          if (!this.downloading) {
            // We must have aborted, don't start xhr!
            return;
          }

          this.xhr = new XMLHttpRequest();
          this.xhr.open("GET", resp.downloadUrl, true);
          this.xhr.responseType = "arraybuffer";

          this.xhr.onprogress = e => {
            if (e.lengthComputable) {
              this.curBytes$.next(Math.round(e.loaded / 1024));
              this.maxBytes$.next(Math.round(e.total / 1024));
            }
          };

          this.xhr.onerror = () => {
            this.error$.next(`Bad response code returned: ${this.xhr.status}`);
            this.xhr = null;
            this.downloading = false;
            this.registerFailure();
          };

          this.xhr.onload = async () => {
            const localXhr = this.xhr;

            this.xhr = null;

            try {
              this.curBytes$.next(this.maxBytes$.value);

              let data: Uint8Array<ArrayBufferLike> = new Uint8Array(localXhr.response as ArrayBuffer);

              try {
                data = await window.pydtApi.gunzip(data);
              } catch {
                // Ignore - file probably wasn't gzipped...
              }

              this.data$.next({
                data,
                version: resp.version,
              });
            } catch (err) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              this.error$.next(err);
            } finally {
              this.downloading = false;
            }
          };

          this.xhr.send();
        },
        () => {
          /* Ignore error */
        },
      )
      .add(() => this.busyService.incrementBusy(true));
  }
}

@Injectable()
export class TurnCacheService {
  private readonly gameService = inject(GameService);
  private readonly busyService = inject(BusyService);
  private readonly pydtSettingsFactory = inject(PydtSettingsFactory);
  private readonly metadataLoader = inject(SafeMetadataLoader);

  private readonly cache: TurnDownloader[] = [];
  private readonly savedVersions = new Set<string>();
  readonly completedGameIds$ = new Subject<string>();

  constructor() {
    void this.backgroundDownloader().then();
    void this.automaticTurnQueue().then();
  }

  async backgroundDownloader(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Wait 5 seconds for next check
      await new Promise(resolve => setTimeout(resolve, 5000));

      const settings = await this.pydtSettingsFactory.getSettings();

      if (settings.autoDownload) {
        for (const td of [...this.cache]) {
          if (!td.data$.value) {
            await td.waitForCompletion();
          }
        }
      }
    }
  }

  private async automaticTurnQueue(): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const settings = await this.pydtSettingsFactory.getSettings();
      const td = this.cache.find(candidate => {
        const versionKey = `${candidate.game.gameId}:${candidate.game.version}`;
        return !this.savedVersions.has(versionKey);
      });

      if (!settings.saveDownloadedTurns || !td) {
        continue;
      }

      try {
        if (!td.data$.value) {
          await td.waitForCompletion();
        }

        await this.processAutomaticTurn(td, settings);
      } catch (err) {
        // Keep the queue alive after temporary filesystem or network failures.
        // eslint-disable-next-line no-console
        console.error(`Unable to process automatic turn for ${td.game.displayName}`, err);
      }
    }
  }

  private async processAutomaticTurn(td: TurnDownloader, settings: PydtSettingsData): Promise<void> {
    const data = td.data$.value;
    const versionKey = `${td.game.gameId}:${td.game.version}`;

    if (!data || this.savedVersions.has(versionKey)) {
      return;
    }

    const metadata = await this.metadataLoader.loadMetadata();
    const civGame = metadata?.civGames.find(x => x.id === td.game.gameType);

    if (!civGame) {
      return;
    }

    const saveDir = settings.getSavePath(civGame);
    const saveFile = saveDownloadedTurn({
      saveDir,
      saveExtension: civGame.saveExtension,
      data: data.data,
      fs: window.pydtApi.fs,
      path: window.pydtApi.path,
    });

    // Let the handoff write settle before watching for the save created by Civ.
    await new Promise(resolve => setTimeout(resolve, 5000));
    const completedSave = await window.pydtApi.startChokidar({
      path: saveDir,
      awaitWriteFinish: civGame.awaitWriteFinish,
    });

    // Do not advance or rewrite the handoff after a temporary upload failure.
    // Keep retrying the completed save so the player's work remains intact.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.uploadCompletedTurn(td.game.gameId, completedSave);
        break;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Unable to upload automatic turn for ${td.game.displayName}; retrying`, err);
        window.pydtApi.ipc.send(
          RPC_TO_MAIN.LOG_ERROR,
          `Unable to upload automatic turn for ${td.game.displayName}: ${String(err)}`,
        );
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    const archiveDir = window.pydtApi.path.join(saveDir, "pydt-archive");
    if (!window.pydtApi.fs.existsSync(archiveDir)) {
      window.pydtApi.fs.mkdirp(archiveDir);
    }

    const archivedSave = window.pydtApi.path.join(
      archiveDir,
      `${td.game.gameId.slice(0, 8)}_${window.pydtApi.path.basename(completedSave)}`,
    );
    window.pydtApi.fs.renameSync(completedSave, archivedSave);

    if (window.pydtApi.fs.existsSync(saveFile)) {
      window.pydtApi.fs.unlinkSync(saveFile);
    }

    this.trimArchive(archiveDir, settings.numSaves);
    this.savedVersions.add(versionKey);
    this.completedGameIds$.next(td.game.gameId);
  }

  private async uploadCompletedTurn(gameId: string, saveFile: string): Promise<void> {
    window.pydtApi.ipc.send(RPC_TO_MAIN.LOG_INFO, `Compressing completed turn: ${saveFile}`);
    const fileData = await window.pydtApi.readFileGzipped(saveFile);
    window.pydtApi.ipc.send(RPC_TO_MAIN.LOG_INFO, `Starting turn submission: ${gameId}`);
    const startResp = await firstValueFrom(this.gameService.startSubmit(gameId));
    window.pydtApi.ipc.send(RPC_TO_MAIN.LOG_INFO, `Uploading completed turn: ${gameId}`);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", startResp.putUrl, true);
      xhr.timeout = 60000;
      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve();
        } else {
          reject(new Error(`Turn upload returned HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error(`Turn upload returned HTTP ${xhr.status}`));
      xhr.ontimeout = () => reject(new Error("Turn upload timed out"));
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.send(fileData as unknown as ArrayBuffer);
    });

    // The uploaded file is already durable at this point. Retry only the final
    // confirmation if the API stalls so the save is not uploaded repeatedly.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        window.pydtApi.ipc.send(RPC_TO_MAIN.LOG_INFO, `Finishing turn submission: ${gameId}`);
        await firstValueFrom(this.gameService.finishSubmit(gameId).pipe(timeout(60000)));
        break;
      } catch (err) {
        const httpError = err as { status?: number; message?: string; error?: unknown };
        const errorDetails = JSON.stringify({
          status: httpError.status,
          message: httpError.message,
          error: httpError.error,
        });
        // eslint-disable-next-line no-console
        console.error(`Unable to finish turn submission for ${gameId}; retrying`, err);
        window.pydtApi.ipc.send(
          RPC_TO_MAIN.LOG_ERROR,
          `Unable to finish turn submission for ${gameId}: ${errorDetails}`,
        );

        if (httpError.status >= 400 && httpError.status < 500) {
          throw err;
        }

        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    window.pydtApi.ipc.send(RPC_TO_MAIN.LOG_INFO, `Turn submission completed: ${gameId}`);
  }

  private trimArchive(archiveDir: string, numSaves: number): void {
    const files = window.pydtApi.fs
      .readdirSync(archiveDir)
      .flatMap(fileName => {
        const file = window.pydtApi.path.join(archiveDir, fileName);
        const stat = window.pydtApi.fs.statSync(file);
        return stat.isDirectory ? [] : [{ file, time: stat.ctime.getTime() }];
      })
      .sort((a, b) => a.time - b.time);

    while (files.length > numSaves) {
      window.pydtApi.fs.unlinkSync(files.shift().file);
    }
  }

  updateGames(games: Game[]): void {
    const newGames = games.filter(
      x => !this.cache.some(y => x.gameId === y.game.gameId && x.version === y.game.version),
    );
    const downloadersToRemove = this.cache.filter(
      x => !games.some(y => x.game.gameId === y.gameId && x.game.version === y.version),
    );

    for (const newGame of newGames) {
      this.cache.push(new TurnDownloader(newGame, this.gameService, this.busyService));
    }

    for (const dl of downloadersToRemove) {
      const i = this.cache.findIndex(x => x.game.gameId === dl.game.gameId && x.game.version === dl.game.version);

      this.cache[i].abort();
      this.cache.splice(i, 1);
      this.savedVersions.delete(`${dl.game.gameId}:${dl.game.version}`);
    }
  }

  get(gameId: string): TurnDownloader {
    return this.cache.find(x => x.game.gameId === gameId);
  }
}
