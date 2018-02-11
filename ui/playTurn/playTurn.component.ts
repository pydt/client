import { Component, OnInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { PydtSettings } from '../shared/pydtSettings';
import { PlayTurnState } from './playTurnState.service';
import { Observable } from 'rxjs/Observable';
import { DefaultService } from '../swagger/api';
import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as app from 'electron';
import * as pako from 'pako';

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
    private api: DefaultService,
    private router: Router,
    private ngZone: NgZone
    ) {
    const SUFFIX = '/Sid Meier\'s Civilization VI/Saves/Hotseat/';

    if (process.platform === 'darwin') {
      this.saveDir = app.remote.app.getPath('appData') + SUFFIX;
    } else if (process.platform === 'linux') {
      this.saveDir = app.remote.app.getPath('home') + '/.local/share/aspyr-media/' + SUFFIX;
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

    this.api.gameGetTurn(this.playTurnState.game.gameId, 'yup')
      .flatMap(resp => {
        return Observable.fromPromise(this.downloadFile(resp.downloadUrl));
      })
      .subscribe(() => {
        this.watchForSave();
      }, err => {
        this.status = err;
        this.abort = true;
      });
  }

  private downloadFile(url: string) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';

      xhr.onprogress = e => {
        this.ngZone.run(() => {
          if (e.lengthComputable) {
            this.curBytes = Math.round(e.loaded / 1024);
            this.maxBytes = Math.round(e.total / 1024);
            console.log(this.curBytes, this.maxBytes);
          }
        });
      };

      xhr.onerror = () => {
        reject(xhr.status);
      };

      xhr.onload = e => {
        this.ngZone.run(() => {
          this.curBytes = this.maxBytes;

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
        });
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

  async submitFile() {
    this.status = 'Uploading...';
    const fileData = pako.gzip(fs.readFileSync(this.saveFileToUpload));
    const moveFrom = this.saveFileToUpload;
    const moveTo = path.join(this.archiveDir, path.basename(this.saveFileToUpload));
    this.saveFileToUpload = null;

    try {
      const startResp = await this.api.gameStartSubmit(this.playTurnState.game.gameId).toPromise();

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', startResp.putUrl, true);

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
      });

      await this.api.gameFinishSubmit(this.playTurnState.game.gameId).toPromise();

      const settings = await PydtSettings.getSettings();

      fs.renameSync(moveFrom, moveTo);

      // If we've got too many archived files, delete some...
      const files: string[] = fs.readdirSync(this.archiveDir)
        .map(x => {
          const file = path.join(this.archiveDir, x);
          return {
            file,
            time: fs.statSync(file).ctime.getTime()
          };
        })
        .sort((a, b) => a.time - b.time)
        .map(x => x.file);

      while (files.length > settings.numSaves) {
        fs.unlinkSync(files.shift());
      }

      this.router.navigate(['/']);
    } catch (err) {
      this.status = 'There was an error submitting your turn.  Please try again.';

      if (err.json && err.json().errorMessage) {
        this.status = err.json().errorMessage;
      }

      this.curBytes = this.maxBytes = null;
      this.abort = true;
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
