import { Injectable } from '@angular/core';
import { Http, Headers } from '@angular/http';
import { ConfigService } from './config.service';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/toPromise';

@Injectable()
export class ApiService {
  baseUrl = process.env.API_URL;

  constructor (private configService: ConfigService, private http: Http) {}

  getSteamProfile() {
    return this.get(this.baseUrl + '/user/steamProfile');
  }

  getSteamProfiles(steamIds: string[]) {
    return this.get(this.baseUrl + '/user/steamProfiles?steamIds=' + steamIds.join());
  }

  getUserGames() {
    return this.get(this.baseUrl + '/user/games');
  }

  getTurnUrl(gameId) {
    return this.get(this.baseUrl + '/game/' + gameId + '/turn').then(data => {
      return data.downloadUrl;
    });
  }

  startTurnSubmit(gameId) {
    return this.post(this.baseUrl + '/game/' + gameId + '/turn/startSubmit', {});
  }

  finishTurnSubmit(gameId) {
    return this.post(this.baseUrl + '/game/' + gameId + '/turn/finishSubmit', {});
  }

  private getAuthHeaders() : Promise<Headers> {
    return this.configService.getConfig().then(config => {
      let headers = new Headers();

      if (!config.token) {
        throw new Error('Not Logged In!');
      }

      headers.append('Authorization', config.token);

      return { headers: headers };
    });
  }

  private get(url) {
    return this.getAuthHeaders().then(headers => {
      return this.http.get(url, headers)
        .map(res => {
          return res.json();
        }).toPromise();
    });
  }

  private post(url, data) {
    return this.getAuthHeaders().then(headers => {
      return this.http.post(url, data, headers)
        .map(res => {
          return res.json();
        }).toPromise();
      });
  }
}
