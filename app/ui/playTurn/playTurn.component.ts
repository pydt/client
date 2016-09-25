import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import * as fs from 'fs';
import * as app from 'electron';

import { ApiService } from '../shared/api.service';

@Component({
  selector: 'home',
  templateUrl: './playTurn/playTurn.component.html'
})
export class PlayTurnComponent implements OnInit {
  private status = "Downloading Save File...";
  private gameId: string;

  constructor(private route: ActivatedRoute, private apiService: ApiService, private router: Router) {}

  ngOnInit() {
    this.route.params.forEach((params: Params) => {
      this.gameId = params['gameId'];

      this.apiService.getTurnUrl(this.gameId)
        .then(this.downloadFile)
        .then(() => {
          this.status = "Downloaded file!  Play your damn turn!";
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
        const filename = app.remote.app.getPath('documents') + '/My Games/Sid Meier\'s Civilization 5/Saves/hotseat/(Ripoff) Play This One!.Civ5Save';
        fs.writeFile(filename, new Buffer(new Uint8Array(xhr.response)), (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      };
      xhr.send();
    });

  }
}
