import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable()
export class ProfileCacheService {
  private cache: any;

  constructor (private api: ApiService) {
    this.cache = {};
  }

  getProfiles(steamIds: string[]) {
    let result = {};
    let toDownload: string[] = [];

    for (let steamId of steamIds) {
      if (this.cache[steamId]) {
        result[steamId] = this.cache[steamId];
      } else {
        toDownload.push(steamId);
      }
    }

    if (toDownload.length) {
      return this.api.getSteamProfiles(toDownload).then(profiles => {
        for (let profile of profiles) {
          this.cache[profile.steamid] = profile;
          result[profile.steamid] = profile;
        }

        return result;
      });
    }

    return Promise.resolve(result);
  }
}
