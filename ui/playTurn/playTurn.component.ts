import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as app from 'electron';

import { ApiService } from 'pydt-shared';

@Component({
  selector: 'pydt-home',
  templateUrl: './playTurn.component.html'
})
export class PlayTurnComponent implements OnInit {
  private busy: Promise<any>;
  private status = 'Downloading Save File...';
  private gameId: string;
  private saveDir: string;
  private saveFileToPlay: string;
  private saveFileToUpload: string;
  private abort: boolean;
  private curBytes: number;
  private maxBytes: number;

  constructor(private route: ActivatedRoute, private apiService: ApiService, private router: Router, private cdRef: ChangeDetectorRef) {
    const SUFFIX = '/Sid Meier\'s Civilization VI/Saves/Hotseat/';

    if (process.platform === 'darwin') {
      this.saveDir = app.remote.app.getPath('appData') + SUFFIX;
    } else {
      this.saveDir = app.remote.app.getPath('documents') + '/My Games' + SUFFIX;
    }

    this.saveFileToPlay = this.saveDir + '(PYDT) Play This One!.Civ6Save';
  }

  ifExists(path: string): boolean {
    try {
      return fs.statSync(path) != null;
    } catch (error) {
      return false;
    }
  }

  ngOnInit() {
    this.abort = false;

    this.route.params.forEach((params: Params) => {
      this.gameId = params['gameId'];

      this.apiService.getTurnUrl(this.gameId)
        .then(url => {
          console.log(url);
          return this.downloadFile(url);
        })
        .then(() => {
          return this.watchForSave();
        })
        .catch(err => {
          this.status = err;
        });
   });
  }

  private downloadFile(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';

      xhr.onprogress = e => {
        if (e.lengthComputable) {
          this.curBytes = Math.round(e.loaded / 1024);
          this.maxBytes = Math.round(e.total / 1024);
          this.cdRef.detectChanges();
        }
      };

      xhr.onload = e => {
        mkdirp.sync(this.saveDir);
        fs.writeFile(this.saveFileToPlay, new Buffer(new Uint8Array(xhr.response)), (err) => {
          if (err) {
            reject(err);
          } else {
            setTimeout(() => {
              this.curBytes = this.maxBytes = null;
              this.status = 'Downloaded file!  Play Your Damn Turn!';
              app.ipcRenderer.send('launch-civ6');
              resolve();
            }, 500);
          }
        });
      };
      xhr.send();
    });
  }

  private watchForSave() {
    const ptThis = this;
    return new Promise((resolve, reject) => {
      app.ipcRenderer.send('start-chokidar', this.saveDir);
      app.ipcRenderer.on('new-save-detected', newSaveDetected);

      //////

      function newSaveDetected(event, arg) {
        ptThis.status = 'Detected new save, submit turn?';
        ptThis.saveFileToUpload = arg;
        app.ipcRenderer.removeListener('new-save-detected', newSaveDetected);
        resolve();
      }
    });
  }

  // tslint:disable-next-line:no-unused-variable
  private submitFile() {
    this.status = 'Uploading...';
    const fileData = fs.readFileSync(this.saveFileToUpload);
    this.saveFileToUpload = null;

    this.apiService.startTurnSubmit(this.gameId).then(response => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', response.putUrl, true);

        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            this.curBytes = Math.round(e.loaded / 1024);
            this.maxBytes = Math.round(e.total / 1024);
            this.cdRef.detectChanges();
          }
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
    })
    .then(() => {
      return this.busy = this.apiService.finishTurnSubmit(this.gameId);
    })
    .then(() => {
      this.router.navigate(['/']);
    })
    .catch(err => {
      this.status = 'There was an error submitting your turn.  Please try again.';

      if (err.json && err.json().errorMessage) {
        this.status = err.json().errorMessage;
      }

      this.abort = true;
    });
  }

  // tslint:disable-next-line:no-unused-variable
  private goHome() {
    this.router.navigate(['/']);
  }
}
