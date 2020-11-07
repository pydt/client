import { Injectable } from '@angular/core';
import * as pako from 'pako';
import { BusyService, Game, GameService } from 'pydt-shared';
import { BehaviorSubject } from 'rxjs';
import { PydtSettings } from './pydtSettings';

@Injectable()
export class TurnCacheService {
  private readonly cache: TurnDownloader[] = [];

  constructor(
    private readonly gameService: GameService,
    private readonly busyService: BusyService,
  ) {
    this.backgroundDownloader().then();
  }

  async backgroundDownloader() {
    while (true) {
      const settings = await PydtSettings.getSettings();

      if (settings.autoDownload) {
        // Wait 5 seconds for next check
        await new Promise(resolve => setTimeout(resolve, 5000));

        for (const td of [...this.cache]) {
          if (!td.data$.value) {
            await td.waitForCompletion();
          }
        }
      }
    }
  }

  async updateGames(games: Game[]) {
    const cachedGameIds = this.cache.map(x => x.game.gameId);
    const newGames = games.filter(x => !cachedGameIds.includes(x.gameId));
    const gameIdsToRemove = cachedGameIds.filter(x => !games.some(y => y.gameId === x));

    for (const newGame of newGames) {
      this.cache.push(new TurnDownloader(newGame, this.gameService, this.busyService));
    }

    for (const gameId of gameIdsToRemove) {
      const i = this.cache.findIndex(x => x.game.gameId === gameId);
      this.cache[i].abort();
      this.cache.splice(i, 1);
    }
  }

  get(gameId: string) {
    return this.cache.find(x => x.game.gameId === gameId);
  }
}

export class TurnDownloader {
  private xhr: XMLHttpRequest;
  public readonly data$ = new BehaviorSubject<Buffer>(null);
  public readonly error$ = new BehaviorSubject<string>(null);
  public readonly curBytes$ = new BehaviorSubject<number>(0);
  public readonly maxBytes$ = new BehaviorSubject<number>(0);

  constructor(
    public readonly game: Game,
    private readonly gameService: GameService,
    private readonly busyService: BusyService,
  ) {
  }

  abort() {
    if (this.xhr) {
      this.error$.next('ABORTED');
      this.xhr.abort();
      this.xhr = null;
    }
  }

  waitForCompletion() {
    this.startDownload();

    return new Promise((resolve) => {
      this.data$.subscribe(data => {
        if (data) {
          resolve();
        }
      });

      this.error$.subscribe(err => {
        if (err) {
          resolve();
        }
      });
    });
  }

  startDownload() {
    if (this.xhr || this.data$.value) {
      return;
    }

    this.error$.next(null);
    this.curBytes$.next(0);
    this.maxBytes$.next(0);

    // Don't want this to trigger busy notifications...
    this.busyService.incrementBusy(false);

    this.gameService.getTurn(this.game.gameId, 'yup').subscribe(resp => {
      this.xhr = new XMLHttpRequest();
      this.xhr.open('GET', resp.downloadUrl, true);
      this.xhr.responseType = 'arraybuffer';

      this.xhr.onprogress = e => {
        if (e.lengthComputable) {
          this.curBytes$.next(Math.round(e.loaded / 1024));
          this.maxBytes$.next(Math.round(e.total / 1024));
        }
      };

      this.xhr.onerror = () => {
        this.error$.next(`Bad response code returned: ${this.xhr.status}`);
        this.xhr = null;
      };

      this.xhr.onload = async () => {
        const response = this.xhr.response;
        this.xhr = null;

        try {
          this.curBytes$.next(this.maxBytes$.value);

          let data = new Uint8Array(response);

          try {
            data = pako.ungzip(new Uint8Array(response));
          } catch (e) {
            // Ignore - file probably wasn't gzipped...
          }

          this.data$.next(Buffer.from(data));
        } catch (err) {
          this.error$.next(err);
        }
      };

      this.xhr.send();
    }).add(() => this.busyService.incrementBusy(true));
  }
}
