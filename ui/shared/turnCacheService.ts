import { Injectable } from "@angular/core";
import * as pako from "pako";
import { BusyService, Game, GameService, GameTurnResponse } from "pydt-shared";
import { BehaviorSubject, of } from "rxjs";
import { catchError } from "rxjs/operators";
import { PydtSettingsFactory } from "./pydtSettings";

export class TurnDownloader {
  private xhr: XMLHttpRequest;
  private downloading = false;
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

    return new Promise(resolve => {
      this.error$.subscribe(err => {
        if (err) {
          resolve(null);
        }
      });

      this.data$.subscribe(data => {
        if (data) {
          resolve(null);
        }
      });
    });
  }

  startDownload(): void {
    if (this.xhr || this.data$.value || this.downloading) {
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
          };

          this.xhr.onload = () => {
            const localXhr = this.xhr;

            this.xhr = null;

            try {
              this.curBytes$.next(this.maxBytes$.value);

              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              let data = new Uint8Array(localXhr.response);

              try {
                data = pako.ungzip(data);
              } catch (e) {
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
  private readonly cache: TurnDownloader[] = [];

  constructor(
    private readonly gameService: GameService,
    private readonly busyService: BusyService,
    private readonly pydtSettingsFactory: PydtSettingsFactory,
  ) {
    void this.backgroundDownloader().then();
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
    }
  }

  get(gameId: string): TurnDownloader {
    return this.cache.find(x => x.game.gameId === gameId);
  }
}
