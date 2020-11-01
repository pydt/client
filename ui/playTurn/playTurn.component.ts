import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as app from 'electron';
import * as fs from 'fs-extra';
import * as pako from 'pako';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import { Game, GameService, PlatformSaveLocation, SteamProfileMap, MetadataCacheService, CivGame } from 'pydt-shared';
import { PydtSettings } from '../shared/pydtSettings';
import { PlayTurnState } from './playTurnState.service';


@Component({
  selector: 'pydt-home',
  templateUrl: './playTurn.component.html',
  styleUrls: ['./playTurn.component.css']
})
export class PlayTurnComponent implements OnInit, OnDestroy {
  @Input() game: Game;
  @Input() gamePlayerProfiles: SteamProfileMap;
  status = 'Downloading Save File...';
  saveFileToUpload: string;
  abort: boolean;
  downloaded: boolean;
  curBytes: number;
  maxBytes: number;
  showGameInfo = false;
  settings: PydtSettings;
  games: CivGame[] = [];
  xhr: XMLHttpRequest;
  private saveDir: string;
  private archiveDir: string;
  private saveFileToPlay: string;

  constructor(
    public playTurnState: PlayTurnState,
    private metadataCache: MetadataCacheService,
    private gameService: GameService,
    private router: Router,
    private ngZone: NgZone
  ) {
  }

  @HostListener('click', ['$event'])
  onMouseEnter(event: MouseEvent) {
    const href = (event.srcElement as any).href;
    if (href) {
      app.ipcRenderer.send('open-url', href);
    }

    event.preventDefault();
    return false;
  }

  get civGame() {
    return this.games.find(x => x.id === this.playTurnState.game.gameType);
  }

  async ngOnInit() {
    this.abort = false;
    this.settings = await PydtSettings.getSettings();
    this.games = (await this.metadataCache.getCivGameMetadata()).civGames;

    try {
      this.saveDir = this.settings.getSavePath(this.civGame);

      if (!fs.existsSync(this.saveDir)) {
        mkdirp.sync(this.saveDir);
      }

      this.archiveDir = path.join(this.saveDir, 'pydt-archive');

      if (!fs.existsSync(this.archiveDir)) {
        fs.mkdirSync(this.archiveDir);
      }

      this.saveFileToPlay = this.saveDir + '(PYDT) Play This One!.' + this.civGame.saveExtension;
    } catch (err) {
      console.log(err);
      this.showGameInfo = false;
      this.abort = true;
      this.status = 'Unable to locate/create save file directory.  ' +
        'Are you using OneDrive and have the "Files On-Demand" option enabled?  ' +
        'The PYDT client will not work in this mode. :(';
      throw err;
    }

    try {
      const resp = await this.gameService.getTurn(this.playTurnState.game.gameId, 'yup').toPromise();
      await this.downloadFile(resp.downloadUrl);
    } catch (err) {
      this.ngZone.run(() => {
        this.status = err;
        this.showGameInfo = false;
        this.abort = true;
      });
    }
  }

  ngOnDestroy() {
    if (this.xhr) {
      this.xhr.abort();
      this.xhr = null;
    }
  }

  private downloadFile(url: string) {
    return new Promise((resolve, reject) => {
      this.xhr = new XMLHttpRequest();
      this.xhr.open('GET', url, true);
      this.xhr.responseType = 'arraybuffer';

      this.xhr.onprogress = e => {
        this.ngZone.run(() => {
          if (e.lengthComputable) {
            this.curBytes = Math.round(e.loaded / 1024);
            this.maxBytes = Math.round(e.total / 1024);
          }
        });
      };

      this.xhr.onerror = () => {
        reject(this.xhr.status);
        this.xhr = null;
      };

      this.xhr.onload = async () => {
        const response = this.xhr.response;
        this.xhr = null;

        try {
          await this.ngZone.run(async () => {
            this.curBytes = this.maxBytes;
          });

          await this.ngZone.run(async () => {
            let data = new Uint8Array(response);

            try {
              data = pako.ungzip(new Uint8Array(response));
            } catch (e) {
              // Ignore - file probably wasn't gzipped...
            }

            await fs.writeFile(this.saveFileToPlay, Buffer.from(data));
          });

          await new Promise(sleepResolve => setTimeout(sleepResolve, 500));

          this.ngZone.run(() => {
            if (this.settings.launchCiv) {
              app.ipcRenderer.send('open-url', this.civGame.runUrls[this.settings.getGameStore(this.civGame)]);
            }

            this.watchForSave();
          });

          resolve();
        } catch (err) {
          reject(err);
        }
      };

      this.xhr.send();
    });
  }

