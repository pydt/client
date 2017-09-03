import { Component, OnInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as app from 'electron';
import * as pako from 'pako';

import { ApiService } from 'pydt-shared';
import { PydtSettings } from '../shared/pydtSettings';
import { PlayTurnState } from './playTurnState.service';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'pydt-home',
  templateUrl: './playTurn.component.html',
  styleUrls: ['./playTurn.component.css']
})
export class PlayTurnComponent implements OnInit {
  status = 'Downloading Save File...';
  saveFileToUpload: string;
  abort: boolean;
  curBytes: number;
  maxBytes: number;
  private saveDir: string;
  private archiveDir: string;
  private saveFileToPlay: string;

  constructor(
    public playTurnState: PlayTurnState,
    private apiService: ApiService,
    private router: Router,
    private ngZone: NgZone
    ) {
    const SUFFIX = '/Sid Meier\'s Civilization VI/Saves/Hotseat/';

    if (process.platform === 'darwin') {
      this.saveDir = app.remote.app.getPath('appData') + SUFFIX;
    } else {
      this.saveDir = app.remote.app.getPath('documents') + '/My Games' + SUFFIX;
    }

    if (!fs.existsSync(this.saveDir)) {
      mkdirp.sync(this.saveDir);
    }

    this.archiveDir = path.join(this.saveDir, 'pydt-archive');

    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir);
    }

    this.saveFileToPlay = this.saveDir + '(PYDT) Play This One!.Civ6Save';
  }

  ngOnInit() {
    this.abort = false;

    this.apiService.getTurnUrl(this.playTurnState.game.gameId, true)
      .flatMap(url => {
        console.log(url);
        return Observable.fromPromise(this.downloadFile(url));
      })
      .subscribe(() => {
        this.watchForSave();
      }, err => {
        this.status = err;
        this.abort = true;
      });
  }

  private downloadFile(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';

      xhr.onprogress = e => {
        this.ngZone.run(() => {
          if (e.lengthComputable) {
            this.curBytes = Math.round(e.loaded / 1024);
            this.maxBytes = Math.round(e.total / 1024);
          }
        });
      };

      xhr.onerror = () => {
        reject(xhr.status);
      };

      xhr.onload = e => {
        try {
          let data = new Uint8Array(xhr.response);

          try {
            data = pako.ungzip(new Uint8Array(xhr.response));
          } catch (e) {
            // Ignore - file probably wasn't gzipped...
          }

          fs.writeFile(this.saveFileToPlay, new Buffer(data), (err) => {
            if (err) {
              reject(err);
            } else {
              setTimeout(() => {
                this.curBytes = this.maxBytes = null;
                this.status = 'Downloaded file!  Play Your Damn Turn!';

                PydtSettings.getSettings().then(settings => {
                  if (settings.launchCiv) {
                    app.ipcRenderer.send('opn-url', 'steam://run/289070');
                  }
                });

                resolve();
              }, 500);
            }
          });
        } catch (err) {
          reject(err);
        }
      };
      xhr.send();
    });
  }

  ignoreSave() {
    this.status = 'Downloaded file!  Play Your Damn Turn!';
    this.saveFileToUpload = null;
    this.watchForSave();
  }

  private watchForSave() {
    const ptThis = this;
    app.ipcRenderer.send('start-chokidar', this.saveDir);
    app.ipcRenderer.on('new-save-detected', newSaveDetected);

    //////

    function newSaveDetected(event, arg) {
      ptThis.ngZone.run(() => {
        ptThis.status = `Detected new save: ${path.basename(arg).replace('.Civ6Save', '')}.  Submit turn?`;
        ptThis.saveFileToUpload = arg;
        app.ipcRenderer.removeListener('new-save-detected', newSaveDetected);
      });
    }
  }

  submitFile() {
    this.status = 'Uploading...';
    const fileData = pako.gzip(fs.readFileSync(this.saveFileToUpload));
    const moveFrom = this.saveFileToUpload;
    const moveTo = path.join(this.archiveDir, path.basename(this.saveFileToUpload));
    this.saveFileToUpload = null;

    this.apiService.startTurnSubmit(this.playTurnState.game.gameId).flatMap(response => {
      return Observable.fromPromise(new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', response.putUrl, true);

        xhr.upload.onprogress = e => {
          this.ngZone.run(() => {
            if (e.lengthComputable) {
              this.curBytes = Math.round(e.loaded / 1024);
              this.maxBytes = Math.round(e.total / 1024);
            }
          });
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(xhr.status);
          }
        };

        xhr.onerror = () => {
          reject(xhr.status);
        };

        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(fileData);
      }));
    })
    .flatMap(() => {
      return this.apiService.finishTurnSubmit(this.playTurnState.game.gameId);
    })
    .subscribe(() => {
      fs.renameSync(moveFrom, moveTo);
      this.router.navigate(['/']);
    }, err => {
      this.status = 'There was an error submitting your turn.  Please try again.';

      if (err.json && err.json().errorMessage) {
        this.status = err.json().errorMessage;
      }

      this.curBytes = this.maxBytes = null;
      this.abort = true;
    });
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
