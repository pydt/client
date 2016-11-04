import { Injectable } from '@angular/core';
import { Http, Headers } from '@angular/http';
import { ConfigService } from './config.service';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/toPromise';

@Injectable()
export class ApiService {
  baseUrl = process.env.API_URL;

  constructor (private configService: ConfigService, private http: Http) {}

  getPublicJson(url: string) {
    return this.http.get(url)
      .map(res => {
        return res.json();
      }).toPromise();
  }

  getSteamProfile() {
    return this.get(this.baseUrl + '/user/steamProfile');
  }

  getSteamProfiles(steamIds: string[]) {
    return this.get(this.baseUrl + '/user/steamProfiles?steamIds=' + steamIds.join());
  }

  getUserGames() {
    return this.get(this.baseUrl + '/user/games', { includepollurl: 'yup' });
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

  private getAuthHeaders() {
    return this.configService.getConfig().then(config => {
      let headers = new Headers();

      if (!config.token) {
        throw new Error('Not Logged In!');
      }

      headers.append('Authorization', config.token);

      return { headers: headers };
    });
  }

  private get(url, addlHeaders?: any) {
    return this.getAuthHeaders().then(reqOptions => {
      if (addlHeaders) {
        for (let header in addlHeaders) {
          reqOptions.headers.append(header, addlHeaders[header]);
        }
      }

      return this.http.get(url, reqOptions)
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
