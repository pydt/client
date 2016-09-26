import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import * as fs from 'fs';
import * as chokidar from 'chokidar';
import * as app from 'electron';

import { ApiService } from '../shared/api.service';

@Component({
  selector: 'home',
  templateUrl: './playTurn/playTurn.component.html'
})
export class PlayTurnComponent implements OnInit {
  private status = "Downloading Save File...";
  private gameId: string;
  private saveDir: string;
  private saveFileToPlay: string;
  private saveFileToUpload: string;

  constructor(private route: ActivatedRoute, private apiService: ApiService, private router: Router) {
    let documents = app.remote.app.getPath('documents');
    if (this.ifExists(documents + '/Aspyr')) {
      this.saveDir = documents + '/Aspyr/Sid Meier\'s Civilization 5/Saves/hotseat/';
    } else {
      this.saveDir = app.remote.app.getPath('documents') + '/My Games/Sid Meier\'s Civilization 5/Saves/hotseat/';
    } 
    this.saveFileToPlay = this.saveDir + '(Ripoff) Play This One!.Civ5Save';
  }

  ifExists(path: string): boolean {
    try {
      return fs.statSync(path) != null;
    } catch (error) {
      return false;
    }
  }

  ngOnInit() {
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
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = e => {
        fs.writeFile(this.saveFileToPlay, new Buffer(new Uint8Array(xhr.response)), (err) => {
          if (err) {
            reject(err);
          } else {
            this.status = "Downloaded file!  Play your damn turn!";
            resolve();
          }
        });
      };
      xhr.send();
    });
  }

  private watchForSave() {
    return new Promise((resolve, reject) => {
      const watcher = chokidar.watch(this.saveDir, { depth: 0 });
      watcher.on('error', err => {
        watcher.close();
        reject(err);
      });
      watcher.on('change', path => {
        app.ipcRenderer.send('focus-window', true);
        this.status = "Detected new save, submit turn?";
        this.saveFileToUpload = path;
        watcher.close();
        resolve();
      });
    });
  }

  private submitFile() {
    this.status = "Uploading...";
    const fileData = fs.readFileSync(this.saveFileToUpload);
    this.saveFileToUpload = null;

    this.apiService.startTurnSubmit(this.gameId).then(response => {
      return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open('PUT', response.putUrl, true);

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
      return this.apiService.finishTurnSubmit(this.gameId);
    })
    .then(() => {
      this.router.navigate(['/']);
    })
    .catch(err => {
      this.status = err;
    });
  }
}