  public watchForSave() {
    this.curBytes = this.maxBytes = null;
    this.status = 'Downloaded file!<br />Play Your Damn Turn!';
    this.saveFileToUpload = null;
    this.abort = false;
    this.downloaded = true;

    const newSaveDetected = (event, arg) => {
      this.ngZone.run(() => {
        this.status = `Detected new save: ${path.basename(arg).replace(`.${this.civGame.saveExtension}`, '')}.  Submit turn?`;
        this.downloaded = false;
        this.showGameInfo = false;
        this.saveFileToUpload = arg;
        app.ipcRenderer.removeListener('new-save-detected', newSaveDetected);
      });
    };

    setTimeout(() => {
      app.ipcRenderer.send('start-chokidar', {
        path: this.saveDir,
        awaitWriteFinish: this.playTurnState.game.gameType !== 'CIV6'
      });
      app.ipcRenderer.on('new-save-detected', newSaveDetected);
    }, 5000);
  }

  async submitFile() {
    const fileBeingUploaded = this.saveFileToUpload;
    this.status = 'Uploading...';
    this.abort = false;
    this.saveFileToUpload = null;

    const fileData = pako.gzip(await fs.readFile(fileBeingUploaded));
    const moveTo = path.join(this.archiveDir, path.basename(fileBeingUploaded));

    try {
      const startResp = await this.gameService.startSubmit(this.playTurnState.game.gameId).toPromise();

      await new Promise((resolve, reject) => {
        this.xhr = new XMLHttpRequest();
        this.xhr.open('PUT', startResp.putUrl, true);

        this.xhr.upload.onprogress = e => {
          this.ngZone.run(() => {
            if (e.lengthComputable) {
              this.curBytes = Math.round(e.loaded / 1024);
              this.maxBytes = Math.round(e.total / 1024);
            }
          });
        };

        this.xhr.onload = () => {
          if (this.xhr.status === 200) {
            resolve();
          } else {
            reject(this.xhr.status);
          }

          this.xhr = null;
        };

        this.xhr.onerror = () => {
          reject(this.xhr.status);
          this.xhr = null;
        };

        this.xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        this.xhr.send(fileData);
      });

      await this.gameService.finishSubmit(this.playTurnState.game.gameId).toPromise();
      await fs.rename(fileBeingUploaded, moveTo);
    } catch (err) {
      this.status = 'There was an error submitting your turn.  Please try again.';

      if (err instanceof HttpErrorResponse) {
        this.status = err.error.errorMessage;
      }

      this.curBytes = this.maxBytes = null;
      this.saveFileToUpload = fileBeingUploaded;
      this.abort = true;
      this.showGameInfo = false;
      return;
    }

    // If we've got too many archived files, delete some...
    const files: string[] = (await fs.readdir(this.archiveDir))
      .map(x => {
        const file = path.join(this.archiveDir, x);
        return {
          file,
          time: fs.statSync(file).ctime.getTime()
        };
      })
      .sort((a, b) => a.time - b.time)
      .map(x => x.file);

    while (files.length > this.settings.numSaves) {
      await fs.unlink(files.shift());
    }

    this.router.navigate(['/']);
  }

  goHome() {
    this.router.navigate(['/']);
  }

  openGameOnWeb() {
    app.ipcRenderer.send('open-url', 'https://playyourdamnturn.com/game/' + this.playTurnState.game.gameId);
  }
}
