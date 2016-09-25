import { Injectable } from '@angular/core';
import { Http, Headers } from '@angular/http';
import { ConfigService } from './config.service';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/toPromise';

@Injectable()
export class ApiService {
  baseUrl = process.env.API_URL;

  constructor (private configService: ConfigService, private http: Http) {}

  getUserProfile() {
    return this.getAuthHeaders().then(headers => {
      return this.http.get(this.baseUrl + '/user/profile', headers)
        .map(res => {
          return res.json();
        }).toPromise();
    });
  }

  getSteamProfiles(steamIds: string[]) {
    return this.getAuthHeaders().then(headers => {
      return this.http.get(this.baseUrl + '/user/steamProfiles?steamIds=' + steamIds.join(), headers)
        .map(res => {
          return res.json();
        }).toPromise();
    });
  }

  getUserGames() {
    return this.getAuthHeaders().then(headers => {
      return this.http.get(this.baseUrl + '/user/games', headers)
        .map(res => {
          return res.json();
        }).toPromise();
    });
  }

  getTurnUrl(gameId) {
    return this.getAuthHeaders().then(headers => {
      return this.http.get(this.baseUrl + '/game/' + gameId + '/turn', headers)
        .map(res => {
          return res.json().downloadUrl;
        }).toPromise();
    });
  }

  getAuthHeaders() : Promise<Headers> {
    return this.configService.getConfig().then(config => {
      let headers = new Headers();

      if (!config.token) {
        throw new Error('Not Logged In!');
      }

      headers.append('Authorization', config.token);

      return { headers: headers };
    });
  }
}
